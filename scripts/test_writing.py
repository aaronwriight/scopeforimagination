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

            with mock.patch("writing.current_publication_time", return_value="14:37"):
                result, output, error = self.run_cli(root, "publish", "0001", "--dry-run")
            self.assertEqual(result, 0, error)
            self.assertIn("dry run: no files changed", output)
            self.assertFalse((root / "content" / "scope-for-imagination" / "posts" / "0001.json").exists())
            self.assertEqual(writing.locate_post("0001", root).metadata["time"], "")

            with mock.patch("writing.current_publication_time", return_value="14:37"), mock.patch(
                "builtins.input", return_value="n"
            ):
                result, output, error = self.run_cli(root, "publish", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn("publish cancelled", output)
            self.assertFalse((root / "content" / "scope-for-imagination" / "posts" / "0001.json").exists())
            self.assertEqual(writing.locate_post("0001", root).metadata["time"], "")

            with mock.patch("writing.current_publication_time", return_value="14:37"):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            generated = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "posts" / "0001.json"
            )
            self.assertEqual(generated["entry"], "0001")
            self.assertEqual(generated["status"], "published")
            self.assertEqual(generated["time"], "14:37")
            self.assertNotIn("source", generated)
            self.assertIn("<h3>Noticing</h3>", generated["bodyHtml"])
            template = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "newsletters" / "0001.json"
            )
            self.assertEqual(template["path"], "/scope-for-imagination/0001")
            self.assertEqual(writing.locate_post("0001", root).metadata["time"], "14:37")

            with mock.patch("writing.current_publication_time", return_value="22:05"):
                result, _, error = self.run_cli(root, "publish", "0001", "--replace", "--yes")
            self.assertEqual(result, 0, error)
            self.assertEqual(writing.locate_post("0001", root).metadata["time"], "14:37")

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
            result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            self.assertTrue(
                (root / "content" / "scope-for-imagination" / "posts" / "0001.json").is_file()
            )
            venture = writing.load_json_object(
                root / "content" / "venture" / "entries" / f"{post.slug}.json"
            )
            self.assertEqual(venture["$schema"], "../entry.schema.json")
            self.assertEqual(venture["entry"], "0001")
            template = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "newsletters" / "0001.json"
            )
            self.assertEqual(template["path"], f"/venture/{post.slug}")

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
                    "A short note written late in the day.",
                    "2026-08-25",
                    "Cambridge, MA",
                    "musings,night",
                    "",  # no music
                )
            )
            with mock.patch("builtins.input", side_effect=lambda _prompt: next(answers)):
                result, output, error = self.run_cli(root, "draft")
            self.assertEqual(result, 0, error)
            self.assertIn("new draft · entry 0001", output)
            folder = root / "writing" / "sfi" / "0001-small-hours-20260825"
            metadata = writing.load_json_object(folder / "post.json")
            self.assertEqual(metadata["title"], "scope for imagination")
            self.assertEqual(metadata["subtitle"], "small hours")
            self.assertEqual(metadata["tags"], ["musings", "night"])
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

    def test_tty_flags_prefill_prompts_and_keep_thread_optional(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            answers = iter(("", "", "The Japanese House", ""))
            tty = mock.Mock()
            tty.isatty.return_value = True
            with mock.patch.object(writing.sys, "stdin", tty), mock.patch(
                "builtins.input", side_effect=lambda _prompt: next(answers)
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
