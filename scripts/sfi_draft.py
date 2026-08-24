#!/usr/bin/env python3
"""Create a new local Scope for Imagination HTML draft."""

from __future__ import annotations

import argparse
import json
import re
import shlex
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DRAFTS_DIR = PROJECT_ROOT / "content" / "scope-for-imagination" / "drafts"
DEFAULT_POSTS_DIR = PROJECT_ROOT / "content" / "scope-for-imagination" / "posts"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return slug.strip("-") or "untitled"


def normalize_entry(value: str) -> str:
    if not value.isdigit() or int(value) < 1:
        raise argparse.ArgumentTypeError("entry numbers must be positive integers")
    return value.zfill(4)


def post_entries(posts_dir: Path) -> set[int]:
    entries: set[int] = set()
    if not posts_dir.exists():
        return entries

    for post_path in posts_dir.glob("*.json"):
        try:
            post = json.loads(post_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue

        entry = post.get("entry")
        if isinstance(entry, str) and entry.isdigit():
            entries.add(int(entry))

    return entries


def draft_entries(drafts_dir: Path) -> set[int]:
    entries: set[int] = set()
    if not drafts_dir.exists():
        return entries

    for draft_path in drafts_dir.glob("*.html"):
        match = re.match(r"^(\d{4})-", draft_path.name)
        if match:
            entries.add(int(match.group(1)))

    return entries


def next_entry(posts_dir: Path, drafts_dir: Path) -> str:
    entries = post_entries(posts_dir) | draft_entries(drafts_dir)
    return str(max(entries, default=0) + 1).zfill(4)


def validate_http_url(value: str) -> str:
    normalized = value.strip()
    parsed = urlparse(normalized)
    if any(character.isspace() for character in normalized) or parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise argparse.ArgumentTypeError("music links must use an absolute http(s) URL")
    return normalized


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a new local SFI HTML draft.")
    parser.add_argument("--subtitle", required=True, help="working subtitle for the post")
    parser.add_argument("--tags", default="musings", help="comma-separated tags for the eventual post")
    parser.add_argument("--location", default="Cambridge, MA", help="location shown in the eventual post header")
    parser.add_argument("--title", default="scope for imagination", help="post title")
    parser.add_argument("--music-title", help="optional song title shown with the post")
    parser.add_argument("--music-artist", help="artist for --music-title")
    parser.add_argument("--music-url", type=validate_http_url, help="optional http(s) link to the song")
    parser.add_argument("--entry", type=normalize_entry, help="four-digit entry number; defaults to the next draft/post number")
    parser.add_argument("--replace", action="store_true", help="replace the draft file if it already exists")
    parser.add_argument("--drafts-dir", type=Path, default=DEFAULT_DRAFTS_DIR, help=argparse.SUPPRESS)
    parser.add_argument("--posts-dir", type=Path, default=DEFAULT_POSTS_DIR, help=argparse.SUPPRESS)
    arguments = parser.parse_args()

    arguments.music_title = arguments.music_title.strip() if arguments.music_title else None
    arguments.music_artist = arguments.music_artist.strip() if arguments.music_artist else None
    if bool(arguments.music_title) != bool(arguments.music_artist):
        parser.error("--music-title and --music-artist must be provided together")
    if arguments.music_url and not arguments.music_title:
        parser.error("--music-url requires --music-title and --music-artist")

    return arguments


def draft_template(
    title: str,
    subtitle: str,
    entry: str,
    tags: str,
    location: str,
    music_title: str | None,
    music_artist: str | None,
    music_url: str | None,
) -> str:
    today = date.today().isoformat()
    music_metadata = ""
    if music_title and music_artist:
        music_metadata = f"\n      music title: {music_title}\n      music artist: {music_artist}"
        if music_url:
            music_metadata += f"\n      music url: {music_url}"

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{title}: {subtitle}</title>
  </head>
  <body>
    <!--
      entry: {entry}
      title: {title}
      subtitle: {subtitle}
      date: {today}
      location: {location}
      tags: {tags}{music_metadata}
    -->

    <p>[Open with the moment, image, question, or feeling that made you want to write.]</p>

    <h2>noticing</h2>
    <p>[What are you paying attention to lately?]</p>

    <h2>thinking through</h2>
    <p>[Ideas, questions, work, art, faith, science, people, or places.]</p>

    <h2>currently</h2>
    <ul>
      <li>reading: [ ]</li>
      <li>listening: [ ]</li>
      <li>making: [ ]</li>
      <li>learning: [ ]</li>
    </ul>

    <h2>leaving with</h2>
    <p>[A final image, unresolved thought, gratitude, or next step.]</p>
  </body>
</html>
"""


def main() -> int:
    arguments = parse_arguments()
    drafts_dir = arguments.drafts_dir.expanduser().resolve()
    posts_dir = arguments.posts_dir.expanduser().resolve()
    entry = arguments.entry or next_entry(posts_dir, drafts_dir)
    draft_path = drafts_dir / f"{entry}-{slugify(arguments.subtitle)}.html"

    if draft_path.exists() and not arguments.replace:
        print(f"error: draft already exists: {draft_path}", file=sys.stderr)
        print("pass --replace to overwrite it", file=sys.stderr)
        return 1

    drafts_dir.mkdir(parents=True, exist_ok=True)
    draft_path.write_text(
        draft_template(
            arguments.title,
            arguments.subtitle,
            entry,
            arguments.tags,
            arguments.location,
            arguments.music_title,
            arguments.music_artist,
            arguments.music_url,
        ),
        encoding="utf-8",
    )

    relative_path = draft_path.relative_to(PROJECT_ROOT) if draft_path.is_relative_to(PROJECT_ROOT) else draft_path
    print(f"created {relative_path}")
    print()
    print("When it is ready, publish it with:")
    publish_command = [
        "pnpm",
        "sfi:new",
        f"--doc={relative_path}",
        f"--title={arguments.title}",
        f"--subtitle={arguments.subtitle}",
        f"--tags={arguments.tags}",
        f"--location={arguments.location}",
    ]
    if arguments.music_title and arguments.music_artist:
        publish_command.extend(
            [
                f"--music-title={arguments.music_title}",
                f"--music-artist={arguments.music_artist}",
            ]
        )
        if arguments.music_url:
            publish_command.append(f"--music-url={arguments.music_url}")
    publish_command.append(f"--entry={entry}")
    print(shlex.join(publish_command))
    print(f"pnpm sfi:check --entry={entry}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
