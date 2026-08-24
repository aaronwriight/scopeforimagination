#!/usr/bin/env python3
"""Create a Resend broadcast draft (or explicitly send it) for an SFI entry."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.error import HTTPError
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
NEWSLETTERS_DIR = PROJECT_ROOT / "content" / "scope-for-imagination" / "newsletters"
SANITY_API_VERSION = "2024-02-22"


def load_local_environment() -> None:
    env_path = PROJECT_ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or send the newsletter broadcast for an SFI entry.")
    parser.add_argument("--entry", required=True, help="four-digit SFI entry number")
    parser.add_argument("--send", action="store_true", help="send immediately instead of creating a draft")
    return parser.parse_args()


def display_date(date_value: str) -> str:
    year, month, day = date_value.split("-")
    return f"{int(month)}.{int(day)}.{year[-2:]}"


def is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return (
        bool(value)
        and not any(character.isspace() for character in value)
        and parsed.scheme in {"http", "https"}
        and bool(parsed.netloc)
    )


def newsletter_for_post(post: dict[str, object]) -> dict[str, str]:
    title = str(post.get("title") or "scope for imagination")
    subtitle = str(post.get("subtitle") or "").strip()
    entry = str(post["entry"])
    subject = str(post.get("subject") or "").strip() or f"{title}: {subtitle}"
    preview_text = (
        str(post.get("previewText") or "").strip()
        or str(post.get("excerpt") or "").strip()
        or f"A new Scope for Imagination entry: {subtitle}"
    )
    entry_url = "[[ENTRY_URL]]"
    unsubscribe_url = "{{{RESEND_UNSUBSCRIBE_URL}}}"
    details_text = f"{display_date(str(post['date']))} • {post['location']} • {entry}"
    music_html = ""

    music = post.get("music")
    if isinstance(music, dict):
        music_title = str(music.get("title") or "").strip()
        music_artist = str(music.get("artist") or "").strip()
        music_url = str(music.get("url") or "").strip()
        if music_title and music_artist:
            music_label = f"<em>{html_escape(music_title)}</em>, {html_escape(music_artist)}"
            if is_http_url(music_url):
                music_label = f'<a href="{html_escape(music_url)}">{music_label}</a>'
            music_html = f"<p>{music_label}</p>"
            details_text += f"\n{music_title}, {music_artist}"
            if is_http_url(music_url):
                details_text += f" — {music_url}"

    email_html = (
        "<p>Hello {{{contact.first_name|there}}},</p>"
        "<p>There is a new entry in <em>Scope for Imagination</em>.</p>"
        f"<h1>{html_escape(title)}</h1>"
        f"<p><em>{html_escape(subtitle)}</em></p>"
        f"<p>{display_date(str(post['date']))} • {html_escape(str(post['location']))} • {entry}</p>"
        f"{music_html}"
        f'<p><a href="{entry_url}">Read entry {entry} →</a></p>'
        f'<p><small><a href="{unsubscribe_url}">Unsubscribe</a></small></p>'
    )
    email_text = (
        "Hello {{{contact.first_name|there}}},\n\n"
        "There is a new entry in Scope for Imagination.\n\n"
        f"{subject}\n{details_text}\n\n"
        f"Read entry {entry}: {entry_url}\n\n"
        f"Unsubscribe: {unsubscribe_url}\n"
    )

    return {
        "entry": entry,
        "name": f"SFI {entry}: {subtitle}",
        "subject": subject,
        "previewText": preview_text[:160],
        "html": email_html,
        "text": email_text,
    }


def html_escape(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def sanity_query(entry: str) -> dict[str, object] | None:
    project_id = os.environ.get("NEXT_PUBLIC_SANITY_PROJECT_ID")
    dataset = os.environ.get("NEXT_PUBLIC_SANITY_DATASET")
    if not project_id or not dataset:
        return None

    api_version = os.environ.get("NEXT_PUBLIC_SANITY_API_VERSION") or SANITY_API_VERSION
    query = (
        f'*[_type == "scopePost" && status == "published" && entry == "{entry}"][0]{{'
        'title,subtitle,entry,publishedAt,location,excerpt,music{title,artist,url},'
        '"subject": newsletter.subject,'
        '"previewText": newsletter.previewText'
        "}"
    )
    url = f"https://{project_id}.api.sanity.io/v{api_version}/data/query/{dataset}?query={quote(query)}"
    request = Request(url, headers={"Accept": "application/json"})
    token = os.environ.get("SANITY_API_READ_TOKEN")
    if token:
        request.add_header("Authorization", f"Bearer {token}")

    with urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    post = payload.get("result")
    if not isinstance(post, dict) or not post.get("entry") or not post.get("publishedAt") or not post.get("subtitle"):
        return None

    date_value = str(post["publishedAt"]).split("T", 1)[0]
    return {
        "title": post.get("title") or "scope for imagination",
        "subtitle": post["subtitle"],
        "date": date_value,
        "location": post.get("location") or "Cambridge, MA",
        "entry": post["entry"],
        "music": post.get("music"),
        "excerpt": post.get("excerpt") or "",
        "subject": post.get("subject") or "",
        "previewText": post.get("previewText") or "",
    }


def load_newsletter_template(entry: str) -> dict[str, str] | None:
    template_path = NEWSLETTERS_DIR / f"{entry}.json"
    if template_path.exists():
        return json.loads(template_path.read_text(encoding="utf-8"))

    post = sanity_query(entry)
    if post:
        return newsletter_for_post(post)

    return None


def main() -> int:
    arguments = parse_arguments()
    entry = arguments.entry.zfill(4)
    if not entry.isdigit() or len(entry) != 4:
        print("error: --entry must be a four-digit number", file=sys.stderr)
        return 1

    load_local_environment()
    api_key = os.environ.get("RESEND_API_KEY")
    segment_id = os.environ.get("RESEND_SFI_SEGMENT_ID")
    sender = os.environ.get("SFI_NEWSLETTER_FROM")
    site_url = (os.environ.get("NEXT_PUBLIC_SITE_URL") or "https://aaronwriight.vercel.app").rstrip("/")
    if not api_key or not segment_id or not sender:
        print("error: set RESEND_API_KEY, RESEND_SFI_SEGMENT_ID, and SFI_NEWSLETTER_FROM", file=sys.stderr)
        return 1

    template = load_newsletter_template(entry)
    if not template:
        print(
            f"error: newsletter template not found for entry {entry}; "
            "add a local template or configure Sanity env vars for a published post",
            file=sys.stderr,
        )
        return 1

    entry_url = f"{site_url}/scope-for-imagination/{entry}"
    payload = {
        "segment_id": segment_id,
        "from": sender,
        "name": template["name"],
        "subject": template["subject"],
        "preview_text": template["previewText"],
        "html": template["html"].replace("[[ENTRY_URL]]", entry_url),
        "text": template["text"].replace("[[ENTRY_URL]]", entry_url),
        "send": arguments.send,
    }
    request = Request(
        "https://api.resend.com/broadcasts",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        print(f"error: Resend returned {error.code}: {error.read().decode('utf-8')}", file=sys.stderr)
        return 1

    action = "sent" if arguments.send else "created draft"
    print(f"{action} broadcast {result.get('id', '(unknown id)')} for entry {entry}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
