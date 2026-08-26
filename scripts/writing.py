#!/usr/bin/env python3
"""Draft, preview, review, publish, withdraw, and announce unified SFI posts.

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
import webbrowser
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Iterator
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AUTHOR_SCHEMA = "../../post.schema.json"
SUPPORTED_SOURCE_SUFFIXES = {".docx", ".html", ".htm", ".txt", ".md"}
AUTHOR_SOURCE_SUFFIXES = {".html", ".txt", ".md"}
BLANK_SOURCE_FORMATS = ("md", "html", "txt")
CANONICAL_ENTRY_SOURCE_NAMES = {"entry.html", "entry.txt", "entry.md"}
BLOGS = ("sfi", "venture")
STATUSES = ("draft", "unpublished", "published")
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


class TransactionError(WritingError):
    """A failed file transaction, optionally with retained recovery files."""

    def __init__(self, message: str, *, recovery_required: bool = False) -> None:
        super().__init__(message)
        self.recovery_required = recovery_required


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


@contextmanager
def staged_action_directory(root: Path, prefix: str) -> Iterator[Path]:
    """Clean staging normally but retain it after an incomplete rollback."""
    action_root = Path(tempfile.mkdtemp(prefix=prefix, dir=root))
    try:
        yield action_root
    except TransactionError as error:
        if not error.recovery_required:
            shutil.rmtree(action_root, ignore_errors=True)
        raise
    except BaseException:
        shutil.rmtree(action_root, ignore_errors=True)
        raise
    else:
        shutil.rmtree(action_root, ignore_errors=True)


def slugify(value: str) -> str:
    normalized = value.strip().lower().replace("’", "'")
    normalized = re.sub(r"['`]", "", normalized)
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    return normalized.strip("-") or "untitled"


def automatic_post_slug(
    entry: str,
    title: str,
    subtitle: str,
    date_digits: str,
) -> str:
    """Build the standard entry + title + subtitle + date author slug."""
    return f"{entry}-{slugify(f'{title} {subtitle}')}-{date_digits}"


def upgraded_draft_slug(post: AuthorPost) -> str:
    """Upgrade only a recognizable legacy subtitle-only draft slug."""
    if post.metadata.get("status") != "draft" or not valid_post_slug(post.slug):
        return post.slug
    date_digits = post.slug[-8:]
    title = str(post.metadata.get("title") or "").strip()
    subtitle = str(post.metadata.get("subtitle") or "").strip()
    legacy = f"{post.entry}-{slugify(subtitle)}-{date_digits}"
    if post.slug != legacy or not title or not subtitle:
        return post.slug
    return automatic_post_slug(post.entry, title, subtitle, date_digits)


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


def current_draft_date() -> str:
    return date.today().isoformat()


def current_publication_stamp() -> tuple[str, str]:
    """Return one local clock reading as an ISO date and 24-hour time."""
    now = datetime.now()
    return now.date().isoformat(), now.strftime("%H:%M")


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


def author_source_name(source: Path, slug: str) -> str:
    """Choose the active author filename for an imported document."""
    if source.suffix.lower() == ".docx":
        return f"{slug}.html"
    return f"entry{canonical_source_suffix(source)}"


def valid_author_source_name(value: object, slug: object) -> bool:
    if not isinstance(value, str) or not isinstance(slug, str):
        return False
    return value in CANONICAL_ENTRY_SOURCE_NAMES or (
        valid_post_slug(slug) and value == f"{slug}.html"
    )


def editable_html_document(body_html: str, title: str, subtitle: str) -> str:
    """Wrap converted Word body markup in a friendly, editable HTML file."""
    indented_body = "\n".join(
        f"  {line}" if line else "" for line in body_html.strip().splitlines()
    )
    document_title = f"{title}: {subtitle}" if subtitle else title
    return (
        "<!doctype html>\n"
        '<html lang="en">\n'
        "<head>\n"
        '  <meta charset="utf-8" />\n'
        '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n'
        f"  <title>{html.escape(document_title)}</title>\n"
        "</head>\n"
        "<body>\n"
        "  <!-- Edit the post markup inside <body>. The website supplies the page header and styling. -->\n"
        f"{indented_body}\n"
        "</body>\n"
        "</html>\n"
    )


def convert_docx_to_author_html(
    document: Path,
    output: Path,
    image_directory: Path,
    *,
    title: str,
    subtitle: str,
) -> int:
    """Convert Word content into editable author HTML with durable local images."""
    body_from_docx, _ = legacy_renderers()
    body_html = body_from_docx(document, image_directory, "images/docx")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        editable_html_document(body_html, title, subtitle), encoding="utf-8"
    )
    return (
        sum(1 for path in image_directory.rglob("*") if path.is_file())
        if image_directory.exists()
        else 0
    )


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
        "music_artist",
        "music_album",
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
    if arguments.location is None:
        arguments.location = prompt_text('post.json "location"')
    if arguments.tags is None:
        arguments.tags = prompt_text('post.json "tags" (comma-separated)')

    if arguments.trip is None:
        arguments.trip = prompt_text(
            'post.json "trip" — trip or grouping name (blank = none)'
        )
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

    if arguments.blog == "venture":
        if arguments.latitude is None:
            arguments.latitude = prompt_number('post.json "latitude"')
        if arguments.longitude is None:
            arguments.longitude = prompt_number('post.json "longitude"')

    music_values = (
        arguments.music_title,
        arguments.music_artist,
        arguments.music_album,
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
        if not arguments.music_artist:
            arguments.music_artist = prompt_text(
                'post.json "music.artist" — artist', required=True
            )
        if arguments.music_album is None:
            arguments.music_album = prompt_text(
                'post.json "music.album" — album title (optional)'
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


def assert_managed_author_post(post: AuthorPost, root: Path) -> AuthorPost:
    """Require a canonical author record before a command may mutate files."""
    if post.blog not in BLOGS:
        raise WritingError("post blog must be sfi or venture")
    if not valid_post_slug(post.slug) or not re.fullmatch(r"\d{4}", post.entry):
        raise WritingError("post entry or slug is invalid")
    if not post.slug.startswith(f"{post.entry}-"):
        raise WritingError("post slug must begin with its entry number")

    expected = root / "writing" / post.blog / post.slug / "post.json"
    try:
        actual_resolved = post.path.resolve(strict=True)
        expected_resolved = expected.resolve(strict=True)
    except OSError as error:
        raise WritingError(f"author record cannot be resolved safely: {error}") from error
    if actual_resolved != expected_resolved:
        raise WritingError(
            "refusing to modify an author record outside "
            f"writing/{post.blog}/{post.slug}/post.json"
        )
    if post.path.is_symlink() or post.directory.is_symlink():
        raise WritingError("refusing to modify a symlinked author record or post folder")
    return post


def locate_managed_entry(entry: str, root: Path) -> AuthorPost:
    """Resolve one explicitly numbered entry to its managed author record."""
    return assert_managed_author_post(locate_post(entry, root), root)


def create_music(arguments: argparse.Namespace) -> dict[str, str] | None:
    supplied = any(
        getattr(arguments, field) is not None
        for field in ("music_title", "music_artist", "music_album", "music_url")
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
    arguments.date = arguments.date or ""
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

    title = (
        arguments.title
        or ("venture" if arguments.blog == "venture" else "scope for imagination")
    ).strip()
    subtitle = (arguments.subtitle or (title_from_source(source_argument) if source_argument else "untitled")).strip()
    if arguments.slug and not arguments.date:
        raise WritingError("--slug requires --date because undated draft slugs are provisional")
    slug_date = arguments.date or current_draft_date()
    slug = arguments.slug or automatic_post_slug(
        entry, title, subtitle, slug_date.replace("-", "")
    )
    if not valid_post_slug(slug):
        raise WritingError(
            "--slug must use NNNN-title-subtitle-YYYYMMDD with lowercase "
            "letters, numbers, and hyphens"
        )
    if not slug.startswith(f"{entry}-") or not slug.endswith(slug_date.replace("-", "")):
        raise WritingError("--slug must begin with the entry and end with the selected date")
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
    replacing_existing = arguments.replace and post_directory.exists()
    if replacing_existing:
        existing = load_json_object(metadata_path) if metadata_path.is_file() else None
        if existing and existing.get("status") != "draft":
            raise WritingError("refusing to replace an author folder that has been published")

    music = create_music(arguments)
    tags = parse_csv(arguments.tags, lower=True)
    if arguments.blog == "venture" and "venture" not in tags:
        tags.insert(0, "venture")
    collections = parse_csv(arguments.collections, lower=True)
    invalid_collections = sorted(collection for collection in collections if not valid_slug(collection))
    if invalid_collections:
        raise WritingError(f"collections must be lowercase, hyphenated slugs: {', '.join(invalid_collections)}")

    action_root: Path | None = None
    draft_directory = post_directory
    if replacing_existing:
        action_root = Path(tempfile.mkdtemp(prefix=".writing-draft-", dir=root))
        draft_directory = action_root / post_directory.name
    converted_docx_images = 0
    imported_docx_name: str | None = None
    draft_created = False
    try:
        draft_directory.mkdir(parents=True)
        draft_created = True
        images_directory = draft_directory / "images"
        images_directory.mkdir()
        (images_directory / ".gitkeep").touch()

        if source_argument and source_argument.suffix.lower() == ".docx":
            source_name = author_source_name(source_argument, slug)
            imported_docx_name = source_argument.name
            try:
                shutil.copy2(source_argument, draft_directory / imported_docx_name)
                converted_docx_images = convert_docx_to_author_html(
                    source_argument,
                    draft_directory / source_name,
                    images_directory / "docx",
                    title=title,
                    subtitle=subtitle,
                )
            except Exception as error:
                if isinstance(error, WritingError):
                    raise
                raise WritingError(
                    f"Word document could not be converted: {error}"
                ) from error
        elif source_argument:
            source_name = author_source_name(source_argument, slug)
            shutil.copy2(source_argument, draft_directory / source_name)
        else:
            source_name = f"entry.{arguments.source_format}"
            (draft_directory / source_name).write_text(
                blank_source_template(root, arguments.source_format),
                encoding="utf-8",
            )

        metadata: dict[str, Any] = {
            "$schema": AUTHOR_SCHEMA,
            "source": source_name,
            "title": title,
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
        write_json(draft_directory / "post.json", metadata)
    except WritingError:
        if action_root is not None:
            shutil.rmtree(action_root, ignore_errors=True)
        elif draft_created:
            shutil.rmtree(draft_directory, ignore_errors=True)
        raise
    except Exception as error:
        if action_root is not None:
            shutil.rmtree(action_root, ignore_errors=True)
        elif draft_created:
            shutil.rmtree(draft_directory, ignore_errors=True)
        raise WritingError(f"draft could not be created: {error}") from error

    if action_root is not None:
        commit_staged_action(
            action_root,
            [(draft_directory, post_directory)],
            operation="draft replace",
        )

    action = "replaced" if replacing_existing else "created"
    print(f"{action} {relative_display(post_directory, root)}")
    entry_origin = "from --entry" if arguments.entry else "automatic"
    if arguments.slug:
        slug_origin = "from --slug"
    elif arguments.date:
        slug_origin = "automatic from entry + title + subtitle + --date"
    else:
        slug_origin = "provisional from entry + title + subtitle + draft date"
    print(f'post.json "entry" ({entry_origin}): "{entry}"')
    print(f'post.json "blog": "{arguments.blog}"')
    print(f'post.json "source" (automatic from import/format): "{source_name}"')
    if imported_docx_name:
        print(
            f'Word import: kept "{imported_docx_name}" and converted it to '
            f'editable "{source_name}" ({converted_docx_images} embedded images)'
        )
    print(f'post.json "slug" ({slug_origin}): "{slug}"')
    if arguments.excerpt:
        print(f'post.json "excerpt" (from --excerpt): {arguments.excerpt!r}')
    else:
        print('post.json "excerpt" (derived on first publish): ""')
    if arguments.date:
        print(f'post.json "date" (from --date): "{arguments.date}"')
    else:
        print('post.json "date" (stamped on first publish): ""')
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
    def rewrite_reference(source: str) -> str:
        if source.startswith("images/"):
            return f"{image_web_root}/{source.removeprefix('images/')}"
        return source

    def source_replacement(match: re.Match[str]) -> str:
        prefix, quote, source = match.groups()
        return f"{prefix}{quote}{rewrite_reference(source)}{quote}"

    def srcset_replacement(match: re.Match[str]) -> str:
        prefix, quote, source_set = match.groups()
        candidates: list[str] = []
        for candidate in source_set.split(","):
            parts = candidate.strip().split(maxsplit=1)
            if not parts:
                continue
            source = rewrite_reference(parts[0])
            descriptor = f" {parts[1]}" if len(parts) == 2 else ""
            candidates.append(f"{source}{descriptor}")
        return f"{prefix}{quote}{', '.join(candidates)}{quote}"

    body_html = re.sub(
        r"(\bsrc\s*=\s*)([\"'])([^\"']+)\2",
        source_replacement,
        body_html,
        flags=re.IGNORECASE,
    )
    return re.sub(
        r"(\bsrcset\s*=\s*)([\"'])([^\"']+)\2",
        srcset_replacement,
        body_html,
        flags=re.IGNORECASE,
    )


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


class ExcerptHTMLParser(HTMLParser):
    """Collect prose paragraphs plus a visible-text fallback."""

    prose_tags = {"p", "li"}
    ignored_tags = {
        "script",
        "style",
        "template",
        "noscript",
        "head",
        "title",
        "figcaption",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
    }
    boundary_tags = {
        "p",
        "li",
        "div",
        "section",
        "article",
        "blockquote",
        "address",
        "pre",
        "dl",
        "dt",
        "dd",
        "table",
        "tr",
        "th",
        "td",
        "br",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[str] = []
        self.visible_text: list[str] = []
        self.current_tag: str | None = None
        self.current_text: list[str] = []
        self.current_unemphasized_text: list[str] = []
        self.current_has_image = False
        self.emphasis_depth = 0
        self.previous_image_paragraph = False
        self.ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        tag = tag.lower()
        if tag in self.ignored_tags:
            self.ignored_depth += 1
            return
        if self.ignored_depth:
            return
        if tag in self.prose_tags and self.current_tag is None:
            self.current_tag = tag
            self.current_text = []
            self.current_unemphasized_text = []
            self.current_has_image = False
            self.emphasis_depth = 0
        elif self.current_tag is not None and tag == "img":
            self.current_has_image = True
        elif self.current_tag is not None and tag in {"em", "i"}:
            self.emphasis_depth += 1
        if tag == "br":
            self.visible_text.append(" ")
            if self.current_tag is not None:
                self.current_text.append(" ")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.ignored_depth:
            if tag in self.ignored_tags:
                self.ignored_depth -= 1
            return
        if self.current_tag is not None and tag in {"em", "i"} and self.emphasis_depth:
            self.emphasis_depth -= 1
        if self.current_tag == tag:
            paragraph = normalize_excerpt_text("".join(self.current_text))
            unemphasized = normalize_excerpt_text("".join(self.current_unemphasized_text))
            markdown_caption = (
                self.previous_image_paragraph
                and bool(paragraph)
                and not unemphasized
            )
            if re.search(r"\w", paragraph, flags=re.UNICODE) and not markdown_caption:
                self.paragraphs.append(paragraph)
                self.visible_text.extend((" ", paragraph, " "))
            self.previous_image_paragraph = self.current_has_image and not paragraph
            self.current_tag = None
            self.current_text = []
            self.current_unemphasized_text = []
            self.current_has_image = False
            self.emphasis_depth = 0
        if tag in self.boundary_tags:
            self.visible_text.append(" ")

    def handle_data(self, data: str) -> None:
        if self.ignored_depth:
            return
        if self.current_tag is not None:
            self.current_text.append(data)
            if self.emphasis_depth == 0:
                self.current_unemphasized_text.append(data)
        else:
            self.visible_text.append(data)


def normalize_excerpt_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def shorten_excerpt(
    value: str, limit: int = 150, *, prose_continues: bool = False
) -> str:
    value = normalize_excerpt_text(value)
    if len(value) <= limit and not prose_continues:
        return value
    if not value or limit < 2:
        return "…"[:limit]
    if prose_continues and len(value) < limit:
        return value.removesuffix(".") + "…"
    prefix = value[: limit - 1].rstrip()
    boundary = prefix.rfind(" ")
    if boundary >= limit // 2:
        prefix = prefix[:boundary]
    return prefix.rstrip(" ,;:–—-").removesuffix(".") + "…"


def derive_excerpt(body_html: str) -> str:
    parser = ExcerptHTMLParser()
    parser.feed(body_html)
    parser.close()
    if parser.paragraphs:
        selected_paragraphs = parser.paragraphs[:2]
        excerpt = normalize_excerpt_text(" ".join(selected_paragraphs))
        if re.search(r"\w", excerpt, flags=re.UNICODE):
            return shorten_excerpt(
                excerpt,
                prose_continues=len(parser.paragraphs) > len(selected_paragraphs),
            )

    fallback = normalize_excerpt_text("".join(parser.visible_text))
    if re.search(r"\w", fallback, flags=re.UNICODE):
        return shorten_excerpt(fallback)
    return ""


def legacy_renderers() -> tuple[Callable[..., str], Callable[[str], str]]:
    """Load the preserved Word/HTML renderers without creating tracked bytecode."""
    sys.dont_write_bytecode = True
    try:
        from sfi_blogpost import body_from_docx as docx_renderer, body_from_html as html_renderer
    except ImportError:  # Imported as scripts.writing by a test or another tool.
        from scripts.sfi_blogpost import body_from_docx as docx_renderer, body_from_html as html_renderer
    return docx_renderer, html_renderer


class AuthoredImageHTMLParser(HTMLParser):
    """Collect image URLs from authored HTML, including responsive sources."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[str] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        tag = tag.lower()
        attributes = {name.lower(): value for name, value in attrs}
        if tag not in {"img", "source"}:
            return
        srcset = attributes.get("srcset")
        if tag == "img":
            source = attributes.get("src")
            if source:
                self.references.append(source)
            elif not srcset:
                self.references.append("")
        if not srcset:
            return
        for candidate in srcset.split(","):
            reference = candidate.strip().split(maxsplit=1)[0]
            if reference:
                self.references.append(reference)

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.handle_starttag(tag, attrs)


def authored_image_references(source: str) -> list[str]:
    """Return every Markdown or HTML image reference in an author source."""
    references: list[str] = []
    markdown_pattern = re.compile(
        r"!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))",
        flags=re.IGNORECASE,
    )
    for match in markdown_pattern.finditer(source):
        references.append((match.group(1) or match.group(2) or "").strip())

    parser = AuthoredImageHTMLParser()
    parser.feed(source)
    parser.close()
    references.extend(parser.references)
    return list(dict.fromkeys(reference.strip() for reference in references))


def image_reference_issue(reference: str, post: AuthorPost) -> str | None:
    """Validate that an authored image URL will remain portable after publish."""
    if not reference:
        return "image element is missing a source"

    parsed = urlparse(reference)
    scheme = parsed.scheme.lower()
    if scheme in {"http", "https"} and parsed.netloc:
        return None
    if scheme or parsed.netloc or reference.startswith(("/", "~", "\\")):
        return (
            "image reference is not portable; use images/... for post images "
            "or an absolute http(s) URL"
        )

    path = parsed.path
    pure_reference = PurePosixPath(path)
    if (
        not path.startswith("images/")
        or "\\" in path
        or pure_reference.is_absolute()
        or ".." in pure_reference.parts
        or str(pure_reference) != path
    ):
        return (
            "local image reference must be a normalized path beginning with "
            f"images/: {reference}"
        )

    images_root = (post.directory / "images").resolve()
    local_path = (post.directory / pure_reference).resolve()
    if not local_path.is_relative_to(images_root):
        return f"referenced image must stay inside images/: {reference}"
    if not local_path.is_file():
        return f"referenced image is missing: {reference}"
    return None


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


def review_post(
    post: AuthorPost,
    root: Path,
    *,
    publishing: bool = False,
    rendered_body_html: str | None = None,
    source_path_override: Path | None = None,
) -> ReviewResult:
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

    for field in ("title", "subtitle", "entry", "location", "slug", "blog", "status"):
        if not isinstance(metadata.get(field), str) or not str(metadata.get(field)).strip():
            blockers.append(f"{field} must be a non-empty string")

    excerpt = metadata.get("excerpt")
    blank_excerpt = excerpt is None or (isinstance(excerpt, str) and not excerpt.strip())
    if blank_excerpt:
        if metadata.get("status") == "draft" and not publishing:
            notes.append(
                "excerpt: will be derived from the first two prose paragraphs on first publish"
            )
        else:
            blockers.append("excerpt must be a non-empty string")
    elif not isinstance(excerpt, str):
        blockers.append("excerpt must be a non-empty string")

    publication_date = metadata.get("date")
    blank_date = publication_date is None or (
        isinstance(publication_date, str) and not publication_date.strip()
    )
    if blank_date:
        if metadata.get("status") == "draft" and not publishing:
            notes.append("date: will be stamped on first publish")
        else:
            blockers.append("date must be a non-empty YYYY-MM-DD string")
    elif not valid_date(publication_date):
        blockers.append("date must use YYYY-MM-DD")

    entry = metadata.get("entry")
    if not isinstance(entry, str) or not re.fullmatch(r"\d{4}", entry) or entry == "0000":
        blockers.append("entry must be a four-digit string from 0001 through 9999")
    publication_time = metadata.get("time")
    if publication_time is not None and publication_time != "" and not valid_time(publication_time):
        blockers.append("time must be blank while drafting or use 24-hour HH:MM")
    elif metadata.get("status") in {"published", "unpublished"} and not valid_time(publication_time):
        blockers.append("published and unpublished posts require a 24-hour HH:MM time")
    elif metadata.get("status") == "draft" and not publishing:
        if valid_time(publication_time):
            notes.append("time: the existing draft value will be replaced on first publish")
        else:
            notes.append("time: will be stamped on first publish")
    if not valid_post_slug(metadata.get("slug")):
        blockers.append(
            "slug must use NNNN-title-subtitle-YYYYMMDD with lowercase "
            "letters, numbers, and hyphens"
        )
    if metadata.get("blog") not in BLOGS:
        blockers.append("blog must be sfi or venture")
    if metadata.get("status") not in STATUSES:
        blockers.append("status must be draft, unpublished, or published")

    expected_blog = post.path.parent.parent.name
    expected_slug = post.directory.name
    if metadata.get("blog") != expected_blog:
        blockers.append(f"blog must match its writing/{expected_blog}/ folder")
    if metadata.get("slug") != expected_slug:
        pending_publish_rename = (
            publishing
            and metadata.get("status") == "draft"
            and valid_post_slug(expected_slug)
            and valid_post_slug(metadata.get("slug"))
            and expected_slug[:-8] == str(metadata.get("slug"))[:-8]
        )
        if pending_publish_rename:
            final_directory = post.directory.parent / str(metadata["slug"])
            if final_directory.exists():
                blockers.append(
                    f"final publication folder already exists: {relative_display(final_directory, root)}"
                )
            else:
                notes.append(f"folder: will be finalized as {metadata['slug']}")
        else:
            blockers.append(f"slug must match its folder name {expected_slug!r}")
    if isinstance(entry, str) and isinstance(metadata.get("slug"), str):
        if not str(metadata["slug"]).startswith(f"{entry}-"):
            blockers.append("slug must begin with the post entry")
        if valid_date(metadata.get("date")) and not str(metadata["slug"]).endswith(
            str(metadata["date"]).replace("-", "")
        ):
            if metadata.get("status") == "draft":
                notes.append("slug: date suffix will be finalized on first publish")
            else:
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
    effective_source_path = post.source_path
    pending_source_rename = (
        publishing
        and metadata.get("status") == "draft"
        and source_path_override is not None
        and source_path_override.parent == post.directory
        and source_path_override.name == f"{post.directory.name}.html"
        and source == f"{metadata.get('slug')}.html"
    )
    if pending_source_rename:
        effective_source_path = source_path_override
        notes.append(f"source: will be finalized as {source}")
    if source is not None and (not isinstance(source, str) or not source.strip()):
        blockers.append("source must be null or a non-empty relative path")
    if isinstance(source, str) and source.strip():
        pure_source = PurePosixPath(source)
        if pure_source.is_absolute() or ".." in pure_source.parts or str(pure_source) != source:
            blockers.append("source must be a normalized relative path inside the post folder")
        elif pure_source.suffix.lower() not in AUTHOR_SOURCE_SUFFIXES:
            blockers.append("active source must be an editable .html, .txt, or .md document")
        elif len(pure_source.parts) != 1 or not valid_author_source_name(
            pure_source.name, metadata.get("slug")
        ):
            blockers.append(
                "source must be entry.md, entry.html, entry.txt, or the full post slug plus .html"
            )
        elif not effective_source_path or not effective_source_path.is_file():
            blockers.append(f"source file is missing: {source}")
        else:
            source_is_safe = True
    else:
        blockers.append("source is empty; select a source document before review")

    blockers.extend(duplicate_author_issues(post, root))
    blockers.extend(generated_collision_issues(post, root))

    body_html = rendered_body_html
    if source_is_safe and effective_source_path:
        if body_html is None:
            try:
                with tempfile.TemporaryDirectory(prefix="writing-review-") as temporary:
                    render_post = post
                    if pending_source_rename and source_path_override is not None:
                        render_metadata = dict(post.metadata)
                        render_metadata["source"] = source_path_override.name
                        render_post = AuthorPost(post.path, render_metadata)
                    body_html = render_source(
                        render_post, Path(temporary), "/images/posts/review"
                    )
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

            source_text = effective_source_path.read_text(encoding="utf-8")
            source_text = re.sub(r"<!--.*?-->", "", source_text, flags=re.DOTALL)
            for reference in authored_image_references(source_text):
                issue = image_reference_issue(reference, post)
                if issue:
                    blockers.append(issue)

            if blank_excerpt and metadata.get("status") == "draft" and not publishing:
                excerpt_preview = derive_excerpt(body_html)
                if excerpt_preview:
                    notes.append(f"excerpt preview: {excerpt_preview}")
                else:
                    blockers.append(
                        "excerpt cannot be derived; add a prose block or supply a manual excerpt"
                    )

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
    title = str(metadata.get("title") or "(untitled)").strip()
    subtitle = str(metadata.get("subtitle") or "(no subtitle)").strip()
    print(
        f"review · {result.post.entry or '????'} · "
        f"{metadata.get('blog', '?')} · {title} · {subtitle}"
    )
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


def referenced_author_images(post: AuthorPost) -> list[Path]:
    """Return only local author images actually used by the active source."""
    source_path = post.source_path
    if source_path is None or source_path.suffix.lower() == ".docx":
        return []
    if not source_path.is_file():
        return []

    source_text = source_path.read_text(encoding="utf-8")
    source_text = re.sub(r"<!--.*?-->", "", source_text, flags=re.DOTALL)
    source_root = (post.directory / "images").resolve()
    referenced: set[Path] = set()
    for reference in authored_image_references(source_text):
        parsed = urlparse(reference)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith("images/"):
            continue
        source = (post.directory / PurePosixPath(parsed.path)).resolve()
        if source.is_relative_to(source_root) and source.is_file():
            referenced.add(source)
    return sorted(referenced)


def copy_author_images(post: AuthorPost, destination: Path) -> int:
    count = 0
    source_root = (post.directory / "images").resolve()
    for source in referenced_author_images(post):
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


def slug_for_publication_date(slug: str, publication_date: str) -> str:
    if not valid_post_slug(slug) or not valid_date(publication_date):
        return slug
    return f"{slug[:-8]}{publication_date.replace('-', '')}"


def move_path(source: Path, destination: Path) -> None:
    source.replace(destination)


def remove_path(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def commit_replacements(
    replacements: list[tuple[Path | None, Path]],
    backup_root: Path,
    *,
    operation: str,
) -> None:
    """Atomically install or remove exact paths and roll back as a group."""
    targets = [target for _, target in replacements]
    if len(targets) != len(set(targets)):
        raise WritingError(f"{operation} plan contains a duplicate target")

    backup_root.mkdir(parents=True, exist_ok=True)
    promoted: list[dict[str, Any]] = []
    try:
        for index, (staged, target) in enumerate(replacements):
            if target == target.parent:
                raise WritingError(f"refusing an unsafe {operation} target: {target}")
            target.parent.mkdir(parents=True, exist_ok=True)
            backup: Path | None = None
            if target.exists() or target.is_symlink():
                backup = backup_root / f"{index:03d}-{target.name}"
                move_path(target, backup)
            record = {"target": target, "backup": backup, "installed": False}
            promoted.append(record)
            if staged is not None:
                move_path(staged, target)
                record["installed"] = True
    except BaseException as error:
        rollback_errors: list[str] = []
        for record in reversed(promoted):
            target = record["target"]
            backup = record["backup"]
            try:
                if record["installed"] and (target.exists() or target.is_symlink()):
                    remove_path(target)
                if backup is not None and backup.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    move_path(backup, target)
            except BaseException as rollback_error:
                rollback_errors.append(str(rollback_error))
        if rollback_errors:
            raise TransactionError(
                f"{operation} failed and rollback was incomplete: {error}; "
                f"rollback issues: {'; '.join(rollback_errors)}; "
                f"recovery files remain in {backup_root.parent}",
                recovery_required=True,
            ) from error
        if isinstance(error, Exception):
            raise TransactionError(
                f"{operation} failed; previous files were restored: {error}"
            ) from error
        raise


def generated_record_aliases(record: dict[str, Any]) -> set[str]:
    aliases: set[str] = set()
    slug = record.get("slug")
    if valid_slug(slug):
        aliases.add(str(slug))
    route = record.get("path")
    if isinstance(route, str) and route.startswith("/venture/"):
        route_slug = route.removeprefix("/venture/").strip("/")
        if valid_slug(route_slug):
            aliases.add(route_slug)
    body = record.get("bodyHtml")
    if isinstance(body, str):
        for match in re.finditer(r"/images/posts/([a-z0-9]+(?:-[a-z0-9]+)*)/", body):
            aliases.add(match.group(1))
    return aliases


def publication_artifacts(
    post: AuthorPost,
    root: Path,
    *,
    include_author_traces: bool = False,
) -> tuple[list[Path], set[str]]:
    """Find every locally generated artifact that can be verified as this entry."""
    aliases = {post.slug}
    public_post_images = root / "public" / "images" / "posts"
    if public_post_images.exists():
        for path in public_post_images.glob(f"{post.entry}-*"):
            if path.is_dir() or path.is_symlink():
                aliases.add(path.name)

    record_directories = (
        root / "content" / "scope-for-imagination" / "posts",
        root / "content" / "scope-for-imagination" / "newsletters",
        root / "content" / "venture" / "entries",
    )
    records: list[tuple[Path, dict[str, Any] | None, str | None]] = []
    for directory in record_directories:
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.json")):
            try:
                records.append((path, load_json_object(path), None))
            except WritingError as error:
                records.append((path, None, str(error)))

    selected: set[Path] = set()
    changed = True
    while changed:
        changed = False
        for path, record, load_error in records:
            filename_match = path.stem == post.entry or path.stem in aliases
            if record is None:
                if filename_match:
                    raise WritingError(
                        f"refusing to remove an unreadable generated record: "
                        f"{relative_display(path, root)} ({load_error})"
                    )
                continue
            record_entry_value = record.get("entry")
            record_entry = (
                str(record_entry_value).zfill(4)
                if isinstance(record_entry_value, (str, int))
                and str(record_entry_value).isdigit()
                else ""
            )
            record_aliases = generated_record_aliases(record)
            matches = (
                filename_match
                or record_entry == post.entry
                or bool(aliases.intersection(record_aliases))
            )
            if not matches:
                continue
            if record_entry and record_entry != post.entry:
                raise WritingError(
                    "generated-output ownership collision at "
                    f"{relative_display(path, root)}: entry {record_entry} is not {post.entry}"
                )
            if path not in selected:
                selected.add(path)
                changed = True
            before = len(aliases)
            aliases.update(record_aliases)
            if len(aliases) != before:
                changed = True

    artifacts: set[Path] = set(selected)
    for alias in aliases:
        if valid_slug(alias):
            image_path = public_post_images / alias
            if image_path.exists() or image_path.is_symlink():
                artifacts.add(image_path)

    legacy_images = root / "public" / "images" / "scope-for-imagination" / post.entry
    if legacy_images.exists() or legacy_images.is_symlink():
        artifacts.add(legacy_images)

    if include_author_traces:
        legacy_drafts = root / "content" / "scope-for-imagination" / "drafts"
        if legacy_drafts.exists():
            artifacts.update(legacy_drafts.glob(f"{post.entry}-*.html"))
        preview = root / ".writing-preview" / post.slug
        if preview.exists() or preview.is_symlink():
            artifacts.add(preview)

    return sorted(artifacts, key=lambda path: str(path)), aliases


def commit_publication(
    author_directory: Path,
    final_author_directory: Path,
    replacements: list[tuple[Path | None, Path]],
    backup_root: Path,
    *,
    operation: str = "publish",
) -> None:
    """Rename an author folder, promote staged files, and restore on failure."""
    backup_root.mkdir(parents=True, exist_ok=True)
    promoted: list[dict[str, Any]] = []
    author_renamed = False
    try:
        if final_author_directory != author_directory:
            move_path(author_directory, final_author_directory)
            author_renamed = True

        for index, (staged, target) in enumerate(replacements):
            target.parent.mkdir(parents=True, exist_ok=True)
            backup: Path | None = None
            if target.exists() or target.is_symlink():
                backup = backup_root / f"{index:02d}-{target.name}"
                move_path(target, backup)
            record = {"target": target, "backup": backup, "installed": False}
            promoted.append(record)
            if staged is not None:
                move_path(staged, target)
                record["installed"] = True
    except BaseException as error:
        rollback_errors: list[str] = []
        for record in reversed(promoted):
            target = record["target"]
            backup = record["backup"]
            try:
                if record["installed"] and (target.exists() or target.is_symlink()):
                    remove_path(target)
                if backup is not None and backup.exists():
                    move_path(backup, target)
            except BaseException as rollback_error:
                rollback_errors.append(str(rollback_error))
        if author_renamed:
            try:
                move_path(final_author_directory, author_directory)
            except BaseException as rollback_error:
                rollback_errors.append(str(rollback_error))
        if rollback_errors:
            raise TransactionError(
                f"{operation} failed and rollback was incomplete: "
                f"{error}; rollback issues: {'; '.join(rollback_errors)}"
                f"; recovery files remain in {backup_root.parent}",
                recovery_required=True,
            ) from error
        if isinstance(error, Exception):
            raise TransactionError(
                f"{operation} failed; previous files were restored: {error}"
            ) from error
        raise


def command_publish(arguments: argparse.Namespace, root: Path) -> int:
    author_post = locate_post(arguments.target, root)
    publish_metadata = dict(author_post.metadata)
    first_publish = publish_metadata.get("status") == "draft"
    automatic_date = first_publish and (
        publish_metadata.get("date") is None
        or (
            isinstance(publish_metadata.get("date"), str)
            and not str(publish_metadata.get("date")).strip()
        )
    )
    automatic_excerpt = first_publish and (
        publish_metadata.get("excerpt") is None
        or (
            isinstance(publish_metadata.get("excerpt"), str)
            and not str(publish_metadata.get("excerpt")).strip()
        )
    )
    if first_publish:
        stamped_date, stamped_time = current_publication_stamp()
        if automatic_date:
            publish_metadata["date"] = stamped_date
        publish_metadata["time"] = stamped_time
        if valid_date(publish_metadata.get("date")) and isinstance(
            publish_metadata.get("slug"), str
        ):
            publish_metadata["slug"] = slug_for_publication_date(
                str(publish_metadata["slug"]), str(publish_metadata["date"])
            )
    source_rename = (
        isinstance(author_post.metadata.get("source"), str)
        and author_post.metadata.get("source") == f"{author_post.slug}.html"
        and publish_metadata.get("slug") != author_post.slug
    )
    if source_rename:
        final_source_name = f"{publish_metadata['slug']}.html"
        unexpected_target = author_post.directory / final_source_name
        if unexpected_target.exists() or unexpected_target.is_symlink():
            raise WritingError(
                "finalized author source already exists: "
                f"{relative_display(unexpected_target, root)}"
            )
        publish_metadata["source"] = final_source_name
    post = AuthorPost(author_post.path, publish_metadata)
    final_author_directory = author_post.directory.parent / post.slug
    public_images = root / "public" / "images" / "posts" / post.slug
    with staged_action_directory(root, ".writing-publish-") as staging_root:
        staged_images = staging_root / "images"
        staged_images.mkdir()
        render_post = author_post if source_rename else post
        copied_images = copy_author_images(render_post, staged_images)
        try:
            body_html = render_source(
                render_post, staged_images, f"/images/posts/{post.slug}"
            )
        except Exception as error:
            result = review_post(
                post,
                root,
                publishing=True,
                rendered_body_html="",
                source_path_override=author_post.source_path if source_rename else None,
            )
            result.blockers.append(f"source could not be rendered: {error}")
            print_review(result, root)
            print("publish stopped: resolve the review blockers first", file=sys.stderr)
            return 1

        if automatic_excerpt:
            publish_metadata["excerpt"] = derive_excerpt(body_html)
            post = AuthorPost(author_post.path, publish_metadata)

        result = review_post(
            post,
            root,
            publishing=True,
            rendered_body_html=body_html,
            source_path_override=author_post.source_path if source_rename else None,
        )
        print_review(result, root)
        if not result.ok:
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
        print(f"  excerpt: {post.metadata.get('excerpt')}")
        if final_author_directory != author_post.directory:
            print(
                "  author folder: "
                f"{relative_display(author_post.directory, root)} → "
                f"{relative_display(final_author_directory, root)}"
            )
        if source_rename:
            print(
                "  author source: "
                f"{author_post.metadata.get('source')} → {post.metadata.get('source')}"
            )
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

        if first_publish:
            confirmed_date, confirmed_time = current_publication_stamp()
            if automatic_date and confirmed_date != publish_metadata.get("date"):
                print(
                    "publish stopped: the local date changed during review; rerun publish "
                    "to confirm the updated date and slug",
                    file=sys.stderr,
                )
                return 1
            publish_metadata["time"] = confirmed_time
            post = AuthorPost(author_post.path, publish_metadata)

        sfi_record = published_record(post.metadata, body_html, "../post.schema.json")
        venture_record = published_record(post.metadata, body_html, "../entry.schema.json")
        newsletter = newsletter_for_post(sfi_record)

        sfi_path = root / "content" / "scope-for-imagination" / "posts" / f"{post.entry}.json"
        newsletter_path = root / "content" / "scope-for-imagination" / "newsletters" / f"{post.entry}.json"
        venture_path = root / "content" / "venture" / "entries" / f"{post.slug}.json"

        staged_sfi = staging_root / "sfi.json"
        staged_newsletter = staging_root / "newsletter.json"
        staged_venture = staging_root / "venture.json"
        staged_author = staging_root / "post.json"
        staged_author_source = staging_root / "author-source.html"
        write_json(staged_sfi, sfi_record)
        write_json(staged_newsletter, newsletter)
        if post.blog == "venture":
            write_json(staged_venture, venture_record)
        updated_metadata = dict(post.metadata)
        updated_metadata["status"] = "published"
        write_json(staged_author, updated_metadata)
        if source_rename and author_post.source_path is not None:
            shutil.copy2(author_post.source_path, staged_author_source)

        replacements: list[tuple[Path | None, Path]] = [
            (staged_images if any(staged_images.iterdir()) else None, public_images),
            (staged_sfi, sfi_path),
        ]
        if post.blog == "venture":
            replacements.append((staged_venture, venture_path))
        replacements.extend(
            (
                (staged_newsletter, newsletter_path),
            )
        )
        if source_rename:
            replacements.extend(
                (
                    (
                        None,
                        final_author_directory
                        / str(author_post.metadata.get("source")),
                    ),
                    (
                        staged_author_source,
                        final_author_directory / str(post.metadata.get("source")),
                    ),
                )
            )
        replacements.append((staged_author, final_author_directory / "post.json"))
        commit_publication(
            author_post.directory,
            final_author_directory,
            replacements,
            staging_root / "backups",
        )

    print(f"published {relative_display(sfi_path, root)}")
    if post.blog == "venture":
        print(f"published {relative_display(venture_path, root)}")
    print(f"created {relative_display(newsletter_path, root)}")
    print(
        f"images: {copied_images} referenced author images "
        "plus any embedded document images"
    )
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


def commit_staged_action(
    action_root: Path,
    replacements: list[tuple[Path | None, Path]],
    *,
    operation: str,
) -> None:
    """Commit a staged action and retain its directory only for manual recovery."""
    try:
        commit_replacements(
            replacements,
            action_root / "backups",
            operation=operation,
        )
    except TransactionError as error:
        if not error.recovery_required:
            shutil.rmtree(action_root, ignore_errors=True)
        raise
    shutil.rmtree(action_root, ignore_errors=True)


def commit_staged_author_action(
    action_root: Path,
    author_directory: Path,
    final_author_directory: Path,
    replacements: list[tuple[Path | None, Path]],
    *,
    operation: str,
) -> None:
    """Commit an action that may also rename its managed author folder."""
    try:
        commit_publication(
            author_directory,
            final_author_directory,
            replacements,
            action_root / "backups",
            operation=operation,
        )
    except TransactionError as error:
        if not error.recovery_required:
            shutil.rmtree(action_root, ignore_errors=True)
        raise
    shutil.rmtree(action_root, ignore_errors=True)


def source_argument_path(arguments: argparse.Namespace) -> Path:
    source = arguments.source
    if source is None:
        try:
            entered = input(
                'post.json "source" — updated document path (.md, .html, .txt, or .docx): '
            ).strip()
        except EOFError as error:
            raise WritingError(
                "resource needs a document path; rerun in a terminal or pass --source PATH"
            ) from error
        if not entered:
            raise WritingError("resource cancelled: no updated document was selected")
        normalized = entered.strip("\"'").replace("\\ ", " ")
        source = Path(normalized)

    resolved = source.expanduser().resolve()
    if not resolved.is_file():
        raise WritingError(f"updated source document does not exist: {resolved}")
    if resolved.suffix.lower() not in SUPPORTED_SOURCE_SUFFIXES:
        supported = ", ".join(sorted(SUPPORTED_SOURCE_SUFFIXES))
        raise WritingError(f"updated source document must be one of: {supported}")
    return resolved


def command_resource(arguments: argparse.Namespace, root: Path) -> int:
    post = assert_managed_author_post(locate_post(arguments.target, root), root)
    source = source_argument_path(arguments)
    old_target = post.source_path
    target_slug = upgraded_draft_slug(post)
    final_author_directory = post.directory.parent / target_slug
    if final_author_directory != post.directory and final_author_directory.exists():
        raise WritingError(
            f"updated slug folder already exists: {relative_display(final_author_directory, root)}"
        )

    same_active_file = (
        target_slug == post.slug
        and source.suffix.lower() != ".docx"
        and old_target is not None
        and old_target.is_file()
        and old_target.resolve() == source
        and valid_author_source_name(post.metadata.get("source"), post.slug)
    )
    if same_active_file:
        print("already active: this document is the post's current source")
        return 0

    converting_docx = source.suffix.lower() == ".docx"
    new_name = author_source_name(source, target_slug)
    new_target = final_author_directory / new_name
    if final_author_directory != post.directory:
        pending_target = post.directory / new_name
        if pending_target.exists() and pending_target != old_target:
            raise WritingError(
                "refusing to overwrite a pre-existing finalized source: "
                f"{relative_display(pending_target, root)}"
            )
    action_root = Path(tempfile.mkdtemp(prefix=".writing-resource-", dir=root))
    staged_source = action_root / new_name
    staged_metadata = action_root / "post.json"
    staged_docx_images = action_root / "docx-images"
    staged_archive: Path | None = None
    archive_target: Path | None = None
    converted_docx_images = 0

    try:
        if converting_docx:
            converted_docx_images = convert_docx_to_author_html(
                source,
                staged_source,
                staged_docx_images,
                title=str(post.metadata.get("title") or "untitled"),
                subtitle=str(post.metadata.get("subtitle") or "untitled"),
            )
            if source.parent != post.directory:
                staged_archive = action_root / f"archive-{source.name}"
                shutil.copy2(source, staged_archive)
                archive_target = final_author_directory / source.name
        else:
            shutil.copy2(source, staged_source)

        updated_metadata = dict(post.metadata)
        updated_metadata["slug"] = target_slug
        updated_metadata["source"] = new_name
        write_json(staged_metadata, updated_metadata)
    except Exception as error:
        shutil.rmtree(action_root, ignore_errors=True)
        if isinstance(error, WritingError):
            raise
        raise WritingError(f"resource could not prepare the updated document: {error}") from error

    print(f"resource summary · entry {post.entry}")
    print(f"  document: {source}")
    if target_slug != post.slug:
        print(f"  slug: {post.slug} → {target_slug}")
        print(
            "  author folder: "
            f"{relative_display(post.directory, root)} → "
            f"{relative_display(final_author_directory, root)}"
        )
    print(f"  active source: {post.metadata.get('source') or '(none)'} → {new_name}")
    if converting_docx:
        print(f"  conversion: Word → editable HTML ({converted_docx_images} embedded images)")
        print(f"  original Word manuscript: kept as {source.name}")
        if new_target.exists():
            print("  warning: this replaces the current editable HTML and any manual HTML tweaks")
    print(f"  metadata: preserved except source/legacy slug (status remains {post.metadata.get('status')})")
    print("  author images outside converter-managed images/docx: preserved")
    if post.metadata.get("status") == "published":
        print("  live post: unchanged until publish --replace")
    else:
        print("  live post: unchanged")

    if arguments.dry_run:
        shutil.rmtree(action_root, ignore_errors=True)
        print("dry run: no files changed")
        return 0
    if not arguments.yes:
        try:
            answer = input(f"Replace the source for entry {post.entry}? [y/N] ").strip().lower()
        except EOFError:
            answer = ""
        if answer not in {"y", "yes"}:
            shutil.rmtree(action_root, ignore_errors=True)
            print("resource cancelled")
            return 1

    replacements: list[tuple[Path | None, Path]] = []
    moved_old_target = (
        final_author_directory / old_target.name if old_target is not None else None
    )
    if moved_old_target is not None and moved_old_target != new_target and (
        old_target.exists() or old_target.is_symlink()
    ) and old_target.suffix.lower() != ".docx":
        replacements.append((None, moved_old_target))
    replacements.append((staged_source, new_target))
    if staged_archive is not None and archive_target is not None:
        replacements.append((staged_archive, archive_target))
    if converting_docx:
        current_docx_images = post.directory / "images" / "docx"
        managed_docx_images = final_author_directory / "images" / "docx"
        if staged_docx_images.exists() or current_docx_images.exists():
            replacements.append(
                (
                    staged_docx_images if converted_docx_images else None,
                    managed_docx_images,
                )
            )
    replacements.append((staged_metadata, final_author_directory / "post.json"))
    commit_staged_author_action(
        action_root,
        post.directory,
        final_author_directory,
        replacements,
        operation="resource",
    )

    print(f"resourced entry {post.entry}: {relative_display(new_target, root)}")
    if converting_docx:
        print(f"editable HTML: {relative_display(new_target, root)}")
        kept_word = (
            final_author_directory / source.name
            if source.parent == post.directory
            else archive_target or source
        )
        print(f"Word manuscript kept: {relative_display(kept_word, root)}")
    elif source.parent == post.directory and source.name != new_name:
        print(
            "note: the supplied noncanonical document remains alongside entry.*; "
            "remove it manually when you no longer need that copy"
        )
    print(f"review: pnpm writing review {post.entry}")
    publish_flags = " --replace" if post.metadata.get("status") == "published" else ""
    print(f"preview publish: pnpm writing publish {post.entry} --dry-run{publish_flags}")
    return 0


def preview_details(post: AuthorPost) -> str:
    metadata = post.metadata
    parts: list[str] = []
    publication_date = metadata.get("date")
    publication_time = metadata.get("time")
    parts.append(
        display_date(str(publication_date))
        if valid_date(publication_date)
        else "publication date pending"
    )
    parts.append(str(publication_time) if valid_time(publication_time) else "time pending")
    location = str(metadata.get("location") or "location pending").strip()
    parts.extend((location, post.entry))
    return " • ".join(parts)


def preview_document_html(post: AuthorPost, body_html: str) -> str:
    metadata = post.metadata
    title = html.escape(str(metadata.get("title") or "untitled"))
    subtitle = html.escape(str(metadata.get("subtitle") or "untitled"))
    details = html.escape(preview_details(post))
    excerpt = str(metadata.get("excerpt") or "").strip()
    trip = str(metadata.get("trip") or "").strip()
    music = music_line(metadata.get("music"), rendered_html=True)
    tags = metadata.get("tags") if isinstance(metadata.get("tags"), list) else []
    collections = (
        metadata.get("collections") if isinstance(metadata.get("collections"), list) else []
    )
    collection_labels = "".join(
        f"<li>{html.escape(str(label))}</li>" for label in collections
    )
    tag_colors = {"sfi": "#cb4b16", "venture": "#586e75"}
    tag_labels = "".join(
        '<li style="color: {}">{}</li>'.format(
            tag_colors.get(str(tag).strip().lower(), "var(--green)"),
            html.escape(str(tag)),
        )
        for tag in tags
    )
    labels = f"{collection_labels}{tag_labels}"
    venture_trip = ""
    venture_excerpt = ""
    if post.blog == "venture":
        if trip:
            venture_trip = f'<p class="trip">trip: {html.escape(trip)}</p>'
        if excerpt:
            venture_excerpt = f'<p class="excerpt">{html.escape(excerpt)}</p>'
    music_html = (
        music.replace("<p>", '<span class="music">', 1).replace(
            "</p>", "</span>", 1
        )
        if music
        else ""
    )
    labels_html = f'<ul class="labels">{labels}</ul>' if labels else ""
    separator_html = (
        '<span class="metadata-separator" aria-hidden="true">•</span>'
        if labels_html
        else ""
    )
    music_group = (
        f'<span class="music-group">{separator_html}{music_html}</span>'
        if music_html
        else ""
    )
    metadata_line = (
        f'<div class="metadata-line">{labels_html}{music_group}</div>'
        if music_html or labels_html
        else ""
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>{subtitle} · private writing preview</title>
  <style>
    :root {{ color-scheme: light; --ink: #292524; --muted: #78716c; --line: #d6d3d1; --green: #6f8200; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: #fff; color: var(--ink); font-family: Georgia, "Times New Roman", serif; }}
    main {{ width: min(100% - 3rem, 48rem); margin: 0 auto; padding: 4rem 0 7rem; }}
    .preview-note {{ margin: 0 0 3.5rem; color: var(--green); font: 0.68rem/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .14em; text-transform: lowercase; }}
    header {{ border-bottom: 1px solid var(--line); padding-bottom: 1.75rem; }}
    h1 {{ margin: 0; font-size: clamp(1.5rem, 4vw, 1.875rem); font-weight: 400; line-height: 1.2; }}
    .subtitle {{ margin: .75rem 0 0; color: var(--muted); font-size: 1.125rem; font-style: italic; line-height: 1.5; }}
    .details, .music, .trip {{ margin: .55rem 0 0; color: var(--muted); font: .75rem/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    .music a {{ color: inherit; text-decoration-thickness: 1px; text-underline-offset: .16em; }}
    article a {{ color: var(--green); text-decoration-thickness: 1px; text-underline-offset: .16em; }}
    .excerpt {{ margin: .65rem 0 0; color: var(--muted); font-size: .875rem; font-style: italic; line-height: 1.6; }}
    .metadata-line {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem .5rem; margin-top: .6rem; }}
    .music-group {{ display: inline-flex; min-width: 0; align-items: baseline; gap: .5rem; }}
    .metadata-line .music {{ margin: 0; }}
    .metadata-separator {{ color: var(--muted); font: .75rem/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    .labels {{ display: flex; flex-wrap: wrap; gap: .3rem .8rem; margin: 0; padding: 0; list-style: none; color: var(--green); font: .65rem/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .12em; text-transform: lowercase; }}
    article {{ margin-top: 2.5rem; font-size: .92rem; line-height: 1.85; }}
    article h2, article h3, article h4, article h5, article h6 {{ margin: 2.4rem 0 .8rem; font-weight: 400; line-height: 1.35; }}
    article p, article ul, article ol, article blockquote {{ margin: 1.15rem 0; }}
    article img {{ display: block; width: 100%; height: auto; margin: 2.5rem 0; }}
    article figure {{ margin: 2.5rem 0; }} article figure img {{ margin: 0; }}
    article figcaption {{ margin-top: .65rem; color: var(--muted); font-size: .78rem; font-style: italic; text-align: center; }}
    article blockquote {{ border-left: 2px solid var(--line); color: #57534e; padding-left: 1.25rem; }}
    article .entry-centered {{ text-align: center; }}
    article .entry-callout {{ border: 1px solid var(--line); margin: 2rem 0; padding: 1rem 1.25rem; }}
    article code {{ background: #f5f5f4; font-size: .85em; padding: .1rem .25rem; }}
  </style>
</head>
<body>
  <main>
    <p class="preview-note">private draft preview · not published</p>
    <header>
      <h1>{title}</h1>
      <p class="subtitle">{subtitle}</p>
      <p class="details">{details}</p>
      {venture_trip}
      {metadata_line}
      {venture_excerpt}
    </header>
    <article>{body_html}</article>
  </main>
</body>
</html>
"""


def render_preview(post: AuthorPost, root: Path) -> Path:
    post = assert_managed_author_post(post, root)
    action_root = Path(tempfile.mkdtemp(prefix=".writing-render-", dir=root))
    staged_preview = action_root / "preview"
    staged_images = staged_preview / "images"
    try:
        staged_images.mkdir(parents=True)
        copy_author_images(post, staged_images)
        body_html = render_source(post, staged_images, "images")
        if re.search(r"<script\b", body_html, flags=re.IGNORECASE):
            raise WritingError("preview refused: the rendered post contains a script tag")
        (staged_preview / "index.html").write_text(
            preview_document_html(post, body_html), encoding="utf-8"
        )
    except WritingError:
        shutil.rmtree(action_root, ignore_errors=True)
        raise
    except Exception as error:
        shutil.rmtree(action_root, ignore_errors=True)
        raise WritingError(f"preview could not be rendered: {error}") from error

    preview_directory = root / ".writing-preview" / post.slug
    commit_staged_action(
        action_root,
        [(staged_preview, preview_directory)],
        operation="render",
    )
    return preview_directory / "index.html"


def command_render(arguments: argparse.Namespace, root: Path) -> int:
    post = locate_post(arguments.target, root)
    preview = render_preview(post, root)
    print(f"rendered private preview: {preview}")
    print(f"view: pnpm writing view {post.entry}")
    return 0


def command_view(arguments: argparse.Namespace, root: Path) -> int:
    post = locate_post(arguments.target, root)
    preview = render_preview(post, root)
    print(f"rendered private preview: {preview}")
    if not webbrowser.open(preview.as_uri(), new=2):
        print("could not open the default browser automatically; open the path above", file=sys.stderr)
        return 1
    print("opened in the default browser")
    return 0


def print_removal_summary(
    action: str,
    post: AuthorPost,
    artifacts: list[Path],
    root: Path,
) -> None:
    print(f"{action} summary · entry {post.entry}")
    print(f"  blog: {post.blog}")
    print(f"  slug: {post.slug}")
    print(f"  status: {post.metadata.get('status')}")
    print("  generated files:")
    if artifacts:
        for path in artifacts:
            print(f"    - {relative_display(path, root)}")
    else:
        print("    - none found")


def command_unpublish(arguments: argparse.Namespace, root: Path) -> int:
    post = locate_managed_entry(arguments.entry, root)
    status = post.metadata.get("status")
    if status == "draft":
        raise WritingError(
            f"entry {post.entry} is a draft and has never been published; "
            f"use `pnpm writing erase {post.entry}` to remove it"
        )
    if status not in {"published", "unpublished"}:
        raise WritingError(f"entry {post.entry} has an unsupported status: {status!r}")

    artifacts, _ = publication_artifacts(post, root)
    print_removal_summary("unpublish", post, artifacts, root)
    print(f"  author folder: keep {relative_display(post.directory, root)}")
    print("  entry allocation: reserved")
    print("  publication metadata: preserved")
    if status == "unpublished" and not artifacts:
        print("already unpublished: no files changed")
        return 0
    if arguments.dry_run:
        print("dry run: no files changed")
        return 0
    if not arguments.yes:
        try:
            answer = input(f"Unpublish entry {post.entry}? [y/N] ").strip().lower()
        except EOFError:
            answer = ""
        if answer not in {"y", "yes"}:
            print("unpublish cancelled")
            return 1

    action_root = Path(tempfile.mkdtemp(prefix=".writing-unpublish-", dir=root))
    replacements: list[tuple[Path | None, Path]] = [(None, path) for path in artifacts]
    if status == "published":
        staged_metadata = action_root / "post.json"
        updated_metadata = dict(post.metadata)
        updated_metadata["status"] = "unpublished"
        try:
            write_json(staged_metadata, updated_metadata)
        except OSError as error:
            shutil.rmtree(action_root, ignore_errors=True)
            raise WritingError(f"unpublish could not stage post metadata: {error}") from error
        replacements.append((staged_metadata, post.path))
    commit_staged_action(action_root, replacements, operation="unpublish")

    print(f"unpublished entry {post.entry}; author files and original publication stamp were kept")
    print("commit and deploy these removals before the public website changes")
    print("note: this cannot retract sent email or remove a legacy Sanity copy")
    return 0


def command_erase(arguments: argparse.Namespace, root: Path) -> int:
    post = locate_managed_entry(arguments.entry, root)
    artifacts, _ = publication_artifacts(post, root, include_author_traces=True)
    print_removal_summary("erase", post, artifacts, root)
    print(f"  author folder: erase {relative_display(post.directory, root)}")
    print("  entry allocation: released")
    print("  recovery: committed files remain in Git history; uncommitted files do not")
    if arguments.dry_run:
        print("dry run: no files changed")
        return 0
    if not arguments.yes:
        phrase = f"ERASE {post.entry}"
        try:
            answer = input(f"Type {phrase} to erase this entry permanently: ").strip()
        except EOFError:
            answer = ""
        if answer != phrase:
            print("erase cancelled")
            return 1

    action_root = Path(tempfile.mkdtemp(prefix=".writing-erase-", dir=root))
    replacements: list[tuple[Path | None, Path]] = [(None, path) for path in artifacts]
    replacements.append((None, post.directory))
    commit_staged_action(action_root, replacements, operation="erase")

    print(f"erased entry {post.entry}")
    print("the number may be reused only when it is above every remaining allocation")
    print("commit and deploy these removals before the public website changes")
    print("note: this cannot rewrite Git history, retract sent email, or remove a legacy Sanity copy")
    return 0


def add_music_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--music-title", help="optional song title")
    parser.add_argument("--music-artist", help="artist for --music-title")
    parser.add_argument("--music-album", help="optional album title")
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
    draft.add_argument("--excerpt", help="optional override; otherwise derived on first publish")
    draft.add_argument("--entry", type=normalize_entry, help="defaults to the next global entry")
    draft.add_argument("--date", type=date_argument, help="optional override; otherwise stamped on first publish")
    draft.add_argument("--location")
    draft.add_argument("--trip", help="optional trip or grouping name; required for Venture")
    draft.add_argument("--thread")
    draft.add_argument(
        "--slug",
        help="manual ENTRY-title-subtitle-YYYYMMDD override; requires --date",
    )
    draft.add_argument("--tags", help="comma-separated manual tags")
    draft.add_argument("--collections", help="comma-separated collection slugs")
    draft.add_argument("--latitude", "--lat", dest="latitude", type=float)
    draft.add_argument("--longitude", "--lon", dest="longitude", type=float)
    draft.add_argument("--replace", action="store_true", help="replace an existing draft folder with this slug")
    draft.add_argument("--no-prompt", action="store_true", help="use flags/defaults without interactive questions")
    add_music_arguments(draft)

    review = commands.add_parser("review", help="run the metadata and body review checklist")
    review.add_argument("target", nargs="?", help="entry, slug, post folder, source, or post.json")

    resource = commands.add_parser(
        "resource",
        aliases=["re-source"],
        help="replace a post's active source document without changing its metadata",
    )
    resource.add_argument("target", help="entry, slug, post folder, source, or post.json")
    resource.add_argument(
        "--source",
        type=Path,
        help="updated .docx, .html, .htm, .txt, or .md document; prompts when omitted",
    )
    resource.add_argument("--yes", action="store_true", help="confirm replacement non-interactively")
    resource.add_argument("--dry-run", action="store_true", help="show the replacement plan without writing")

    render = commands.add_parser("render", help="build a private standalone HTML preview")
    render.add_argument("target", nargs="?", help="entry, slug, post folder, source, or post.json")

    view = commands.add_parser("view", help="render a private preview and open it in the default browser")
    view.add_argument("target", nargs="?", help="entry, slug, post folder, source, or post.json")

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

    unpublish = commands.add_parser("unpublish", help="withdraw a published entry but keep its author files")
    unpublish.add_argument("entry", type=normalize_entry, help="explicit entry number")
    unpublish.add_argument("--yes", action="store_true", help="confirm withdrawal non-interactively")
    unpublish.add_argument("--dry-run", action="store_true", help="show exact removals without writing")

    erase = commands.add_parser("erase", help="remove an entry's generated and author files")
    erase.add_argument("entry", type=normalize_entry, help="explicit entry number")
    erase.add_argument("--yes", action="store_true", help="bypass the typed confirmation")
    erase.add_argument("--dry-run", action="store_true", help="show exact removals without writing")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    arguments = parser.parse_args(argv)
    root = arguments.root.expanduser().resolve()
    handlers = {
        "draft": command_draft,
        "review": command_review,
        "resource": command_resource,
        "re-source": command_resource,
        "render": command_render,
        "view": command_view,
        "publish": command_publish,
        "newsletter": command_newsletter,
        "unpublish": command_unpublish,
        "erase": command_erase,
    }
    try:
        return handlers[arguments.command](arguments, root)
    except WritingError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
