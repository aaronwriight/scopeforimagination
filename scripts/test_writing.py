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
                "--time",
                "12:30",
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
            )
            self.assertEqual(result, 0, error)
            folder = root / "writing" / "venture" / "0005-ridge-notes-20260825"
            metadata = writing.load_json_object(folder / "post.json")
            self.assertEqual(metadata["entry"], "0005")
            self.assertEqual(metadata["title"], "venture")
            self.assertEqual(metadata["tags"], ["venture", "hiking"])
            self.assertTrue((folder / "source.md").is_file())
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
                "--time",
                "08:05",
                "--location",
                "Cambridge, MA",
                "--tags",
                "musings",
            )
            self.assertEqual(result, 0, error)

            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 0, error)
            self.assertIn("ready to publish", output)

            result, output, error = self.run_cli(root, "publish", "0001", "--dry-run")
            self.assertEqual(result, 0, error)
            self.assertIn("dry run: no files changed", output)
            self.assertFalse((root / "content" / "scope-for-imagination" / "posts" / "0001.json").exists())

            with mock.patch("builtins.input", return_value="n"):
                result, output, error = self.run_cli(root, "publish", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn("publish cancelled", output)
            self.assertFalse((root / "content" / "scope-for-imagination" / "posts" / "0001.json").exists())

            result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            generated = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "posts" / "0001.json"
            )
            self.assertEqual(generated["entry"], "0001")
            self.assertEqual(generated["status"], "published")
            self.assertNotIn("source", generated)
            self.assertIn("<h3>Noticing</h3>", generated["bodyHtml"])
            template = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "newsletters" / "0001.json"
            )
            self.assertEqual(template["path"], "/scope-for-imagination/0001")

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
            )
            result, _, error = self.run_cli(root, *base_arguments)
            self.assertEqual(result, 0, error)
            result, _, error = self.run_cli(root, *base_arguments, "--replace")
            self.assertEqual(result, 0, error)
            metadata = writing.load_json_object(
                root / "writing" / "sfi" / "0007-replace-me-20260825" / "post.json"
            )
            self.assertEqual(metadata["status"], "draft")


if __name__ == "__main__":
    unittest.main()
