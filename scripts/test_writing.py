#!/usr/bin/env python3
"""Focused tests for the unified local writing pipeline."""

from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import writing


class WritingPipelineTests(unittest.TestCase):
    def run_cli(self, root: Path, *arguments: str) -> tuple[int, str, str]:
        stdout = io.StringIO()
        stderr = io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            result = writing.main(["--root", str(root), *arguments])
        return result, stdout.getvalue(), stderr.getvalue()

    def test_global_entry_and_venture_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            legacy = root / "content" / "scope-for-imagination" / "posts"
            legacy.mkdir(parents=True)
            writing.write_json(legacy / "0004.json", {"entry": "0004"})

            result, _, error = self.run_cli(
                root,
                "draft",
                "--blog",
                "venture",
                "--subtitle",
                "ridge notes",
                "--excerpt",
                "A day above the trees.",
                "--date",
                "2026-08-25",
                "--location",
                "Adirondack Mountains, New York",
                "--trip",
                "La Vida August 2026 M1",
                "--tags",
                "hiking",
                "--collections",
                "northeast-115",
                "--lat",
                "44.1",
                "--lon",
                "-73.9",
                "--no-prompt",
            )
            self.assertEqual(result, 0, error)
            folder = root / "writing" / "venture" / "0005-ridge-notes-20260825"
            metadata = writing.load_json_object(folder / "post.json")
            self.assertEqual(metadata["entry"], "0005")
            self.assertEqual(metadata["title"], "venture")
            self.assertEqual(metadata["tags"], ["venture", "hiking"])
            self.assertEqual(metadata["source"], "entry.md")
            self.assertEqual(metadata["time"], "")
            self.assertTrue((folder / "entry.md").is_file())
            self.assertTrue((folder / "images" / ".gitkeep").is_file())
            with mock.patch.dict("os.environ", {"INIT_CWD": str(folder)}):
                result, output, error = self.run_cli(root, "review")
            self.assertEqual(result, 1, error)
            self.assertIn("post body still contains draft placeholders", output)
            self.assertIn("[Begin writing here.", output)

    def test_review_publish_and_newsletter_dry_run(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "A Small Beginning.md"
            source.write_text(
                "## Noticing\n\nA complete paragraph with **care** and [a link](https://example.com).\n",
                encoding="utf-8",
            )
            result, _, error = self.run_cli(
                root,
                "draft",
                "--source",
                str(source),
                "--excerpt",
                "A brief beginning.",
                "--date",
                "2026-08-25",
                "--location",
                "Cambridge, MA",
                "--tags",
                "musings",
                "--no-prompt",
            )
            self.assertEqual(result, 0, error)

            post = writing.locate_post("0001", root)
            self.assertEqual(post.metadata["source"], "entry.md")
            self.assertEqual(post.metadata["time"], "")
            self.assertEqual((post.directory / "entry.md").read_text(encoding="utf-8"), source.read_text(encoding="utf-8"))

            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 0, error)
            self.assertIn("ready to publish", output)
            self.assertIn("time: will be stamped on first publish", output)

            with mock.patch(
                "writing.current_publication_stamp", return_value=("2026-08-26", "14:37")
            ):
                result, output, error = self.run_cli(root, "publish", "0001", "--dry-run")
            self.assertEqual(result, 0, error)
            self.assertIn("dry run: no files changed", output)
            self.assertFalse((root / "content" / "scope-for-imagination" / "posts" / "0001.json").exists())
            self.assertEqual(writing.locate_post("0001", root).metadata["time"], "")

            with mock.patch(
                "writing.current_publication_stamp", return_value=("2026-08-26", "14:37")
            ), mock.patch(
                "builtins.input", return_value="n"
            ):
                result, output, error = self.run_cli(root, "publish", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn("publish cancelled", output)
            self.assertFalse((root / "content" / "scope-for-imagination" / "posts" / "0001.json").exists())
            self.assertEqual(writing.locate_post("0001", root).metadata["time"], "")

            with mock.patch(
                "writing.current_publication_stamp", return_value=("2026-08-26", "14:37")
            ):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            generated = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "posts" / "0001.json"
            )
            self.assertEqual(generated["entry"], "0001")
            self.assertEqual(generated["status"], "published")
            self.assertEqual(generated["date"], "2026-08-25")
            self.assertEqual(generated["time"], "14:37")
            self.assertEqual(generated["excerpt"], "A brief beginning.")
            self.assertNotIn("source", generated)
            self.assertIn("<h3>Noticing</h3>", generated["bodyHtml"])
            template = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "newsletters" / "0001.json"
            )
            self.assertEqual(template["path"], "/scope-for-imagination/0001")
            self.assertEqual(writing.locate_post("0001", root).metadata["time"], "14:37")

            with mock.patch(
                "writing.current_publication_stamp", return_value=("2026-09-01", "22:05")
            ):
                result, _, error = self.run_cli(root, "publish", "0001", "--replace", "--yes")
            self.assertEqual(result, 0, error)
            republished = writing.locate_post("0001", root).metadata
            self.assertEqual(republished["date"], "2026-08-25")
            self.assertEqual(republished["time"], "14:37")
            self.assertEqual(republished["excerpt"], "A brief beginning.")

            result, output, error = self.run_cli(root, "newsletter", "0001", "--dry-run")
            self.assertEqual(result, 0, error)
            self.assertIn("subject:", output)
            self.assertIn("preview:", output)
            self.assertIn("Resend was not called", output)

            with mock.patch("builtins.input", return_value="n"):
                result, output, error = self.run_cli(root, "newsletter", "0001", "--send")
            self.assertEqual(result, 1, error)
            self.assertIn("send cancelled", output)

    def test_venture_review_requires_trip_and_coordinates(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "summit.md"
            source.write_text("A finished summit story.\n", encoding="utf-8")
            with mock.patch("writing.current_draft_date", return_value="2026-08-25"):
                result, _, error = self.run_cli(
                    root,
                    "draft",
                    "--blog",
                    "venture",
                    "--source",
                    str(source),
                    "--excerpt",
                    "A summit story.",
                    "--location",
                    "New York",
                    "--tags",
                    "hiking",
                    "--no-prompt",
                )
            self.assertEqual(result, 0, error)
            result, output, _ = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 1)
            self.assertIn("venture posts require a trip", output)
            self.assertIn("venture posts require latitude", output)
            self.assertIn("venture posts require longitude", output)

            post = writing.locate_post("0001", root)
            metadata = dict(post.metadata)
            metadata["trip"] = "La Vida August 2026 M1"
            metadata["latitude"] = 44.1
            metadata["longitude"] = -73.9
            writing.write_json(post.path, metadata)
            with mock.patch(
                "writing.current_publication_stamp", return_value=("2026-08-26", "09:15")
            ):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            self.assertTrue(
                (root / "content" / "scope-for-imagination" / "posts" / "0001.json").is_file()
            )
            published_post = writing.locate_post("0001", root)
            venture = writing.load_json_object(
                root / "content" / "venture" / "entries" / f"{published_post.slug}.json"
            )
            self.assertEqual(venture["$schema"], "../entry.schema.json")
            self.assertEqual(venture["entry"], "0001")
            template = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "newsletters" / "0001.json"
            )
            self.assertEqual(template["path"], f"/venture/{published_post.slug}")

    def test_first_publish_derives_excerpt_and_finalizes_date_slug_and_time(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "A Patient Beginning.md"
            source.write_text(
                "## Noticing\n\nA complete paragraph with **care** and [a link](https://example.com).\n",
                encoding="utf-8",
            )
            with mock.patch("writing.current_draft_date", return_value="2026-08-25"):
                result, _, error = self.run_cli(
                    root,
                    "draft",
                    "--source",
                    str(source),
                    "--subtitle",
                    "a patient beginning",
                    "--location",
                    "Kansas City, MO",
                    "--tags",
                    "sfi,musings",
                    "--no-prompt",
                )
            self.assertEqual(result, 0, error)

            provisional = root / "writing" / "sfi" / "0001-a-patient-beginning-20260825"
            metadata = writing.load_json_object(provisional / "post.json")
            self.assertEqual(metadata["excerpt"], "")
            self.assertEqual(metadata["date"], "")
            self.assertEqual(metadata["time"], "")

            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 0, error)
            self.assertIn("excerpt: will be derived", output)
            self.assertIn(
                "excerpt preview: A complete paragraph with care and a link.", output
            )
            self.assertIn("date: will be stamped on first publish", output)

            stamp = ("2026-08-26", "14:37")
            with mock.patch("writing.current_publication_stamp", return_value=stamp):
                result, output, error = self.run_cli(
                    root, "publish", "0001", "--dry-run"
                )
            self.assertEqual(result, 0, error)
            self.assertIn("0001-a-patient-beginning-20260826", output)
            self.assertIn("A complete paragraph with care and a link.", output)
            self.assertTrue(provisional.is_dir())
            self.assertEqual(
                writing.load_json_object(provisional / "post.json")["date"], ""
            )

            with mock.patch(
                "writing.current_publication_stamp", return_value=stamp
            ), mock.patch("builtins.input", return_value="n"):
                result, output, error = self.run_cli(root, "publish", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn("publish cancelled", output)
            self.assertTrue(provisional.is_dir())

            with mock.patch(
                "writing.current_publication_stamp",
                side_effect=(("2026-08-26", "23:59"), ("2026-08-27", "00:00")),
            ):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 1)
            self.assertIn("local date changed during review", error)
            self.assertTrue(provisional.is_dir())
            self.assertFalse(
                (root / "content" / "scope-for-imagination" / "posts" / "0001.json").exists()
            )

            with mock.patch("writing.current_publication_stamp", return_value=stamp):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            final = root / "writing" / "sfi" / "0001-a-patient-beginning-20260826"
            self.assertFalse(provisional.exists())
            published_author = writing.load_json_object(final / "post.json")
            self.assertEqual(published_author["date"], "2026-08-26")
            self.assertEqual(published_author["time"], "14:37")
            self.assertEqual(
                published_author["excerpt"],
                "A complete paragraph with care and a link.",
            )
            self.assertEqual(
                published_author["slug"], "0001-a-patient-beginning-20260826"
            )

            generated = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "posts" / "0001.json"
            )
            newsletter = writing.load_json_object(
                root
                / "content"
                / "scope-for-imagination"
                / "newsletters"
                / "0001.json"
            )
            self.assertEqual(generated["date"], "2026-08-26")
            self.assertEqual(generated["time"], "14:37")
            self.assertEqual(generated["excerpt"], published_author["excerpt"])
            self.assertEqual(newsletter["previewText"], published_author["excerpt"])

            with mock.patch(
                "writing.current_publication_stamp", return_value=("2026-09-01", "22:05")
            ):
                result, _, error = self.run_cli(
                    root, "publish", "0001", "--replace", "--yes"
                )
            self.assertEqual(result, 0, error)
            republished = writing.locate_post("0001", root).metadata
            self.assertEqual(republished["date"], "2026-08-26")
            self.assertEqual(republished["time"], "14:37")
            self.assertEqual(republished["excerpt"], published_author["excerpt"])

    def test_excerpt_derivation_skips_headings_and_captions_and_truncates(self) -> None:
        body = (
            "<h2>Do not use this heading</h2>"
            "<figure><img src='ridge.jpg' alt='Do not use alt text'>"
            "<figcaption>Do not use this caption</figcaption></figure>"
            "<blockquote><p>Use this &amp; preserve <em>inline meaning</em>.</p></blockquote>"
        )
        self.assertEqual(
            writing.derive_excerpt(body), "Use this & preserve inline meaning."
        )
        shortened = writing.derive_excerpt(f"<p>{'patient words ' * 30}</p>")
        self.assertLessEqual(len(shortened), 160)
        self.assertTrue(shortened.endswith("…"))
        self.assertFalse(shortened.endswith(" …"))

        markdown = (
            "![ridge](images/ridge.jpg)\n\n"
            "*the summit at dusk*\n\n"
            "This is the actual opening paragraph.\n"
        )
        rendered = writing.markdown_to_html(markdown, "/images/posts/example")
        self.assertEqual(
            writing.derive_excerpt(rendered),
            "This is the actual opening paragraph.",
        )
        caption_only = writing.markdown_to_html(
            "![ridge](images/ridge.jpg)\n\n*the summit at dusk*\n",
            "/images/posts/example",
        )
        self.assertEqual(writing.derive_excerpt(caption_only), "")
        self.assertEqual(
            writing.derive_excerpt(
                "<head><title>Wrong</title></head><div>Right prose.</div>"
            ),
            "Right prose.",
        )

    def test_review_rejects_missing_prose_and_noncanonical_source_name(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            heading = root / "heading.md"
            heading.write_text("# A heading without prose\n", encoding="utf-8")
            result, _, error = self.run_cli(
                root,
                "draft",
                "--source",
                str(heading),
                "--subtitle",
                "heading only",
                "--location",
                "Kansas City, MO",
                "--tags",
                "musings",
                "--no-prompt",
            )
            self.assertEqual(result, 0, error)
            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn("excerpt cannot be derived", output)

            post = writing.locate_post("0001", root)
            renamed_source = post.directory / "source.md"
            (post.directory / "entry.md").rename(renamed_source)
            metadata = dict(post.metadata)
            metadata["source"] = "source.md"
            metadata["excerpt"] = "A manual excerpt."
            writing.write_json(post.path, metadata)
            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn(
                "source must be entry.docx, entry.html, entry.txt, or entry.md",
                output,
            )

    def test_publish_rolls_back_when_a_promotion_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "complete.md"
            source.write_text("A complete opening paragraph.\n", encoding="utf-8")
            result, _, error = self.run_cli(
                root,
                "draft",
                "--source",
                str(source),
                "--subtitle",
                "rollback test",
                "--excerpt",
                "A manual excerpt.",
                "--date",
                "2026-08-26",
                "--location",
                "Kansas City, MO",
                "--tags",
                "musings",
                "--no-prompt",
            )
            self.assertEqual(result, 0, error)
            post = writing.locate_post("0001", root)
            original_move = writing.move_path
            move_count = 0

            def fail_third_move(source_path: Path, destination_path: Path) -> None:
                nonlocal move_count
                move_count += 1
                if move_count == 3:
                    raise OSError("injected promotion failure")
                original_move(source_path, destination_path)

            with mock.patch(
                "writing.current_publication_stamp",
                return_value=("2026-08-26", "14:37"),
            ), mock.patch("writing.move_path", side_effect=fail_third_move):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 1)
            self.assertIn("previous files were restored", error)
            self.assertFalse(
                (root / "content" / "scope-for-imagination" / "posts" / "0001.json").exists()
            )
            self.assertFalse(
                (
                    root
                    / "content"
                    / "scope-for-imagination"
                    / "newsletters"
                    / "0001.json"
                ).exists()
            )
            restored = writing.load_json_object(post.path)
            self.assertEqual(restored["status"], "draft")
            self.assertEqual(restored["time"], "")

    def test_bare_draft_runs_interactive_wizard(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            answers = iter(
                (
                    "",  # blog: sfi
                    "",  # no existing document
                    "",  # format: md
                    "",  # default title
                    "small hours",
                    "Cambridge, MA",
                    "musings,night",
                    "Late summer notes",
                    "late-summer-notes",
                    "slow-living",
                    "",  # no music
                )
            )
            prompts: list[str] = []

            def answer(prompt: str) -> str:
                prompts.append(prompt)
                return next(answers)

            with mock.patch(
                "writing.current_draft_date", return_value="2026-08-25"
            ), mock.patch("builtins.input", side_effect=answer):
                result, output, error = self.run_cli(root, "draft")
            self.assertEqual(result, 0, error)
            self.assertIn('post.json "entry" (automatic): "0001"', output)
            self.assertIn(
                'post.json "source" (automatic from import/format): "entry.md"', output
            )
            self.assertIn(
                'post.json "slug" (provisional from entry + subtitle + draft date): '
                '"0001-small-hours-20260825"',
                output,
            )
            self.assertIn('post.json "excerpt" (derived on first publish): ""', output)
            self.assertIn('post.json "date" (stamped on first publish): ""', output)
            expected_fields = (
                'post.json "blog"',
                'post.json "source"',
                'post.json "source"',
                'post.json "title"',
                'post.json "subtitle"',
                'post.json "location"',
                'post.json "tags"',
                'post.json "trip"',
                'post.json "thread"',
                'post.json "collections"',
                'post.json "music"',
            )
            self.assertEqual(len(prompts), len(expected_fields))
            for prompt, field in zip(prompts, expected_fields):
                self.assertTrue(prompt.startswith(field), prompt)
            folder = root / "writing" / "sfi" / "0001-small-hours-20260825"
            metadata = writing.load_json_object(folder / "post.json")
            self.assertEqual(metadata["title"], "scope for imagination")
            self.assertEqual(metadata["subtitle"], "small hours")
            self.assertEqual(metadata["tags"], ["musings", "night"])
            self.assertEqual(metadata["trip"], "Late summer notes")
            self.assertEqual(metadata["thread"], "late-summer-notes")
            self.assertEqual(metadata["collections"], ["slow-living"])
            self.assertEqual(metadata["excerpt"], "")
            self.assertEqual(metadata["date"], "")
            self.assertEqual(metadata["source"], "entry.md")
            self.assertEqual(metadata["time"], "")
            self.assertIn("::: center", (folder / "entry.md").read_text(encoding="utf-8"))

    def test_blank_formats_and_imports_use_entry_filenames(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for entry, source_format in (("1", "html"), ("2", "txt")):
                result, _, error = self.run_cli(
                    root,
                    "draft",
                    "--entry",
                    entry,
                    "--subtitle",
                    f"{source_format} notes",
                    "--date",
                    "2026-08-25",
                    "--format",
                    source_format,
                    "--no-prompt",
                )
                self.assertEqual(result, 0, error)
                folder = root / "writing" / "sfi" / f"000{entry}-{source_format}-notes-20260825"
                self.assertTrue((folder / f"entry.{source_format}").is_file())
                self.assertEqual(
                    writing.load_json_object(folder / "post.json")["source"],
                    f"entry.{source_format}",
                )

            imported = root / "My Existing Note.htm"
            imported.write_text("<body><p>Imported.</p></body>\n", encoding="utf-8")
            result, _, error = self.run_cli(
                root,
                "draft",
                "--source",
                str(imported),
                "--subtitle",
                "imported note",
                "--date",
                "2026-08-25",
                "--no-prompt",
            )
            self.assertEqual(result, 0, error)
            folder = root / "writing" / "sfi" / "0003-imported-note-20260825"
            self.assertEqual(
                (folder / "entry.html").read_text(encoding="utf-8"),
                imported.read_text(encoding="utf-8"),
            )
            self.assertEqual(writing.load_json_object(folder / "post.json")["source"], "entry.html")

            result, _, error = self.run_cli(
                root,
                "draft",
                "--source",
                str(imported),
                "--format",
                "md",
                "--subtitle",
                "invalid source choice",
                "--no-prompt",
            )
            self.assertEqual(result, 1)
            self.assertIn("either --source or --format", error)

    def test_manual_slug_requires_an_explicit_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result, _, error = self.run_cli(
                root,
                "draft",
                "--subtitle",
                "custom words",
                "--slug",
                "0001-a-custom-slug-20260825",
                "--no-prompt",
            )
            self.assertEqual(result, 1)
            self.assertIn("--slug requires --date", error)

            result, _, error = self.run_cli(
                root,
                "draft",
                "--subtitle",
                "custom words",
                "--slug",
                "0001-a-custom-slug-20260825",
                "--date",
                "2026-08-25",
                "--no-prompt",
            )
            self.assertEqual(result, 0, error)
            self.assertTrue(
                (
                    root
                    / "writing"
                    / "sfi"
                    / "0001-a-custom-slug-20260825"
                    / "post.json"
                ).is_file()
            )

    def test_tty_flags_prefill_prompts_and_keep_thread_optional(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            answers = iter(("", "The Japanese House", "", ""))
            tty = mock.Mock()
            tty.isatty.return_value = True
            prompts: list[str] = []

            def answer(prompt: str) -> str:
                prompts.append(prompt)
                return next(answers)

            with mock.patch.object(writing.sys, "stdin", tty), mock.patch(
                "builtins.input", side_effect=answer
            ):
                result, _, error = self.run_cli(
                    root,
                    "draft",
                    "--blog",
                    "venture",
                    "--format",
                    "md",
                    "--title",
                    "venture",
                    "--subtitle",
                    "ridge song",
                    "--excerpt",
                    "A day on the ridge.",
                    "--date",
                    "2026-08-25",
                    "--location",
                    "Adirondack Mountains, New York",
                    "--trip",
                    "La Vida August 2026 M1",
                    "--tags",
                    "hiking",
                    "--collections",
                    "northeast-115",
                    "--lat",
                    "44.1",
                    "--lon",
                    "-73.9",
                    "--music-title",
                    "Saw You in a Dream",
                )
            self.assertEqual(result, 0, error)
            expected_prompts = (
                'post.json "thread" — shared story slug (blank = standalone)',
                'post.json "music.artist" — artist',
                'post.json "music.album" — album title (optional)',
                'post.json "music.url" — song URL (optional)',
            )
            self.assertEqual(len(prompts), len(expected_prompts))
            for prompt, expected in zip(prompts, expected_prompts):
                self.assertTrue(prompt.startswith(expected), prompt)
            metadata = writing.locate_post("0001", root).metadata
            self.assertIsNone(metadata["thread"])
            self.assertEqual(
                metadata["music"],
                {
                    "title": "Saw You in a Dream",
                    "artist": "The Japanese House",
                },
            )

    def test_markdown_template_constructs_render(self) -> None:
        source = """<!-- ![example](images/not-a-real-file.jpg) -->
# Section

::: center
Centered *text*.

![A ridge](images/ridge.jpg)
:::

> A quoted line.

::: callout
**Note:** A useful aside.
:::
"""
        rendered = writing.markdown_to_html(source, "/images/posts/example")
        self.assertIn("<h2>Section</h2>", rendered)
        self.assertIn('class="entry-centered"', rendered)
        self.assertIn('src="/images/posts/example/ridge.jpg"', rendered)
        self.assertIn("<blockquote>", rendered)
        self.assertIn('class="entry-callout"', rendered)
        self.assertNotIn("not-a-real-file", rendered)

    def test_post_command_is_not_part_of_the_suite(self) -> None:
        parser = writing.build_parser()
        subparsers = next(
            action
            for action in parser._actions
            if isinstance(action, writing.argparse._SubParsersAction)
        )
        self.assertEqual(set(subparsers.choices), {"draft", "review", "publish", "newsletter"})

    def test_replace_same_unpublished_folder(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            base_arguments = (
                "draft",
                "--entry",
                "7",
                "--subtitle",
                "replace me",
                "--date",
                "2026-08-25",
                "--no-prompt",
            )
            result, _, error = self.run_cli(root, *base_arguments)
            self.assertEqual(result, 0, error)
            source = root / "writing" / "sfi" / "0007-replace-me-20260825" / "entry.md"
            result, _, error = self.run_cli(
                root, *base_arguments, "--source", str(source), "--replace"
            )
            self.assertEqual(result, 1)
            self.assertIn("inside the draft folder being replaced", error)
            self.assertTrue(source.is_file())
            result, _, error = self.run_cli(root, *base_arguments, "--replace")
            self.assertEqual(result, 0, error)
            metadata = writing.load_json_object(
                root / "writing" / "sfi" / "0007-replace-me-20260825" / "post.json"
            )
            self.assertEqual(metadata["status"], "draft")


if __name__ == "__main__":
    unittest.main()
