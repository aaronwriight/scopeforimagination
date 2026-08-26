#!/usr/bin/env python3
"""Draft, review, publish, and announce unified SFI posts.

Scope for Imagination is the complete, globally numbered journal. Venture posts
are published into that journal as well as into Venture's place-based index.
Author-owned metadata and source documents live under ``writing/``; generated
site data continues to live under ``content/``.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Iterable
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AUTHOR_SCHEMA = "../../post.schema.json"
SUPPORTED_SOURCE_SUFFIXES = {".docx", ".html", ".htm", ".txt", ".md"}
BLANK_SOURCE_FORMATS = ("md", "html", "txt")
BLOGS = ("sfi", "venture")
STATUSES = ("draft", "published")
RESERVED_VENTURE_SLUGS = {"about", "index", "parks", "trails", "travels"}

REQUIRED_AUTHOR_KEYS = {
    "$schema",
    "source",
    "title",
    "subtitle",
    "excerpt",
    "entry",
    "date",
    "time",
    "location",
    "trip",
    "thread",
    "slug",
    "music",
    "tags",
    "blog",
    "collections",
    "latitude",
    "longitude",
    "status",
}
MUSIC_KEYS = {"title", "album", "artist", "url"}


class WritingError(Exception):
    """An expected, human-readable command failure."""


@dataclass(frozen=True)
class AuthorPost:
    path: Path
    metadata: dict[str, Any]

    @property
    def directory(self) -> Path:
        return self.path.parent

    @property
    def entry(self) -> str:
        return str(self.metadata.get("entry") or "")

    @property
    def slug(self) -> str:
        return str(self.metadata.get("slug") or "")

    @property
    def blog(self) -> str:
        return str(self.metadata.get("blog") or "")

    @property
    def source_path(self) -> Path | None:
        source = self.metadata.get("source")
        if not isinstance(source, str) or not source.strip():
            return None
        return self.directory / PurePosixPath(source)


@dataclass
class ReviewResult:
    post: AuthorPost
    blockers: list[str]
    notes: list[str]
    body_html: str | None = None
    word_count: int = 0
    image_count: int = 0
    heading_count: int = 0
    link_count: int = 0

    @property
    def ok(self) -> bool:
        return not self.blockers


def relative_display(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def slugify(value: str) -> str:
    normalized = value.strip().lower().replace("’", "'")
    normalized = re.sub(r"['`]", "", normalized)
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    return normalized.strip("-") or "untitled"


def valid_slug(value: object) -> bool:
    return isinstance(value, str) and bool(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value))


def valid_post_slug(value: object) -> bool:
    return isinstance(value, str) and bool(
        re.fullmatch(r"\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*-\d{8}", value)
    )


def normalize_entry(value: str) -> str:
    if not value.isdigit() or int(value) < 1 or int(value) > 9999:
        raise argparse.ArgumentTypeError("entries must be integers from 1 through 9999")
    return value.zfill(4)


def valid_date(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def date_argument(value: str) -> str:
    if not valid_date(value):
        raise argparse.ArgumentTypeError("dates must use YYYY-MM-DD")
    return value


def valid_time(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return datetime.strptime(value, "%H:%M").strftime("%H:%M") == value
    except ValueError:
        return False


def current_publication_time() -> str:
    return datetime.now().strftime("%H:%M")


def is_http_url(value: object) -> bool:
    if not isinstance(value, str) or not value.strip() or any(character.isspace() for character in value):
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def url_argument(value: str) -> str:
    value = value.strip()
    if not is_http_url(value):
        raise argparse.ArgumentTypeError("URLs must be absolute http(s) URLs")
    return value


def parse_csv(value: str | None, *, lower: bool = False) -> list[str]:
    if not value:
        return []
    items: list[str] = []
    for raw_item in value.split(","):
        item = raw_item.strip()
        if lower:
            item = item.lower()
        if item and item not in items:
            items.append(item)
    return items


def title_from_source(source: Path) -> str:
    stem = re.sub(r"^\d{4}[-_ ]+", "", source.stem)
    words = re.sub(r"[-_]+", " ", stem).strip()
    return words or "untitled"


def canonical_source_suffix(source: Path) -> str:
    suffix = source.suffix.lower()
    return ".html" if suffix == ".htm" else suffix


def prompt_text(label: str, *, default: str | None = None, required: bool = False) -> str:
    suffix = f" [{default}]" if default is not None else ""
    while True:
        try:
            value = input(f"{label}{suffix}: ").strip()
        except EOFError as error:
            raise WritingError(
                "interactive draft input ended; rerun in a terminal or supply draft flags with --no-prompt"
            ) from error
        if value:
            return value
        if default is not None:
            return default
        if not required:
            return ""
        print(f"{label} is required.")


def prompt_choice(label: str, choices: tuple[str, ...], *, default: str) -> str:
    while True:
        value = prompt_text(f"{label} ({'/'.join(choices)})", default=default).lower()
        if value in choices:
            return value
        print(f"Choose one of: {', '.join(choices)}.")


def prompt_date(label: str, *, default: str) -> str:
    while True:
        value = prompt_text(label, default=default)
        if valid_date(value):
            return value
        print("Use YYYY-MM-DD.")


def prompt_number(label: str) -> float | None:
    while True:
        value = prompt_text(label)
        if not value:
            return None
        try:
            return float(value)
        except ValueError:
            print("Enter a number, or leave this blank.")


def prompt_yes_no(label: str, *, default: bool = False) -> bool:
    hint = "Y/n" if default else "y/N"
    while True:
        value = prompt_text(f"{label} [{hint}]").lower()
        if not value:
            return default
        if value in {"y", "yes"}:
            return True
        if value in {"n", "no"}:
            return False
        print("Enter y or n.")


def draft_arguments_supplied(arguments: argparse.Namespace) -> bool:
    value_names = (
        "source",
        "source_format",
        "blog",
        "title",
        "subtitle",
        "excerpt",
        "entry",
        "date",
        "location",
        "trip",
        "thread",
        "slug",
        "tags",
        "collections",
        "latitude",
        "longitude",
        "music_title",
        "music_album",
        "music_artist",
        "music_url",
    )
    return arguments.replace or any(getattr(arguments, name, None) is not None for name in value_names)


def collect_interactive_draft(arguments: argparse.Namespace, entry: str) -> None:
    print("guided draft — each answer populates post.json")
    entry_origin = "from --entry" if arguments.entry else "automatic"
    print(f'post.json "entry" ({entry_origin}): "{entry}"')
    arguments.blog = arguments.blog or prompt_choice(
        'post.json "blog"', BLOGS, default="sfi"
    )

    if arguments.source is None and arguments.source_format is None:
        existing = prompt_text(
            'post.json "source" — existing document path to copy (blank = create a new entry file)'
        )
        if existing:
            normalized_path = existing.strip().strip("\"'").replace("\\ ", " ")
            arguments.source = Path(normalized_path).expanduser()
        else:
            arguments.source_format = prompt_choice(
                'post.json "source" — new entry file format',
                BLANK_SOURCE_FORMATS,
                default="md",
            )

    default_title = "venture" if arguments.blog == "venture" else "scope for imagination"
    arguments.title = arguments.title or prompt_text(
        'post.json "title" — journal title', default=default_title
    )

    subtitle_default = title_from_source(arguments.source) if arguments.source else None
    if arguments.subtitle is None:
        arguments.subtitle = prompt_text(
            'post.json "subtitle" — entry title',
            default=subtitle_default,
            required=True,
        )
    if arguments.excerpt is None:
        arguments.excerpt = prompt_text('post.json "excerpt" — index/newsletter summary')
    if arguments.date is None:
        arguments.date = prompt_date(
            'post.json "date" (YYYY-MM-DD)', default=date.today().isoformat()
        )
    if arguments.location is None:
        arguments.location = prompt_text('post.json "location"')
    if arguments.tags is None:
        arguments.tags = prompt_text('post.json "tags" (comma-separated)')

    if arguments.blog == "venture":
        if arguments.trip is None:
            arguments.trip = prompt_text('post.json "trip" — Venture trip name')
        if arguments.thread is None:
            if arguments.trip:
                print(
                    f'post.json "thread" suggestion: {slugify(arguments.trip)} (optional)'
                )
            arguments.thread = prompt_text(
                'post.json "thread" — shared story slug (blank = standalone)'
            )
        if arguments.collections is None:
            arguments.collections = prompt_text(
                'post.json "collections" (comma-separated slugs)'
            )
        if arguments.latitude is None:
            arguments.latitude = prompt_number('post.json "latitude"')
        if arguments.longitude is None:
            arguments.longitude = prompt_number('post.json "longitude"')

    music_values = (
        arguments.music_title,
        arguments.music_album,
        arguments.music_artist,
        arguments.music_url,
    )
    include_music = any(value is not None for value in music_values)
    if not include_music:
        include_music = prompt_yes_no('post.json "music" — add a music tagline?')
    if include_music:
        if not arguments.music_title:
            arguments.music_title = prompt_text(
                'post.json "music.title" — song title', required=True
            )
        if arguments.music_album is None:
            arguments.music_album = prompt_text(
                'post.json "music.album" — album title (optional)'
            )
        if not arguments.music_artist:
            arguments.music_artist = prompt_text(
                'post.json "music.artist" — artist', required=True
            )
        if arguments.music_url is None:
            arguments.music_url = (
                prompt_text('post.json "music.url" — song URL (optional)') or None
            )


def blank_source_template(root: Path, source_format: str) -> str:
    relative = Path("writing") / "templates" / f"entry.{source_format}"
    candidates = (root / relative, PROJECT_ROOT / relative)
    for candidate in candidates:
        if candidate.is_file():
            return candidate.read_text(encoding="utf-8")
    raise WritingError(f"draft template is missing: {relative}")


def load_json_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise WritingError(f"file not found: {path}") from error
    except json.JSONDecodeError as error:
        raise WritingError(f"invalid JSON in {path}: {error}") from error
    if not isinstance(value, dict):
        raise WritingError(f"expected a JSON object in {path}")
    return value


def author_paths(root: Path) -> list[Path]:
    writing = root / "writing"
    return sorted(path for blog in BLOGS for path in (writing / blog).glob("*/post.json"))


def all_author_posts(root: Path, *, tolerate_invalid: bool = False) -> list[AuthorPost]:
    posts: list[AuthorPost] = []
    for path in author_paths(root):
        try:
            posts.append(AuthorPost(path, load_json_object(path)))
        except WritingError:
            if not tolerate_invalid:
                raise
    return posts


def entry_values_from_json(directory: Path) -> set[int]:
    values: set[int] = set()
    if not directory.exists():
        return values
    for path in directory.glob("*.json"):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(record, dict):
            entry = record.get("entry")
            if isinstance(entry, (str, int)) and str(entry).isdigit():
                values.add(int(entry))
        if path.stem.isdigit():
            values.add(int(path.stem))
    return values


def allocated_entries(root: Path) -> set[int]:
    values: set[int] = set()
    for path in author_paths(root):
        folder_match = re.match(r"^(\d{4})-", path.parent.name)
        if folder_match:
            values.add(int(folder_match.group(1)))
    for post in all_author_posts(root, tolerate_invalid=True):
        if post.entry.isdigit():
            values.add(int(post.entry))
    values |= entry_values_from_json(root / "content" / "scope-for-imagination" / "posts")
    values |= entry_values_from_json(root / "content" / "venture" / "entries")
    return values


def next_entry(root: Path) -> str:
    highest = max(allocated_entries(root), default=0)
    if highest >= 9999:
        raise WritingError("the four-digit entry sequence is exhausted")
    return str(highest + 1).zfill(4)


def path_from_target(target: str, root: Path) -> Path | None:
    candidate = Path(target).expanduser()
    possibilities = [candidate]
    if not candidate.is_absolute():
        possibilities.extend([Path.cwd() / candidate, root / candidate])
    for possibility in possibilities:
        resolved = possibility.resolve()
        if resolved.is_dir() and (resolved / "post.json").is_file():
            return resolved / "post.json"
        if resolved.is_file():
            if resolved.name == "post.json":
                return resolved
            for parent in resolved.parents:
                metadata_path = parent / "post.json"
                if metadata_path.is_file():
                    return metadata_path
                if parent == root:
                    break
    return None


def locate_post(target: str | None, root: Path) -> AuthorPost:
    if not target:
        # pnpm records the caller's directory in INIT_CWD even when it runs the
        # package script from the repository root.
        inference_directory = Path(os.environ.get("INIT_CWD", Path.cwd()))
        path = path_from_target(str(inference_directory), root)
        if path:
            return AuthorPost(path, load_json_object(path))
        raise WritingError("specify a post entry, slug, post folder, source path, or post.json path")

    target_path = path_from_target(target, root)
    if target_path:
        return AuthorPost(target_path, load_json_object(target_path))

    normalized_entry = target.zfill(4) if target.isdigit() and 0 < len(target) <= 4 else None
    matches = [
        post
        for post in all_author_posts(root)
        if (normalized_entry and post.entry == normalized_entry) or post.slug == target
    ]
    if not matches:
        raise WritingError(f"post not found: {target}")
    if len(matches) > 1:
        paths = ", ".join(relative_display(post.path, root) for post in matches)
        raise WritingError(f"post target is ambiguous: {target} ({paths})")
    return matches[0]


def create_music(arguments: argparse.Namespace) -> dict[str, str] | None:
    supplied = any(
        getattr(arguments, field) is not None
        for field in ("music_title", "music_album", "music_artist", "music_url")
    )
    if not supplied:
        return None
    if not arguments.music_title or not arguments.music_artist:
        raise WritingError("music requires both --music-title and --music-artist")
    music = {"title": arguments.music_title.strip(), "artist": arguments.music_artist.strip()}
    if arguments.music_album:
        music["album"] = arguments.music_album.strip()
    if arguments.music_url:
        music["url"] = arguments.music_url
    return music


def command_draft(arguments: argparse.Namespace, root: Path) -> int:
    entry = arguments.entry or next_entry(root)
    if arguments.source and arguments.source_format:
        raise WritingError("choose either --source or --format, not both")

    interactive = not arguments.no_prompt and (
        not draft_arguments_supplied(arguments) or sys.stdin.isatty()
    )
    if interactive:
        collect_interactive_draft(arguments, entry)

    arguments.blog = arguments.blog or "sfi"
    arguments.source_format = arguments.source_format or "md"
    arguments.date = arguments.date or date.today().isoformat()
    arguments.excerpt = arguments.excerpt or ""
    arguments.location = arguments.location or ""
    arguments.tags = arguments.tags or ""
    arguments.collections = arguments.collections or ""

    source_argument = arguments.source.expanduser().resolve() if arguments.source else None
    if source_argument:
        if not source_argument.is_file():
            raise WritingError(f"source document does not exist: {source_argument}")
        if source_argument.suffix.lower() not in SUPPORTED_SOURCE_SUFFIXES:
            supported = ", ".join(sorted(SUPPORTED_SOURCE_SUFFIXES))
            raise WritingError(f"source document must be one of: {supported}")

    subtitle = (arguments.subtitle or (title_from_source(source_argument) if source_argument else "untitled")).strip()
    slug = arguments.slug or f"{entry}-{slugify(subtitle)}-{arguments.date.replace('-', '')}"
    if not valid_post_slug(slug):
        raise WritingError("--slug must use NNNN-title-YYYYMMDD with lowercase letters, numbers, and hyphens")
    if not slug.startswith(f"{entry}-") or not slug.endswith(arguments.date.replace("-", "")):
        raise WritingError("--slug must begin with the entry and end with the publication date")
    if arguments.blog == "venture" and slug in RESERVED_VENTURE_SLUGS:
        raise WritingError(f"venture slug is reserved: {slug}")

    post_directory = root / "writing" / arguments.blog / slug
    metadata_path = post_directory / "post.json"
    if source_argument and arguments.replace and post_directory in source_argument.parents:
        raise WritingError(
            "--source cannot be inside the draft folder being replaced; copy it elsewhere first"
        )
    if int(entry) in allocated_entries(root):
        replacing_same_entry = False
        if arguments.replace and metadata_path.is_file():
            replacing_same_entry = load_json_object(metadata_path).get("entry") == entry
        if not replacing_same_entry:
            raise WritingError(f"entry {entry} is already allocated")
    if post_directory.exists() and not arguments.replace:
        raise WritingError(f"post folder already exists: {relative_display(post_directory, root)}")
    if arguments.replace and post_directory.exists():
        existing = load_json_object(metadata_path) if metadata_path.is_file() else None
        if existing and existing.get("status") == "published":
            raise WritingError("refusing to replace a published author folder")
        shutil.rmtree(post_directory)

    music = create_music(arguments)
    tags = parse_csv(arguments.tags, lower=True)
    if arguments.blog == "venture" and "venture" not in tags:
        tags.insert(0, "venture")
    collections = parse_csv(arguments.collections, lower=True)
    invalid_collections = sorted(collection for collection in collections if not valid_slug(collection))
    if invalid_collections:
        raise WritingError(f"collections must be lowercase, hyphenated slugs: {', '.join(invalid_collections)}")

    post_directory.mkdir(parents=True)
    images_directory = post_directory / "images"
    images_directory.mkdir()
    (images_directory / ".gitkeep").touch()

    if source_argument:
        source_name = f"entry{canonical_source_suffix(source_argument)}"
        shutil.copy2(source_argument, post_directory / source_name)
    else:
        source_name = f"entry.{arguments.source_format}"
        (post_directory / source_name).write_text(
            blank_source_template(root, arguments.source_format),
            encoding="utf-8",
        )

    metadata: dict[str, Any] = {
        "$schema": AUTHOR_SCHEMA,
        "source": source_name,
        "title": (arguments.title or ("venture" if arguments.blog == "venture" else "scope for imagination")).strip(),
        "subtitle": subtitle,
        "excerpt": arguments.excerpt.strip(),
        "entry": entry,
        "date": arguments.date,
        "time": "",
        "location": arguments.location.strip(),
        "trip": arguments.trip.strip() if arguments.trip else None,
        "thread": arguments.thread.strip() if arguments.thread else None,
        "slug": slug,
        "music": music,
        "tags": tags,
        "blog": arguments.blog,
        "collections": collections,
        "latitude": arguments.latitude,
        "longitude": arguments.longitude,
        "status": "draft",
    }
    write_json(metadata_path, metadata)

    print(f"created {relative_display(post_directory, root)}")
    entry_origin = "from --entry" if arguments.entry else "automatic"
    slug_origin = "from --slug" if arguments.slug else "automatic from entry + subtitle + date"
    print(f'post.json "entry" ({entry_origin}): "{entry}"')
    print(f'post.json "blog": "{arguments.blog}"')
    print(f'post.json "source" (automatic from import/format): "{source_name}"')
    print(f'post.json "slug" ({slug_origin}): "{slug}"')
    print('post.json "time" (stamped on first publish): ""')
    print('post.json "status": "draft"')
    print(f"write:  {relative_display(post_directory / source_name, root)}")
    print(f"review: pnpm writing review {entry}")
    return 0


def inline_markdown(value: str, image_web_root: str) -> str:
    """Render a deliberately small, safe subset of inline Markdown."""
    placeholders: list[str] = []

    def hold(rendered: str) -> str:
        placeholders.append(rendered)
        return f"\x00{len(placeholders) - 1}\x00"

    def image_replacement(match: re.Match[str]) -> str:
        alt, target = match.group(1), match.group(2).strip()
        if target.startswith("images/"):
            target = f"{image_web_root}/{target.removeprefix('images/')}"
        return hold(
            f'<img src="{html.escape(target, quote=True)}" alt="{html.escape(alt, quote=True)}" loading="lazy" />'
        )

    def link_replacement(match: re.Match[str]) -> str:
        label, target = match.group(1), match.group(2).strip()
        return hold(f'<a href="{html.escape(target, quote=True)}">{html.escape(label)}</a>')

    value = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", image_replacement, value)
    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link_replacement, value)
    escaped = html.escape(value)
    escaped = re.sub(r"`([^`]+)`", lambda match: f"<code>{match.group(1)}</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", escaped)
    for index, rendered in enumerate(placeholders):
        escaped = escaped.replace(f"\x00{index}\x00", rendered)
    return escaped


def markdown_to_html(source: str, image_web_root: str) -> str:
    # Template guidance and editorial notes live in HTML comments so authors
    # can keep a quick reference beside the draft without publishing it.
    source = re.sub(r"<!--.*?-->", "", source, flags=re.DOTALL)
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[str] = []
    paragraph: list[str] = []
    list_kind: str | None = None
    list_items: list[str] = []
    quote_lines: list[str] = []

    def flush_paragraph() -> None:
        if paragraph:
            rendered = "<br />".join(inline_markdown(line.strip(), image_web_root) for line in paragraph)
            blocks.append(f"<p>{rendered}</p>")
            paragraph.clear()

    def flush_list() -> None:
        nonlocal list_kind
        if list_kind:
            items = "".join(f"<li>{inline_markdown(item, image_web_root)}</li>" for item in list_items)
            blocks.append(f"<{list_kind}>{items}</{list_kind}>")
            list_items.clear()
            list_kind = None

    def flush_quote() -> None:
        if quote_lines:
            rendered = "<br />".join(inline_markdown(line, image_web_root) for line in quote_lines)
            blocks.append(f"<blockquote><p>{rendered}</p></blockquote>")
            quote_lines.clear()

    def flush_all() -> None:
        flush_paragraph()
        flush_list()
        flush_quote()

    index = 0
    while index < len(lines):
        raw_line = lines[index]
        line = raw_line.rstrip()
        heading = re.match(r"^(#{1,5})\s+(.+)$", line)
        unordered = re.match(r"^\s*[-*+]\s+(.+)$", line)
        ordered = re.match(r"^\s*\d+[.)]\s+(.+)$", line)
        quote = re.match(r"^\s*>\s?(.*)$", line)
        directive = re.match(r"^\s*:::\s*(center|callout)\s*$", line, flags=re.IGNORECASE)

        if directive:
            flush_all()
            kind = directive.group(1).lower()
            inner_lines: list[str] = []
            index += 1
            while index < len(lines) and not re.match(r"^\s*:::\s*$", lines[index]):
                inner_lines.append(lines[index])
                index += 1
            if index >= len(lines):
                raise WritingError(f"unclosed ::: {kind} block")
            inner = markdown_to_html("\n".join(inner_lines), image_web_root)
            tag = "div" if kind == "center" else "aside"
            class_name = "entry-centered" if kind == "center" else "entry-callout"
            blocks.append(f'<{tag} class="{class_name}">{inner}</{tag}>')
        elif not line.strip():
            flush_all()
        elif heading:
            flush_all()
            # The page itself owns h1, so source headings begin at h2.
            level = min(len(heading.group(1)) + 1, 6)
            blocks.append(f"<h{level}>{inline_markdown(heading.group(2), image_web_root)}</h{level}>")
        elif unordered or ordered:
            flush_paragraph()
            flush_quote()
            requested_kind = "ul" if unordered else "ol"
            if list_kind and list_kind != requested_kind:
                flush_list()
            list_kind = requested_kind
            list_items.append((unordered or ordered).group(1))
        elif quote:
            flush_paragraph()
            flush_list()
            quote_lines.append(quote.group(1))
        else:
            flush_list()
            flush_quote()
            paragraph.append(line)
        index += 1

    flush_all()
    return "\n".join(blocks).strip()


def rewrite_local_images(body_html: str, image_web_root: str) -> str:
    def replacement(match: re.Match[str]) -> str:
        prefix, quote, source = match.groups()
        if source.startswith("images/"):
            source = f"{image_web_root}/{source.removeprefix('images/')}"
        return f"{prefix}{quote}{source}{quote}"

    return re.sub(r"(\bsrc\s*=\s*)([\"'])([^\"']+)\2", replacement, body_html, flags=re.IGNORECASE)


def render_source(post: AuthorPost, image_directory: Path, image_web_root: str) -> str:
    source_path = post.source_path
    if source_path is None:
        raise WritingError("source is null; add a supported source document before publishing")
    suffix = source_path.suffix.lower()
    if suffix not in SUPPORTED_SOURCE_SUFFIXES:
        raise WritingError(f"unsupported source type: {suffix or '(none)'}")
    if not source_path.is_file():
        raise WritingError(f"source file does not exist: {source_path}")

    if suffix == ".docx":
        body_from_docx, _ = legacy_renderers()
        docx_images = image_directory / "docx"
        body = body_from_docx(source_path, docx_images, f"{image_web_root}/docx")
    else:
        source = source_path.read_text(encoding="utf-8")
        if suffix in {".html", ".htm"}:
            _, body_from_html = legacy_renderers()
            body = body_from_html(source)
        else:
            body = markdown_to_html(source, image_web_root)
    # Editorial comments should never leak into generated public HTML or make
    # commented-out image examples look like live, missing assets at review.
    body = re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL)
    return rewrite_local_images(body.strip(), image_web_root)


def legacy_renderers() -> tuple[Callable[..., str], Callable[[str], str]]:
    """Load the preserved Word/HTML renderers without creating tracked bytecode."""
    sys.dont_write_bytecode = True
    try:
        from sfi_blogpost import body_from_docx as docx_renderer, body_from_html as html_renderer
    except ImportError:  # Imported as scripts.writing by a test or another tool.
        from scripts.sfi_blogpost import body_from_docx as docx_renderer, body_from_html as html_renderer
    return docx_renderer, html_renderer


def local_image_references(source: str) -> list[str]:
    references = re.findall(r"!\[[^\]]*\]\((images/[^)]+)\)", source)
    references += re.findall(r"\bsrc\s*=\s*[\"'](images/[^\"']+)[\"']", source, flags=re.IGNORECASE)
    return sorted(set(reference.strip() for reference in references))


def placeholder_matches(value: str) -> list[str]:
    matches: list[str] = []
    patterns = (
        # Markdown links have already rendered to HTML by this point, so any
        # remaining brackets deserve explicit human attention. A bracketed
        # citation may be intentional; leaking an editorial prompt is worse.
        r"\[[^\]\n]+\]",
        r"\b(?:TODO|TBD|FIXME)\b",
        r"\bTK\b",
    )
    for pattern in patterns:
        for match in re.finditer(pattern, value, flags=re.IGNORECASE):
            if match.group(0) not in matches:
                matches.append(match.group(0))
    return matches


def duplicate_author_issues(post: AuthorPost, root: Path) -> list[str]:
    issues: list[str] = []
    posts = all_author_posts(root, tolerate_invalid=True)
    same_entry_paths = {candidate.path for candidate in posts if candidate.entry == post.entry}
    same_slug_paths = {candidate.path for candidate in posts if candidate.slug == post.slug}
    # Folder names remain useful collision evidence even when another post.json
    # is malformed and therefore cannot be loaded as an AuthorPost.
    same_entry_paths.update(
        path for path in author_paths(root) if path.parent.name.startswith(f"{post.entry}-")
    )
    same_slug_paths.update(path for path in author_paths(root) if path.parent.name == post.slug)
    if len(same_entry_paths) > 1:
        issues.append(
            f"entry {post.entry} is duplicated in "
            + ", ".join(relative_display(path, root) for path in sorted(same_entry_paths))
        )
    if len(same_slug_paths) > 1:
        issues.append(
            f"slug {post.slug!r} is duplicated in "
            + ", ".join(relative_display(path, root) for path in sorted(same_slug_paths))
        )
    return issues


def generated_collision_issues(post: AuthorPost, root: Path) -> list[str]:
    issues: list[str] = []
    expected_paths = {
        root / "content" / "scope-for-imagination" / "posts" / f"{post.entry}.json",
    }
    if post.blog == "venture":
        expected_paths.add(root / "content" / "venture" / "entries" / f"{post.slug}.json")

    reported_paths: set[Path] = set()
    if post.metadata.get("status") != "published":
        for expected_path in expected_paths:
            if expected_path.exists():
                issues.append(f"generated path already exists at {relative_display(expected_path, root)}")
                reported_paths.add(expected_path)

    generated_directories = (
        root / "content" / "scope-for-imagination" / "posts",
        root / "content" / "venture" / "entries",
    )
    for directory in generated_directories:
        if not directory.exists():
            continue
        for path in directory.glob("*.json"):
            try:
                generated = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(generated, dict):
                continue
            same_entry = str(generated.get("entry") or "") == post.entry
            same_slug = str(generated.get("slug") or "") == post.slug
            if not (same_entry or same_slug):
                continue
            generated_entry = generated.get("entry")
            generated_slug = generated.get("slug")
            expected_values_match = (
                (generated_entry is None or generated_entry == "" or same_entry)
                and (generated_slug is None or generated_slug == "" or same_slug)
            )
            is_expected_published_output = (
                post.metadata.get("status") == "published"
                and path in expected_paths
                and expected_values_match
            )
            if not is_expected_published_output and path not in reported_paths:
                collision = "entry and slug" if same_entry and same_slug else "entry" if same_entry else "slug"
                issues.append(
                    f"{collision} already exists at {relative_display(path, root)}"
                )
    return issues


def review_post(post: AuthorPost, root: Path, *, publishing: bool = False) -> ReviewResult:
    metadata = post.metadata
    blockers: list[str] = []
    notes: list[str] = []

    missing_keys = sorted(REQUIRED_AUTHOR_KEYS - set(metadata))
    unknown_keys = sorted(set(metadata) - REQUIRED_AUTHOR_KEYS)
    if missing_keys:
        blockers.append(f"missing metadata fields: {', '.join(missing_keys)}")
    if unknown_keys:
        blockers.append(f"unsupported metadata fields: {', '.join(unknown_keys)}")
    if metadata.get("$schema") != AUTHOR_SCHEMA:
        blockers.append(f"$schema must be {AUTHOR_SCHEMA!r}")

    for field in ("title", "subtitle", "excerpt", "entry", "date", "location", "slug", "blog", "status"):
        if not isinstance(metadata.get(field), str) or not str(metadata.get(field)).strip():
            blockers.append(f"{field} must be a non-empty string")

    entry = metadata.get("entry")
    if not isinstance(entry, str) or not re.fullmatch(r"\d{4}", entry) or entry == "0000":
        blockers.append("entry must be a four-digit string from 0001 through 9999")
    if isinstance(metadata.get("date"), str) and metadata["date"].strip() and not valid_date(metadata["date"]):
        blockers.append("date must use YYYY-MM-DD")
    publication_time = metadata.get("time")
    if publication_time is not None and publication_time != "" and not valid_time(publication_time):
        blockers.append("time must be blank while drafting or use 24-hour HH:MM")
    elif metadata.get("status") == "published" and not valid_time(publication_time):
        blockers.append("published posts require a 24-hour HH:MM time")
    elif metadata.get("status") == "draft" and not publishing:
        if valid_time(publication_time):
            notes.append("time: the existing draft value will be replaced on first publish")
        else:
            notes.append("time: will be stamped on first publish")
    if not valid_post_slug(metadata.get("slug")):
        blockers.append("slug must use NNNN-title-YYYYMMDD with lowercase letters, numbers, and hyphens")
    if metadata.get("blog") not in BLOGS:
        blockers.append("blog must be sfi or venture")
    if metadata.get("status") not in STATUSES:
        blockers.append("status must be draft or published")

    expected_blog = post.path.parent.parent.name
    expected_slug = post.directory.name
    if metadata.get("blog") != expected_blog:
        blockers.append(f"blog must match its writing/{expected_blog}/ folder")
    if metadata.get("slug") != expected_slug:
        blockers.append(f"slug must match its folder name {expected_slug!r}")
    if isinstance(entry, str) and isinstance(metadata.get("slug"), str):
        if not str(metadata["slug"]).startswith(f"{entry}-"):
            blockers.append("slug must begin with the post entry")
        if valid_date(metadata.get("date")) and not str(metadata["slug"]).endswith(
            str(metadata["date"]).replace("-", "")
        ):
            blockers.append("slug must end with the post date as YYYYMMDD")
    if metadata.get("blog") == "venture" and metadata.get("slug") in RESERVED_VENTURE_SLUGS:
        blockers.append(f"venture slug is reserved: {metadata.get('slug')}")

    for optional_field in ("trip", "thread"):
        value = metadata.get(optional_field)
        if value is not None and (not isinstance(value, str) or not value.strip()):
            blockers.append(f"{optional_field} must be null or a non-empty string")
    if isinstance(metadata.get("thread"), str) and metadata["thread"].strip() and not valid_slug(metadata["thread"]):
        blockers.append("thread must contain lowercase letters, numbers, and single hyphens")

    tags = metadata.get("tags")
    if not isinstance(tags, list) or not tags:
        blockers.append("tags must be a non-empty list")
    elif not all(isinstance(tag, str) and tag.strip() for tag in tags):
        blockers.append("tags must contain only non-empty strings")
    elif len(tags) != len(set(tags)):
        blockers.append("tags must not contain duplicates")

    collections = metadata.get("collections")
    if not isinstance(collections, list):
        blockers.append("collections must be a list")
    elif not all(valid_slug(collection) for collection in collections):
        blockers.append("collections must contain only lowercase, hyphenated slugs")
    elif len(collections) != len(set(collections)):
        blockers.append("collections must not contain duplicates")
    elif not collections:
        notes.append("collections: none")

    if metadata.get("blog") == "venture":
        if not isinstance(tags, list) or "venture" not in tags:
            blockers.append("venture posts must include the venture tag")
        if not isinstance(metadata.get("trip"), str) or not str(metadata.get("trip")).strip():
            blockers.append("venture posts require a trip")

    for field, minimum, maximum in (("latitude", -90, 90), ("longitude", -180, 180)):
        value = metadata.get(field)
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not minimum <= value <= maximum):
            blockers.append(f"{field} must be null or a number from {minimum} through {maximum}")
        if metadata.get("blog") == "venture" and (
            value is None or isinstance(value, bool) or not isinstance(value, (int, float))
        ):
            blockers.append(f"venture posts require {field}")

    music = metadata.get("music")
    if music is not None:
        if not isinstance(music, dict):
            blockers.append("music must be null or an object")
        else:
            unknown_music = sorted(set(music) - MUSIC_KEYS)
            if unknown_music:
                blockers.append(f"music contains unsupported fields: {', '.join(unknown_music)}")
            for field in ("title", "artist"):
                if not isinstance(music.get(field), str) or not str(music.get(field)).strip():
                    blockers.append(f"music.{field} must be a non-empty string")
            for field in ("album", "url"):
                if field in music and (not isinstance(music[field], str) or not music[field].strip()):
                    blockers.append(f"music.{field} must be omitted or a non-empty string")
            if "url" in music and isinstance(music.get("url"), str) and not is_http_url(music["url"]):
                blockers.append("music.url must be an absolute http(s) URL")

    source = metadata.get("source")
    source_is_safe = False
    if source is not None and (not isinstance(source, str) or not source.strip()):
        blockers.append("source must be null or a non-empty relative path")
    if isinstance(source, str) and source.strip():
        pure_source = PurePosixPath(source)
        if pure_source.is_absolute() or ".." in pure_source.parts or str(pure_source) != source:
            blockers.append("source must be a normalized relative path inside the post folder")
        elif pure_source.suffix.lower() not in SUPPORTED_SOURCE_SUFFIXES:
            blockers.append("source must be a .docx, .html, .htm, .txt, or .md document")
        elif not post.source_path or not post.source_path.is_file():
            blockers.append(f"source file is missing: {source}")
        else:
            source_is_safe = True
    else:
        blockers.append("source is empty; select a source document before review")

    blockers.extend(duplicate_author_issues(post, root))
    blockers.extend(generated_collision_issues(post, root))

    body_html: str | None = None
    if source_is_safe and post.source_path:
        try:
            with tempfile.TemporaryDirectory(prefix="writing-review-") as temporary:
                body_html = render_source(post, Path(temporary), "/images/posts/review")
        except Exception as error:
            blockers.append(f"source could not be rendered: {error}")
        if body_html is not None:
            if not re.sub(r"<[^>]+>", "", body_html).strip():
                blockers.append("rendered post body is empty")
            if re.search(r"<script\b", body_html, flags=re.IGNORECASE):
                blockers.append("post body contains a script tag")
            prompts = placeholder_matches(html.unescape(re.sub(r"<[^>]+>", " ", body_html)))
            if prompts:
                samples = ", ".join(repr(prompt) for prompt in prompts[:3])
                blockers.append(f"post body still contains draft placeholders: {samples}")

            if post.source_path.suffix.lower() != ".docx":
                source_text = post.source_path.read_text(encoding="utf-8")
                source_text = re.sub(r"<!--.*?-->", "", source_text, flags=re.DOTALL)
                for reference in local_image_references(source_text):
                    pure_reference = PurePosixPath(reference)
                    if pure_reference.is_absolute() or ".." in pure_reference.parts:
                        blockers.append(f"referenced image must stay inside images/: {reference}")
                        continue
                    local_path = post.directory / pure_reference
                    if not local_path.is_file():
                        blockers.append(f"referenced image is missing: {reference}")

    plain_body = html.unescape(re.sub(r"<[^>]+>", " ", body_html or ""))
    words = re.findall(r"\b[\w’'-]+\b", plain_body)
    result = ReviewResult(
        post=post,
        blockers=blockers,
        notes=notes,
        body_html=body_html,
        word_count=len(words),
        image_count=len(re.findall(r"<img\b", body_html or "", flags=re.IGNORECASE)),
        heading_count=len(re.findall(r"<h[2-6]\b", body_html or "", flags=re.IGNORECASE)),
        link_count=len(re.findall(r"<a\b", body_html or "", flags=re.IGNORECASE)),
    )
    return result


def print_review(result: ReviewResult, root: Path) -> None:
    metadata = result.post.metadata
    print(f"review · {result.post.entry or '????'} · {metadata.get('blog', '?')} · {metadata.get('subtitle', '')}")
    print(f"record: {relative_display(result.post.path, root)}")
    print(
        "source: "
        + (relative_display(result.post.source_path, root) if result.post.source_path else "none")
    )
    print(
        "body: "
        f"{result.word_count} words · {result.heading_count} headings · "
        f"{result.image_count} images · {result.link_count} links"
    )
    for note in result.notes:
        print(f"note: {note}")
    if result.blockers:
        print(f"blockers ({len(result.blockers)}):")
        for blocker in result.blockers:
            print(f"  - {blocker}")
    else:
        print("ready to publish")


def command_review(arguments: argparse.Namespace, root: Path) -> int:
    result = review_post(locate_post(arguments.target, root), root)
    print_review(result, root)
    return 0 if result.ok else 1


def display_date(value: str) -> str:
    year, month, day = value.split("-")
    return f"{int(month)}.{int(day)}.{year[-2:]}"


def music_line(music: object, *, rendered_html: bool) -> str:
    if not isinstance(music, dict):
        return ""
    title = str(music.get("title") or "").strip()
    artist = str(music.get("artist") or "").strip()
    url = str(music.get("url") or "").strip()
    if not title or not artist:
        return ""
    if rendered_html:
        label = f"<em>{html.escape(title)}</em>, {html.escape(artist)}"
        if is_http_url(url):
            label = f'<a href="{html.escape(url, quote=True)}">{label}</a>'
        return f"<p>{label}</p>"
    line = f"{title}, {artist}"
    return f"{line} — {url}" if is_http_url(url) else line


def newsletter_for_post(post: dict[str, Any]) -> dict[str, str]:
    entry = str(post["entry"])
    title = str(post["title"])
    subtitle = str(post["subtitle"])
    path = f"/venture/{post['slug']}" if post.get("blog") == "venture" else f"/scope-for-imagination/{entry}"
    subject = f"{title}: {subtitle}"
    preview = str(post.get("excerpt") or f"A new Scope for Imagination entry: {subtitle}")[:160]
    url_placeholder = "[[ENTRY_URL]]"
    unsubscribe = "{{{RESEND_UNSUBSCRIBE_URL}}}"
    details = f"{display_date(str(post['date']))} • {post['location']} • {entry}"
    music_html = music_line(post.get("music"), rendered_html=True)
    music_text = music_line(post.get("music"), rendered_html=False)
    email_html = (
        "<p>Hello {{{contact.first_name|there}}},</p>"
        "<p>There is a new entry in <em>Scope for Imagination</em>.</p>"
        f"<h1>{html.escape(title)}</h1>"
        f"<p><em>{html.escape(subtitle)}</em></p>"
        f"<p>{html.escape(details)}</p>"
        f"{music_html}"
        f'<p><a href="{url_placeholder}">Read entry {entry} →</a></p>'
        f'<p><small><a href="{unsubscribe}">Unsubscribe</a></small></p>'
    )
    text_details = f"{details}\n{music_text}" if music_text else details
    email_text = (
        "Hello {{{contact.first_name|there}}},\n\n"
        "There is a new entry in Scope for Imagination.\n\n"
        f"{subject}\n{text_details}\n\n"
        f"Read entry {entry}: {url_placeholder}\n\n"
        f"Unsubscribe: {unsubscribe}\n"
    )
    return {
        "entry": entry,
        "path": path,
        "name": f"SFI {entry}: {subtitle}",
        "subject": subject,
        "previewText": preview,
        "html": email_html,
        "text": email_text,
    }


def published_record(metadata: dict[str, Any], body_html: str, schema: str) -> dict[str, Any]:
    record = {key: value for key, value in metadata.items() if key != "source"}
    record["$schema"] = schema
    record["status"] = "published"
    record["bodyHtml"] = body_html
    return record


def author_images(post: AuthorPost) -> Iterable[Path]:
    directory = post.directory / "images"
    if not directory.exists():
        return []
    return (path for path in directory.rglob("*") if path.is_file() and path.name != ".gitkeep")


def copy_author_images(post: AuthorPost, destination: Path) -> int:
    count = 0
    source_root = post.directory / "images"
    for source in author_images(post):
        relative = source.relative_to(source_root)
        output = destination / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, output)
        count += 1
    return count


def publish_conflicts(post: AuthorPost, root: Path) -> list[Path]:
    paths = [
        root / "content" / "scope-for-imagination" / "posts" / f"{post.entry}.json",
        root / "content" / "scope-for-imagination" / "newsletters" / f"{post.entry}.json",
        root / "public" / "images" / "posts" / post.slug,
    ]
    if post.blog == "venture":
        paths.append(root / "content" / "venture" / "entries" / f"{post.slug}.json")
    return [path for path in paths if path.exists()]


def command_publish(arguments: argparse.Namespace, root: Path) -> int:
    author_post = locate_post(arguments.target, root)
    publish_metadata = dict(author_post.metadata)
    existing_time = publish_metadata.get("time")
    if publish_metadata.get("status") != "published" or not valid_time(existing_time):
        publish_metadata["time"] = current_publication_time()
    post = AuthorPost(author_post.path, publish_metadata)
    result = review_post(post, root, publishing=True)
    print_review(result, root)
    if not result.ok or result.body_html is None:
        print("publish stopped: resolve the review blockers first", file=sys.stderr)
        return 1

    conflicts = publish_conflicts(post, root)
    if conflicts and not arguments.replace:
        print("publish stopped: generated output already exists:", file=sys.stderr)
        for path in conflicts:
            print(f"  - {relative_display(path, root)}", file=sys.stderr)
        print("pass --replace after reviewing the existing output", file=sys.stderr)
        return 1

    print()
    print("publish summary")
    print(f"  entry: {post.entry}")
    print(f"  blog: {post.blog} (and scope for imagination)")
    print(f"  slug: {post.slug}")
    print(f"  title: {post.metadata.get('title')}: {post.metadata.get('subtitle')}")
    print(f"  date: {post.metadata.get('date')} {post.metadata.get('time')}")
    print(f"  replace: {'yes' if conflicts else 'no'}")
    if arguments.dry_run:
        print("dry run: no files changed")
        return 0
    if not arguments.yes:
        try:
            answer = input("Publish this post? [y/N] ").strip().lower()
        except EOFError:
            answer = ""
        if answer not in {"y", "yes"}:
            print("publish cancelled")
            return 1

    public_images = root / "public" / "images" / "posts" / post.slug
    public_images.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f".{post.slug}-", dir=public_images.parent) as temporary:
        staged_images = Path(temporary)
        copied_images = copy_author_images(post, staged_images)
        body_html = render_source(post, staged_images, f"/images/posts/{post.slug}")

        sfi_record = published_record(post.metadata, body_html, "../post.schema.json")
        venture_record = published_record(post.metadata, body_html, "../entry.schema.json")
        newsletter = newsletter_for_post(sfi_record)

        sfi_path = root / "content" / "scope-for-imagination" / "posts" / f"{post.entry}.json"
        newsletter_path = root / "content" / "scope-for-imagination" / "newsletters" / f"{post.entry}.json"
        venture_path = root / "content" / "venture" / "entries" / f"{post.slug}.json"

        if public_images.exists():
            shutil.rmtree(public_images)
        if any(staged_images.iterdir()):
            shutil.copytree(staged_images, public_images)

        write_json(sfi_path, sfi_record)
        if post.blog == "venture":
            write_json(venture_path, venture_record)
        write_json(newsletter_path, newsletter)

    updated_metadata = dict(post.metadata)
    updated_metadata["status"] = "published"
    write_json(author_post.path, updated_metadata)

    print(f"published {relative_display(sfi_path, root)}")
    if post.blog == "venture":
        print(f"published {relative_display(venture_path, root)}")
    print(f"created {relative_display(newsletter_path, root)}")
    print(f"images: {copied_images} author images plus any embedded document images")
    print(f"url: /scope-for-imagination/{post.entry}")
    if post.blog == "venture":
        print(f"venture url: /venture/{post.slug}")
    return 0


def command_newsletter(arguments: argparse.Namespace, root: Path) -> int:
    post = locate_post(arguments.target, root)
    published = root / "content" / "scope-for-imagination" / "posts" / f"{post.entry}.json"
    newsletter = root / "content" / "scope-for-imagination" / "newsletters" / f"{post.entry}.json"
    if post.metadata.get("status") != "published" or not published.is_file() or not newsletter.is_file():
        raise WritingError(f"entry {post.entry} is not published; run `pnpm writing publish {post.entry}` first")

    action = "send" if arguments.send else "create a Resend draft for"
    print(f"newsletter: {action} entry {post.entry}")
    template = load_json_object(newsletter)
    print(f"subject: {template.get('subject') or '(missing)'}")
    print(f"preview: {template.get('previewText') or '(missing)'}")
    print(f"path: {template.get('path') or f'/scope-for-imagination/{post.entry}'}")
    if arguments.dry_run:
        print("dry run: Resend was not called")
        return 0
    if arguments.send and not arguments.yes:
        try:
            answer = input(f"Send newsletter for entry {post.entry} now? [y/N] ").strip().lower()
        except EOFError:
            answer = ""
        if answer not in {"y", "yes"}:
            print("send cancelled")
            return 1

    command = [sys.executable, str(root / "scripts" / "sfi_newsletter.py"), f"--entry={post.entry}"]
    if arguments.send:
        command.append("--send")
    completed = subprocess.run(command, cwd=root, check=False)
    return completed.returncode


def add_music_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--music-title", help="optional song title")
    parser.add_argument("--music-album", help="optional album title")
    parser.add_argument("--music-artist", help="artist for --music-title")
    parser.add_argument("--music-url", type=url_argument, help="optional absolute http(s) music URL")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pnpm writing",
        description="Unified authoring for Scope for Imagination and Venture.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(os.environ.get("WRITING_PROJECT_ROOT", PROJECT_ROOT)),
        help=argparse.SUPPRESS,
    )
    commands = parser.add_subparsers(dest="command", required=True)

    draft = commands.add_parser("draft", help="initialize a post, optionally from an existing document")
    draft.add_argument("--source", type=Path, help="copy an existing .docx, .html, .htm, .txt, or .md document")
    draft.add_argument("--format", dest="source_format", choices=BLANK_SOURCE_FORMATS, help="new entry format; defaults to md")
    draft.add_argument("--blog", choices=BLOGS)
    draft.add_argument("--title", help="defaults to scope for imagination, or venture for Venture posts")
    draft.add_argument("--subtitle", help="defaults to the source filename")
    draft.add_argument("--excerpt")
    draft.add_argument("--entry", type=normalize_entry, help="defaults to the next global entry")
    draft.add_argument("--date", type=date_argument)
    draft.add_argument("--location")
    draft.add_argument("--trip")
    draft.add_argument("--thread")
    draft.add_argument("--slug", help="defaults to ENTRY-subtitle-YYYYMMDD")
    draft.add_argument("--tags", help="comma-separated manual tags")
    draft.add_argument("--collections", help="comma-separated Venture collections")
    draft.add_argument("--latitude", "--lat", dest="latitude", type=float)
    draft.add_argument("--longitude", "--lon", dest="longitude", type=float)
    draft.add_argument("--replace", action="store_true", help="replace an unpublished folder with this slug")
    draft.add_argument("--no-prompt", action="store_true", help="use flags/defaults without interactive questions")
    add_music_arguments(draft)

    review = commands.add_parser("review", help="run the metadata and body review checklist")
    review.add_argument("target", nargs="?", help="entry, slug, post folder, source, or post.json")

    publish = commands.add_parser("publish", help="review and generate site content")
    publish.add_argument("target", nargs="?", help="entry, slug, post folder, source, or post.json")
    publish.add_argument("--yes", action="store_true", help="confirm publication non-interactively")
    publish.add_argument("--dry-run", action="store_true", help="review and show the publish plan without writing")
    publish.add_argument("--replace", action="store_true", help="replace generated output")

    newsletter = commands.add_parser("newsletter", help="create a Resend draft or explicitly send it")
    newsletter.add_argument("target", help="entry, slug, post folder, source, or post.json")
    newsletter.add_argument("--send", action="store_true", help="send immediately instead of creating a draft")
    newsletter.add_argument("--yes", action="store_true", help="confirm --send non-interactively")
    newsletter.add_argument("--dry-run", action="store_true", help="show the action without calling Resend")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    arguments = parser.parse_args(argv)
    root = arguments.root.expanduser().resolve()
    handlers = {
        "draft": command_draft,
        "review": command_review,
        "publish": command_publish,
        "newsletter": command_newsletter,
    }
    try:
        return handlers[arguments.command](arguments, root)
    except WritingError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
