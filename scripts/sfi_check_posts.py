#!/usr/bin/env python3
"""Validate local Scope for Imagination posts and newsletter templates."""

from __future__ import annotations

import argparse
import html as html_module
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POSTS_DIR = PROJECT_ROOT / "content" / "scope-for-imagination" / "posts"
DEFAULT_NEWSLETTERS_DIR = PROJECT_ROOT / "content" / "scope-for-imagination" / "newsletters"

REQUIRED_POST_STRINGS = ["title", "subtitle", "date", "time", "location", "entry", "bodyHtml"]
REQUIRED_NEWSLETTER_STRINGS = ["entry", "name", "subject", "previewText", "html", "text"]


def normalize_entry(value: str) -> str:
    if not value.isdigit() or int(value) < 1:
        raise argparse.ArgumentTypeError("entry numbers must be positive integers")
    return value.zfill(4)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate local Scope for Imagination post files.")
    parser.add_argument("--entry", type=normalize_entry, help="validate one four-digit entry")
    parser.add_argument("--posts-dir", type=Path, default=DEFAULT_POSTS_DIR, help=argparse.SUPPRESS)
    parser.add_argument("--newsletters-dir", type=Path, default=DEFAULT_NEWSLETTERS_DIR, help=argparse.SUPPRESS)
    return parser.parse_args()


def load_json(path: Path, errors: list[str]) -> object | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"missing file: {path}")
    except json.JSONDecodeError as error:
        errors.append(f"{path}: invalid JSON: {error}")
    return None


def validate_date(value: str, path: Path, errors: list[str]) -> None:
    try:
        date.fromisoformat(value)
    except ValueError:
        errors.append(f"{path}: date must use YYYY-MM-DD")


def validate_time(value: str, path: Path, errors: list[str]) -> None:
    try:
        datetime.strptime(value, "%H:%M")
    except ValueError:
        errors.append(f"{path}: time must use 24-hour HH:MM")


def validate_music(value: object, path: Path, errors: list[str]) -> None:
    if not isinstance(value, dict):
        errors.append(f"{path}: music must be an object")
        return

    unknown_fields = sorted(set(value) - {"title", "album", "artist", "url"})
    if unknown_fields:
        errors.append(f"{path}: music contains unsupported fields: {', '.join(unknown_fields)}")

    for field in ["title", "artist"]:
        if not isinstance(value.get(field), str) or not str(value.get(field)).strip():
            errors.append(f"{path}: music.{field} must be a non-empty string")

    if "album" in value and (not isinstance(value["album"], str) or not str(value["album"]).strip()):
        errors.append(f"{path}: music.album must be a non-empty string")

    if "url" in value:
        music_url = value["url"]
        if not isinstance(music_url, str) or not music_url.strip():
            errors.append(f"{path}: music.url must be a non-empty http(s) URL")
        else:
            normalized_url = music_url.strip()
            parsed_url = urlparse(normalized_url)
            if (
                any(character.isspace() for character in normalized_url)
                or parsed_url.scheme not in {"http", "https"}
                or not parsed_url.netloc
            ):
                errors.append(f"{path}: music.url must be an absolute http(s) URL")


def validate_post(path: Path, expected_entry: str, errors: list[str]) -> dict[str, object] | None:
    value = load_json(path, errors)
    if value is None:
        return None
    if not isinstance(value, dict):
        errors.append(f"{path}: expected a JSON object")
        return None

    for field in REQUIRED_POST_STRINGS:
        if not isinstance(value.get(field), str) or not str(value.get(field)).strip():
            errors.append(f"{path}: missing non-empty string field `{field}`")

    entry = value.get("entry")
    if entry != expected_entry:
        errors.append(f"{path}: entry field must match filename `{expected_entry}`")
    if not isinstance(entry, str) or not re.fullmatch(r"\d{4}", entry):
        errors.append(f"{path}: entry must be four digits")

    if isinstance(value.get("date"), str):
        validate_date(str(value["date"]), path, errors)
    if isinstance(value.get("time"), str):
        validate_time(str(value["time"]), path, errors)

    tags = value.get("tags")
    if not isinstance(tags, list) or not all(isinstance(tag, str) and tag.strip() for tag in tags):
        errors.append(f"{path}: tags must be a list of non-empty strings")

    if "music" in value and value["music"] is not None:
        validate_music(value["music"], path, errors)

    body_html = value.get("bodyHtml")
    if isinstance(body_html, str):
        if "<script" in body_html.lower():
            errors.append(f"{path}: bodyHtml must not include script tags")
        if re.search(r"\[[^\]]+\]", body_html):
            errors.append(f"{path}: bodyHtml still appears to contain bracketed draft prompts")

    return value


def validate_newsletter(path: Path, expected_entry: str, post: dict[str, object] | None, errors: list[str]) -> None:
    value = load_json(path, errors)
    if value is None:
        return
    if not isinstance(value, dict):
        errors.append(f"{path}: expected a JSON object")
        return

    for field in REQUIRED_NEWSLETTER_STRINGS:
        if not isinstance(value.get(field), str) or not str(value.get(field)).strip():
            errors.append(f"{path}: missing non-empty string field `{field}`")

    if value.get("entry") != expected_entry:
        errors.append(f"{path}: entry field must match `{expected_entry}`")

    newsletter_path = value.get("path")
    if newsletter_path is not None and (
        not isinstance(newsletter_path, str)
        or not newsletter_path.startswith("/")
        or newsletter_path.startswith("//")
    ):
        errors.append(f"{path}: path must be a site-relative path beginning with one `/`")

    html = value.get("html")
    text = value.get("text")
    if isinstance(html, str):
        if "[[ENTRY_URL]]" not in html:
            errors.append(f"{path}: html must contain [[ENTRY_URL]]")
        if "{{{RESEND_UNSUBSCRIBE_URL}}}" not in html:
            errors.append(f"{path}: html must contain Resend unsubscribe placeholder")
    if isinstance(text, str):
        if "[[ENTRY_URL]]" not in text:
            errors.append(f"{path}: text must contain [[ENTRY_URL]]")
        if "{{{RESEND_UNSUBSCRIBE_URL}}}" not in text:
            errors.append(f"{path}: text must contain Resend unsubscribe placeholder")

    music = post.get("music") if post else None
    if isinstance(music, dict):
        music_values = [str(music.get("title") or "").strip(), str(music.get("artist") or "").strip()]
        music_url = str(music.get("url") or "").strip()
        if music_url:
            music_values.append(music_url)

        for music_value in filter(None, music_values):
            if isinstance(html, str) and html_module.escape(music_value, quote=True) not in html:
                errors.append(f"{path}: html must include the post music value `{music_value}`")
            if isinstance(text, str) and music_value not in text:
                errors.append(f"{path}: text must include the post music value `{music_value}`")


def post_paths(posts_dir: Path, entry: str | None) -> list[Path]:
    if entry:
        return [posts_dir / f"{entry}.json"]
    return sorted(path for path in posts_dir.glob("*.json") if path.name != ".gitkeep")


def main() -> int:
    arguments = parse_arguments()
    posts_dir = arguments.posts_dir.expanduser().resolve()
    newsletters_dir = arguments.newsletters_dir.expanduser().resolve()
    errors: list[str] = []

    paths = post_paths(posts_dir, arguments.entry)
    if not paths:
        errors.append(f"no post JSON files found in {posts_dir}")

    for post_path in paths:
        entry = post_path.stem
        if not re.fullmatch(r"\d{4}", entry):
            errors.append(f"{post_path}: filename must be a four-digit entry number")
            continue

        post = validate_post(post_path, entry, errors)
        validate_newsletter(newsletters_dir / f"{entry}.json", entry, post, errors)

    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1

    target = arguments.entry or "all local posts"
    print(f"ok: {target} validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
