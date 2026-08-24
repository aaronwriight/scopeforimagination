#!/usr/bin/env python3
"""Upload a local Scope for Imagination JSON post to Sanity."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, time
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore[assignment]


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POSTS_DIR = PROJECT_ROOT / "content" / "scope-for-imagination" / "posts"
DEFAULT_API_VERSION = "2024-02-22"
DEFAULT_TIMEZONE = "America/New_York"


class HtmlTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"br", "p", "blockquote", "li", "h1", "h2", "h3", "h4"}:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return re.sub(r"\s+", " ", "".join(self.parts)).strip()


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


def normalize_entry(value: str) -> str:
    if not value.isdigit() or int(value) < 1:
        raise argparse.ArgumentTypeError("entry numbers must be positive integers")
    return value.zfill(4)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload a local SFI post JSON file to Sanity.")
    parser.add_argument("--entry", required=True, type=normalize_entry, help="four-digit SFI entry number")
    parser.add_argument("--replace", action="store_true", help="replace the Sanity document if it already exists")
    parser.add_argument("--publish", action="store_true", help="shortcut for --status=published")
    parser.add_argument("--status", choices=["draft", "published"], default="draft", help="Sanity status field")
    parser.add_argument("--excerpt", help="override the generated excerpt")
    parser.add_argument("--dry-run", action="store_true", help="print the Sanity document without uploading")
    parser.add_argument("--posts-dir", type=Path, default=DEFAULT_POSTS_DIR, help=argparse.SUPPRESS)
    return parser.parse_args()


def is_music(value: object) -> bool:
    if not isinstance(value, dict) or not set(value).issubset({"title", "artist", "url"}):
        return False
    if not isinstance(value.get("title"), str) or not str(value["title"]).strip():
        return False
    if not isinstance(value.get("artist"), str) or not str(value["artist"]).strip():
        return False
    if "url" not in value:
        return True
    if not isinstance(value["url"], str) or not str(value["url"]).strip():
        return False
    normalized_url = str(value["url"]).strip()
    parsed_url = urlparse(normalized_url)
    return (
        not any(character.isspace() for character in normalized_url)
        and parsed_url.scheme in {"http", "https"}
        and bool(parsed_url.netloc)
    )


def is_local_post(value: object) -> bool:
    if not isinstance(value, dict):
        return False

    required_strings = ["title", "subtitle", "date", "time", "location", "entry", "bodyHtml"]
    if any(not isinstance(value.get(key), str) for key in required_strings):
        return False

    tags = value.get("tags")
    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        return False

    return "music" not in value or is_music(value["music"])


def load_post(posts_dir: Path, entry: str) -> dict[str, object]:
    post_path = posts_dir.expanduser().resolve() / f"{entry}.json"
    if not post_path.exists():
        print(f"error: local post not found: {post_path}", file=sys.stderr)
        raise SystemExit(1)

    post = json.loads(post_path.read_text(encoding="utf-8"))
    if not is_local_post(post):
        print(f"error: {post_path} is not a valid Scope for Imagination post JSON file", file=sys.stderr)
        raise SystemExit(1)

    return post


def extract_excerpt(body_html: str, override: str | None) -> str:
    if override:
        return override.strip()[:240]

    parser = HtmlTextExtractor()
    parser.feed(body_html)
    text = parser.text()
    if len(text) <= 240:
        return text
    return text[:237].rstrip() + "..."


def published_at(post: dict[str, object]) -> str:
    date_value = date.fromisoformat(str(post["date"]))
    hour, minute = [int(part) for part in str(post["time"]).split(":", 1)]
    timezone_name = os.environ.get("SFI_TIMEZONE") or DEFAULT_TIMEZONE

    if ZoneInfo is not None:
        return datetime.combine(date_value, time(hour, minute), ZoneInfo(timezone_name)).isoformat()

    return f"{date_value.isoformat()}T{hour:02d}:{minute:02d}:00"


def build_document(post: dict[str, object], arguments: argparse.Namespace) -> dict[str, object]:
    entry = str(post["entry"])
    status = "published" if arguments.publish else arguments.status
    body_html = str(post["bodyHtml"]).strip()
    excerpt = extract_excerpt(body_html, arguments.excerpt)

    document: dict[str, object] = {
        "_id": f"scopePost.{entry}",
        "_type": "scopePost",
        "title": str(post["title"]).strip(),
        "subtitle": str(post["subtitle"]).strip(),
        "entry": entry,
        "slug": {"_type": "slug", "current": entry},
        "publishedAt": published_at(post),
        "location": str(post["location"]).strip(),
        "status": status,
        "tags": [tag.strip().lower() for tag in post["tags"] if str(tag).strip()],
        "excerpt": excerpt,
        "bodyHtml": body_html,
    }
    music = post.get("music")
    if isinstance(music, dict):
        sanity_music = {
            "title": str(music["title"]).strip(),
            "artist": str(music["artist"]).strip(),
        }
        if music.get("url"):
            sanity_music["url"] = str(music["url"]).strip()
        document["music"] = sanity_music

    return document


def upload_document(document: dict[str, object], replace: bool) -> dict[str, object]:
    project_id = os.environ.get("NEXT_PUBLIC_SANITY_PROJECT_ID")
    dataset = os.environ.get("NEXT_PUBLIC_SANITY_DATASET")
    token = os.environ.get("SANITY_API_WRITE_TOKEN")
    api_version = os.environ.get("NEXT_PUBLIC_SANITY_API_VERSION") or DEFAULT_API_VERSION

    if not project_id or not dataset:
        print("error: set NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET", file=sys.stderr)
        raise SystemExit(1)
    if not token:
        print("error: set SANITY_API_WRITE_TOKEN", file=sys.stderr)
        raise SystemExit(1)

    mutation_name = "createOrReplace" if replace else "createIfNotExists"
    payload = {"mutations": [{mutation_name: document}]}
    url = (
        f"https://{project_id}.api.sanity.io/v{api_version}/data/mutate/"
        f"{quote(dataset, safe='')}?returnIds=true&visibility=sync"
    )
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        print(f"error: Sanity returned {error.code}: {error.read().decode('utf-8')}", file=sys.stderr)
        raise SystemExit(1) from error


def main() -> int:
    arguments = parse_arguments()
    load_local_environment()

    post = load_post(arguments.posts_dir, arguments.entry)
    if str(post["entry"]) != arguments.entry:
        print(f"error: file entry is {post['entry']}, expected {arguments.entry}", file=sys.stderr)
        return 1

    document = build_document(post, arguments)
    if arguments.dry_run:
        print(json.dumps(document, ensure_ascii=False, indent=2))
        return 0

    result = upload_document(document, arguments.replace)
    operation = "replaced" if arguments.replace else "created if missing"
    print(f"{operation} Sanity document {document['_id']} ({document['status']})")
    if result.get("transactionId"):
        print(f"transaction: {result['transactionId']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
