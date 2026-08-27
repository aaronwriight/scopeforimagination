#!/usr/bin/env python3
"""Focused tests for the unified local writing pipeline."""

from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
import zipfile
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

    def create_post(
        self,
        root: Path,
        *,
        entry: str = "1",
        blog: str = "sfi",
        published: bool = False,
        with_image: bool = False,
    ) -> writing.AuthorPost:
        normalized_entry = entry.zfill(4)
        source = root / f"seed-{normalized_entry}.md"
        image_markup = "\n\n![A summit view](images/summit.jpg)\n" if with_image else ""
        source.write_text(
            f"## Field notes\n\nA complete opening paragraph for entry {normalized_entry}.{image_markup}",
            encoding="utf-8",
        )
        arguments = [
            "draft",
            "--entry",
            entry,
            "--blog",
            blog,
            "--source",
            str(source),
            "--subtitle",
            f"entry {normalized_entry}",
            "--excerpt",
            f"Excerpt for entry {normalized_entry}.",
            "--date",
            "2026-08-25",
            "--location",
            "Adirondack Mountains, New York",
            "--tags",
            "hiking",
            "--no-prompt",
        ]
        if blog == "venture":
            arguments.extend(
                (
                    "--trip",
                    "La Vida August 2026 M1",
                    "--collections",
                    "northeast-115",
                    "--lat",
                    "44.1",
                    "--lon",
                    "-73.9",
                )
            )
        result, _, error = self.run_cli(root, *arguments)
        self.assertEqual(result, 0, error)
        post = writing.locate_post(normalized_entry, root)
        if with_image:
            (post.directory / "images" / "summit.jpg").write_bytes(b"private-author-image")
        if published:
            with mock.patch(
                "writing.current_publication_stamp",
                return_value=("2026-08-25", "14:37"),
            ):
                result, _, error = self.run_cli(
                    root, "publish", normalized_entry, "--yes"
                )
            self.assertEqual(result, 0, error)
            post = writing.locate_post(normalized_entry, root)
        return post

    @staticmethod
    def publication_paths(root: Path, post: writing.AuthorPost) -> dict[str, Path]:
        paths = {
            "sfi": root
            / "content"
            / "scope-for-imagination"
            / "posts"
            / f"{post.entry}.json",
            "newsletter": root
            / "content"
            / "scope-for-imagination"
            / "newsletters"
            / f"{post.entry}.json",
            "images": root / "public" / "images" / "posts" / post.slug,
        }
        if post.blog == "venture":
            paths["venture"] = (
                root / "content" / "venture" / "entries" / f"{post.slug}.json"
            )
        return paths

    @staticmethod
    def snapshot_files(root: Path) -> dict[str, bytes]:
        return {
            str(path.relative_to(root)): path.read_bytes()
            for path in sorted(root.rglob("*"))
            if path.is_file()
        }

    @staticmethod
    def create_docx(
        path: Path,
        *,
        heading: str = "A Word heading",
        paragraph: str = "A complete paragraph converted from Word.",
        image_bytes: bytes = b"embedded-word-image",
    ) -> None:
        """Write the smallest Word archive needed by the local DOCX renderer."""
        content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Default Extension="png" ContentType="image/png" />
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" />
</Types>
"""
        package_relationships = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" />
</Relationships>
"""
        document_relationships = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/ridge.png" />
  <Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/field-note" TargetMode="External" />
</Relationships>
"""
        document = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1" /></w:pPr>
      <w:r><w:t>{heading}</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>{paragraph}</w:t></w:r></w:p>
    <w:p>
      <w:hyperlink r:id="rIdLink"><w:r><w:t>A useful link</w:t></w:r></w:hyperlink>
    </w:p>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline>
            <wp:docPr id="1" name="ridge.png" descr="A test ridge" />
            <a:graphic><a:graphicData><a:blip r:embed="rIdImage" /></a:graphicData></a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  </w:body>
</w:document>
"""
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", content_types)
            archive.writestr("_rels/.rels", package_relationships)
            archive.writestr("word/document.xml", document)
            archive.writestr("word/_rels/document.xml.rels", document_relationships)
            archive.writestr("word/media/ridge.png", image_bytes)

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
            folder = (
                root
                / "writing"
                / "venture"
                / "0005-venture-ridge-notes-20260825"
            )
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
            self.assertIn(
                "review · 0001 · sfi · scope for imagination · A Small Beginning",
                output,
            )
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

            provisional = (
                root
                / "writing"
                / "sfi"
                / "0001-scope-for-imagination-a-patient-beginning-20260825"
            )
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
            self.assertIn(
                "0001-scope-for-imagination-a-patient-beginning-20260826",
                output,
            )
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
            final = (
                root
                / "writing"
                / "sfi"
                / "0001-scope-for-imagination-a-patient-beginning-20260826"
            )
            self.assertFalse(provisional.exists())
            published_author = writing.load_json_object(final / "post.json")
            self.assertEqual(published_author["date"], "2026-08-26")
            self.assertEqual(published_author["time"], "14:37")
            self.assertEqual(
                published_author["excerpt"],
                "A complete paragraph with care and a link.",
            )
            self.assertEqual(
                published_author["slug"],
                "0001-scope-for-imagination-a-patient-beginning-20260826",
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

    def test_first_publish_atomically_finalizes_docx_html_source_and_folder(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manuscript = root / "0001-sfi.docx"
            self.create_docx(
                manuscript,
                paragraph="The opening paragraph for the first formal entry.",
            )
            with mock.patch("writing.current_draft_date", return_value="2026-08-25"):
                result, _, error = self.run_cli(
                    root,
                    "draft",
                    "--source",
                    str(manuscript),
                    "--title",
                    "Scope for Imagination",
                    "--subtitle",
                    "An ode to slow living",
                    "--location",
                    "Kansas City, MO",
                    "--tags",
                    "sfi,musings",
                    "--no-prompt",
                )
            self.assertEqual(result, 0, error)

            provisional_slug = (
                "0001-scope-for-imagination-an-ode-to-slow-living-20260825"
            )
            final_slug = (
                "0001-scope-for-imagination-an-ode-to-slow-living-20260826"
            )
            provisional = root / "writing" / "sfi" / provisional_slug
            final = root / "writing" / "sfi" / final_slug
            provisional_source = provisional / f"{provisional_slug}.html"
            final_source = final / f"{final_slug}.html"
            source_bytes = provisional_source.read_bytes()
            before_publish = self.snapshot_files(root)
            stamp = ("2026-08-26", "14:37")

            with mock.patch("writing.current_publication_stamp", return_value=stamp):
                result, output, error = self.run_cli(
                    root, "publish", "0001", "--dry-run"
                )
            self.assertEqual(result, 0, error)
            self.assertIn(
                f"author source: {provisional_slug}.html → {final_slug}.html",
                output,
            )
            self.assertEqual(self.snapshot_files(root), before_publish)

            original_move = writing.move_path
            injected_failure = False

            def fail_final_metadata_install(
                source_path: Path, destination_path: Path
            ) -> None:
                nonlocal injected_failure
                if (
                    not injected_failure
                    and destination_path.resolve() == (final / "post.json").resolve()
                ):
                    injected_failure = True
                    raise OSError("injected failure after author source rename")
                original_move(source_path, destination_path)

            with mock.patch(
                "writing.current_publication_stamp", return_value=stamp
            ), mock.patch(
                "writing.move_path", side_effect=fail_final_metadata_install
            ):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 1)
            self.assertIn("previous files were restored", error)
            self.assertEqual(self.snapshot_files(root), before_publish)
            self.assertTrue(provisional_source.is_file())
            self.assertFalse(final.exists())
            restored = writing.load_json_object(provisional / "post.json")
            self.assertEqual(restored["slug"], provisional_slug)
            self.assertEqual(restored["source"], f"{provisional_slug}.html")

            with mock.patch("writing.current_publication_stamp", return_value=stamp):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            self.assertFalse(provisional.exists())
            self.assertTrue(final_source.is_file())
            self.assertEqual(final_source.read_bytes(), source_bytes)
            self.assertFalse((final / f"{provisional_slug}.html").exists())
            self.assertTrue((final / manuscript.name).is_file())

            published_author = writing.load_json_object(final / "post.json")
            self.assertEqual(published_author["slug"], final_slug)
            self.assertEqual(published_author["source"], f"{final_slug}.html")
            self.assertEqual(published_author["status"], "published")
            generated = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "posts" / "0001.json"
            )
            self.assertIn(
                f'/images/posts/{final_slug}/docx/image-1.png',
                generated["bodyHtml"],
            )
            self.assertEqual(
                (
                    root
                    / "public"
                    / "images"
                    / "posts"
                    / final_slug
                    / "docx"
                    / "image-1.png"
                ).read_bytes(),
                b"embedded-word-image",
            )

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
        self.assertLessEqual(len(shortened), 150)
        self.assertTrue(shortened.endswith("…"))
        self.assertFalse(shortened.endswith(" …"))

        complete_two_paragraph_body = (
            "<p>A short first paragraph.</p>"
            "<p>A short second paragraph.</p>"
        )
        self.assertEqual(
            writing.derive_excerpt(complete_two_paragraph_body),
            "A short first paragraph. A short second paragraph.",
        )
        continuing_body = complete_two_paragraph_body + "<p>More prose follows.</p>"
        self.assertEqual(
            writing.derive_excerpt(continuing_body),
            "A short first paragraph. A short second paragraph…",
        )
        self.assertLessEqual(len(writing.derive_excerpt(continuing_body)), 150)

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

    def test_review_blocks_nonportable_image_references_and_allows_portable_ones(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "entry.html"
            source.write_text(
                "<html><body><p>A complete entry.</p></body></html>",
                encoding="utf-8",
            )
            result, _, error = self.run_cli(
                root,
                "draft",
                "--source",
                str(source),
                "--subtitle",
                "portable images",
                "--excerpt",
                "A complete entry.",
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

            post.source_path.write_text(
                """<html><body>
<p>A complete entry.</p>
<img src="/Users/example/private.jpg" alt="private" />
<img src="file:///Users/example/private.jpg" alt="private" />
<img src="images/good.jpg" srcset="C:\\private\\large.jpg 2x" alt="private" />
</body></html>
""",
                encoding="utf-8",
            )
            (post.directory / "images" / "good.jpg").write_bytes(b"portable")
            (post.directory / "images" / "unused.jpg").write_bytes(b"private")
            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn("image reference is not portable", output)

            post.source_path.write_text(
                """<html><body>
<p>A complete entry.</p>
<img src="images/missing.jpg" alt="missing" />
</body></html>
""",
                encoding="utf-8",
            )
            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn("referenced image is missing: images/missing.jpg", output)

            post.source_path.write_text(
                """<html><body>
<p>A complete entry.</p>
<img src="images/good.jpg" alt="local" />
<picture><source srcset="images/good.jpg 2x" /></picture>
<img src="https://example.com/remote.jpg" alt="remote" />
<video><source src="videos/clip.mp4" type="video/mp4" /></video>
</body></html>
""",
                encoding="utf-8",
            )
            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 0, error)
            self.assertIn("ready to publish", output)

            with mock.patch(
                "writing.current_publication_stamp",
                return_value=("2026-08-26", "14:37"),
            ):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            published = writing.load_json_object(
                root / "content" / "scope-for-imagination" / "posts" / "0001.json"
            )
            image_root = f"/images/posts/{post.slug}"
            self.assertIn(
                f'srcset="{image_root}/good.jpg 2x"', published["bodyHtml"]
            )
            public_images = root / "public" / "images" / "posts" / post.slug
            self.assertTrue((public_images / "good.jpg").is_file())
            self.assertFalse((public_images / "unused.jpg").exists())

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root)
            post.source_path.write_text(
                "A complete entry.\n\n![private](file:///Users/example/private.jpg)\n",
                encoding="utf-8",
            )
            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn("image reference is not portable", output)

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
                "source must be entry.md, entry.html, entry.txt, or the full post slug plus .html",
                output,
            )

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root)
            mismatched_name = (
                "0001-scope-for-imagination-some-other-entry-20260825.html"
            )
            mismatched_source = post.directory / mismatched_name
            (post.directory / "entry.md").rename(mismatched_source)
            metadata = dict(post.metadata)
            metadata["source"] = mismatched_name
            writing.write_json(post.path, metadata)

            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 1, error)
            self.assertIn(
                "source must be entry.md, entry.html, entry.txt, or the full post slug plus .html",
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

    def test_publish_incomplete_rollback_retains_recovery_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manuscript = root / "recovery-test.docx"
            self.create_docx(manuscript)
            with mock.patch("writing.current_draft_date", return_value="2026-08-25"):
                result, _, error = self.run_cli(
                    root,
                    "draft",
                    "--source",
                    str(manuscript),
                    "--subtitle",
                    "recovery test",
                    "--location",
                    "Kansas City, MO",
                    "--tags",
                    "musings",
                    "--no-prompt",
                )
            self.assertEqual(result, 0, error)

            post = writing.locate_post("0001", root)
            final_slug = writing.slug_for_publication_date(post.slug, "2026-08-26")
            final_metadata_path = (
                post.directory.parent / final_slug / "post.json"
            ).resolve()
            original_move = writing.move_path
            metadata_install_attempts = 0

            def fail_promotion_and_metadata_restore(
                source_path: Path, destination_path: Path
            ) -> None:
                nonlocal metadata_install_attempts
                if destination_path.resolve() == final_metadata_path:
                    metadata_install_attempts += 1
                    if metadata_install_attempts == 1:
                        raise OSError("injected publication promotion failure")
                    if metadata_install_attempts == 2:
                        raise OSError("injected metadata rollback failure")
                original_move(source_path, destination_path)

            with mock.patch(
                "writing.current_publication_stamp",
                return_value=("2026-08-26", "14:37"),
            ), mock.patch(
                "writing.move_path", side_effect=fail_promotion_and_metadata_restore
            ):
                result, _, error = self.run_cli(root, "publish", "0001", "--yes")

            self.assertEqual(result, 1)
            self.assertEqual(metadata_install_attempts, 2)
            self.assertIn("rollback was incomplete", error)
            marker = "recovery files remain in "
            self.assertIn(marker, error)
            recovery_directory = Path(error.rsplit(marker, 1)[1].strip())
            self.assertTrue(recovery_directory.is_dir(), recovery_directory)
            self.assertTrue(
                recovery_directory.resolve().is_relative_to(root.resolve())
            )
            self.assertTrue((recovery_directory / "backups").is_dir())
            retained_metadata = [
                path
                for path in (recovery_directory / "backups").rglob("*")
                if path.is_file() and path.name.endswith("-post.json")
            ]
            self.assertTrue(retained_metadata)
            self.assertEqual(
                writing.load_json_object(retained_metadata[0])["entry"], "0001"
            )

    def test_commit_publication_handles_keyboard_interrupt_and_failed_rollback(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            author = root / "writing" / "sfi" / "provisional"
            final_author = root / "writing" / "sfi" / "final"
            author.mkdir(parents=True)
            (author / "post.json").write_bytes(b"original author metadata")
            first_target = root / "content" / "first.json"
            second_target = root / "content" / "second.json"
            first_target.parent.mkdir(parents=True)
            first_target.write_bytes(b"original first output")
            second_target.write_bytes(b"original second output")
            action_root = root / ".writing-interrupt"
            action_root.mkdir()
            staged_first = action_root / "first.json"
            staged_second = action_root / "second.json"
            staged_first.write_bytes(b"new first output")
            staged_second.write_bytes(b"new second output")
            backup_root = action_root / "backups"
            interrupt = KeyboardInterrupt("injected publication interrupt")
            original_move = writing.move_path

            def interrupt_after_first_promotion(
                source_path: Path, destination_path: Path
            ) -> None:
                if destination_path.resolve() == (
                    backup_root / "01-second.json"
                ).resolve():
                    raise interrupt
                original_move(source_path, destination_path)

            with mock.patch(
                "writing.move_path", side_effect=interrupt_after_first_promotion
            ), self.assertRaises(KeyboardInterrupt) as raised:
                writing.commit_publication(
                    author,
                    final_author,
                    [
                        (staged_first, first_target),
                        (staged_second, second_target),
                    ],
                    backup_root,
                )

            self.assertIs(raised.exception, interrupt)
            self.assertTrue(author.is_dir())
            self.assertFalse(final_author.exists())
            self.assertEqual(
                (author / "post.json").read_bytes(), b"original author metadata"
            )
            self.assertEqual(first_target.read_bytes(), b"original first output")
            self.assertEqual(second_target.read_bytes(), b"original second output")

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            author = root / "writing" / "sfi" / "provisional"
            final_author = root / "writing" / "sfi" / "final"
            author.mkdir(parents=True)
            (author / "post.json").write_bytes(b"original author metadata")
            first_target = root / "content" / "first.json"
            second_target = root / "content" / "second.json"
            first_target.parent.mkdir(parents=True)
            first_target.write_bytes(b"original first output")
            second_target.write_bytes(b"original second output")
            action_root = root / ".writing-interrupt-recovery"
            action_root.mkdir()
            staged_first = action_root / "first.json"
            staged_second = action_root / "second.json"
            staged_first.write_bytes(b"new first output")
            staged_second.write_bytes(b"new second output")
            backup_root = action_root / "backups"
            original_move = writing.move_path
            interrupted = False
            rollback_failed = False

            def interrupt_then_fail_rollback(
                source_path: Path, destination_path: Path
            ) -> None:
                nonlocal interrupted, rollback_failed
                if not interrupted and destination_path.resolve() == (
                    backup_root / "01-second.json"
                ).resolve():
                    interrupted = True
                    raise KeyboardInterrupt("injected publication interrupt")
                if (
                    interrupted
                    and not rollback_failed
                    and destination_path.resolve() == first_target.resolve()
                ):
                    rollback_failed = True
                    raise OSError("injected rollback failure")
                original_move(source_path, destination_path)

            with mock.patch(
                "writing.move_path", side_effect=interrupt_then_fail_rollback
            ), self.assertRaises(writing.TransactionError) as raised:
                writing.commit_staged_author_action(
                    action_root,
                    author,
                    final_author,
                    [
                        (staged_first, first_target),
                        (staged_second, second_target),
                    ],
                    operation="interrupt test",
                )

            self.assertTrue(interrupted)
            self.assertTrue(rollback_failed)
            self.assertTrue(raised.exception.recovery_required)
            self.assertIsInstance(raised.exception.__cause__, KeyboardInterrupt)
            self.assertIn("rollback was incomplete", str(raised.exception))
            self.assertIn("recovery files remain in", str(raised.exception))
            self.assertTrue(action_root.is_dir())
            retained_first = next(
                path
                for path in backup_root.iterdir()
                if path.is_file() and path.name.endswith("-first.json")
            )
            self.assertEqual(retained_first.read_bytes(), b"original first output")
            self.assertTrue(author.is_dir())
            self.assertFalse(final_author.exists())

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
                'post.json "slug" (provisional from entry + title + subtitle + draft date): '
                '"0001-scope-for-imagination-small-hours-20260825"',
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
            folder = (
                root
                / "writing"
                / "sfi"
                / "0001-scope-for-imagination-small-hours-20260825"
            )
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
                folder = (
                    root
                    / "writing"
                    / "sfi"
                    / f"000{entry}-scope-for-imagination-{source_format}-notes-20260825"
                )
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
            folder = (
                root
                / "writing"
                / "sfi"
                / "0003-scope-for-imagination-imported-note-20260825"
            )
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

    def test_docx_draft_creates_editable_slug_html_and_keeps_word_manuscript(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manuscript = root / "0001-sfi.docx"
            self.create_docx(manuscript)
            original_word = manuscript.read_bytes()

            result, output, error = self.run_cli(
                root,
                "draft",
                "--source",
                str(manuscript),
                "--title",
                "Scope for Imagination",
                "--subtitle",
                "An ode to slow living",
                "--date",
                "2026-08-26",
                "--location",
                "Kansas City, MO",
                "--tags",
                "sfi,musings",
                "--no-prompt",
            )
            self.assertEqual(result, 0, error)

            slug = (
                "0001-scope-for-imagination-an-ode-to-slow-living-20260826"
            )
            folder = root / "writing" / "sfi" / slug
            metadata = writing.load_json_object(folder / "post.json")
            self.assertEqual(metadata["slug"], slug)
            self.assertEqual(metadata["source"], f"{slug}.html")
            self.assertIn(
                f'converted it to editable "{slug}.html" (1 embedded images)',
                output,
            )

            converted = folder / f"{slug}.html"
            converted_html = converted.read_text(encoding="utf-8")
            self.assertIn("<!doctype html>", converted_html.lower())
            self.assertIn("<html", converted_html)
            self.assertIn("<body>", converted_html)
            self.assertIn("<h2>A Word heading</h2>", converted_html)
            self.assertIn(
                "<p>A complete paragraph converted from Word.</p>", converted_html
            )
            self.assertIn(
                '<a href="https://example.com/field-note">A useful link</a>',
                converted_html,
            )
            self.assertIn(
                '<img src="images/docx/image-1.png" alt="A test ridge"',
                converted_html,
            )
            self.assertFalse((folder / "entry.docx").exists())
            self.assertEqual((folder / manuscript.name).read_bytes(), original_word)
            self.assertEqual(manuscript.read_bytes(), original_word)
            self.assertEqual(
                (folder / "images" / "docx" / "image-1.png").read_bytes(),
                b"embedded-word-image",
            )

            result, review_output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 0, error)
            self.assertIn("ready to publish", review_output)

    def test_corrupt_docx_draft_and_resource_leave_no_partial_mutation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            corrupt = root / "broken.docx"
            corrupt.write_bytes(b"this is not a Word archive")
            before = self.snapshot_files(root)

            result, _, error = self.run_cli(
                root,
                "draft",
                "--source",
                str(corrupt),
                "--subtitle",
                "broken Word import",
                "--no-prompt",
            )
            self.assertEqual(result, 1)
            self.assertIn("Word document could not be converted", error)
            self.assertEqual(self.snapshot_files(root), before)
            self.assertEqual(writing.next_entry(root), "0001")

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_post(root, published=True, with_image=True)
            corrupt = root / "broken.docx"
            corrupt.write_bytes(b"this is not a Word archive")
            before = self.snapshot_files(root)

            result, _, error = self.run_cli(
                root,
                "resource",
                "0001",
                "--source",
                str(corrupt),
                "--yes",
            )
            self.assertEqual(result, 1)
            self.assertIn("resource could not prepare the updated document", error)
            self.assertEqual(self.snapshot_files(root), before)

    def test_draft_replace_with_corrupt_docx_preserves_existing_draft(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root, with_image=True)
            post.source_path.write_text(
                "An irreplaceable in-progress draft.\n", encoding="utf-8"
            )
            (post.directory / "private-working-note.txt").write_text(
                "This author-side file must survive a failed replacement.\n",
                encoding="utf-8",
            )
            corrupt = root / "broken-replacement.docx"
            corrupt.write_bytes(b"this is not a Word archive")
            before = self.snapshot_files(root)

            result, _, error = self.run_cli(
                root,
                "draft",
                "--entry",
                "1",
                "--blog",
                "sfi",
                "--source",
                str(corrupt),
                "--title",
                "scope for imagination",
                "--subtitle",
                "entry 0001",
                "--excerpt",
                "Excerpt for entry 0001.",
                "--date",
                "2026-08-25",
                "--location",
                "Adirondack Mountains, New York",
                "--tags",
                "hiking",
                "--no-prompt",
                "--replace",
            )

            self.assertEqual(result, 1)
            self.assertIn("Word document could not be converted", error)
            self.assertEqual(self.snapshot_files(root), before)
            restored = writing.locate_post("0001", root)
            self.assertEqual(restored.directory.resolve(), post.directory.resolve())
            self.assertEqual(
                restored.source_path.read_text(encoding="utf-8"),
                "An irreplaceable in-progress draft.\n",
            )
            self.assertEqual(
                (restored.directory / "images" / "summit.jpg").read_bytes(),
                b"private-author-image",
            )

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

    def test_unpublish_preserves_author_work_and_removes_all_venture_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(
                root, blog="venture", published=True, with_image=True
            )
            paths = self.publication_paths(root, post)
            for path in paths.values():
                self.assertTrue(path.exists(), path)

            original_metadata = dict(post.metadata)
            original_source = post.source_path.read_bytes() if post.source_path else b""
            original_image = (post.directory / "images" / "summit.jpg").read_bytes()
            before_dry_run = self.snapshot_files(root)

            result, _, error = self.run_cli(
                root, "unpublish", "1", "--dry-run"
            )
            self.assertEqual(result, 0, error)
            self.assertEqual(self.snapshot_files(root), before_dry_run)

            result, _, error = self.run_cli(root, "unpublish", "1", "--yes")
            self.assertEqual(result, 0, error)
            unpublished = writing.locate_post("0001", root)
            expected_metadata = dict(original_metadata)
            expected_metadata["status"] = "unpublished"
            self.assertEqual(unpublished.metadata, expected_metadata)
            self.assertEqual(unpublished.source_path.read_bytes(), original_source)
            self.assertEqual(
                (unpublished.directory / "images" / "summit.jpg").read_bytes(),
                original_image,
            )
            for path in paths.values():
                self.assertFalse(path.exists(), path)

            with mock.patch(
                "writing.current_publication_stamp",
                return_value=("2026-09-12", "22:51"),
            ):
                result, _, error = self.run_cli(
                    root, "publish", "0001", "--yes"
                )
            self.assertEqual(result, 0, error)
            republished = writing.locate_post("0001", root)
            self.assertEqual(republished.metadata, original_metadata)
            self.assertEqual(republished.metadata["date"], "2026-08-25")
            self.assertEqual(republished.metadata["time"], "14:37")
            for path in paths.values():
                self.assertTrue(path.exists(), path)

    def test_unpublish_refuses_drafts_and_is_idempotent_for_unpublished_posts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            draft = self.create_post(root, with_image=True)
            draft_snapshot = self.snapshot_files(root)
            result, _, _ = self.run_cli(root, "unpublish", "0001", "--yes")
            self.assertEqual(result, 1)
            self.assertEqual(self.snapshot_files(root), draft_snapshot)
            self.assertEqual(writing.locate_post("0001", root).metadata["status"], "draft")

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root, published=True, with_image=True)
            paths = self.publication_paths(root, post)
            generated_payloads = {
                "sfi": paths["sfi"].read_bytes(),
                "newsletter": paths["newsletter"].read_bytes(),
                "image": (paths["images"] / "summit.jpg").read_bytes(),
            }
            result, _, error = self.run_cli(root, "unpublish", "0001", "--yes")
            self.assertEqual(result, 0, error)

            clean_snapshot = self.snapshot_files(root)
            result, _, error = self.run_cli(root, "unpublish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            self.assertEqual(self.snapshot_files(root), clean_snapshot)

            paths["sfi"].parent.mkdir(parents=True, exist_ok=True)
            paths["sfi"].write_bytes(generated_payloads["sfi"])
            paths["newsletter"].parent.mkdir(parents=True, exist_ok=True)
            paths["newsletter"].write_bytes(generated_payloads["newsletter"])
            paths["images"].mkdir(parents=True, exist_ok=True)
            (paths["images"] / "summit.jpg").write_bytes(generated_payloads["image"])
            result, _, error = self.run_cli(root, "unpublish", "0001", "--yes")
            self.assertEqual(result, 0, error)
            self.assertEqual(writing.locate_post("0001", root).metadata["status"], "unpublished")
            for path in paths.values():
                self.assertFalse(path.exists(), path)

    def test_unpublish_verifies_outputs_and_rolls_back_atomically(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root, published=True, with_image=True)
            paths = self.publication_paths(root, post)
            original_sfi = paths["sfi"].read_bytes()
            writing.write_json(
                paths["sfi"],
                {"entry": "9999", "slug": "9999-someone-else-20260825"},
            )
            mismatched_snapshot = self.snapshot_files(root)
            result, _, _ = self.run_cli(root, "unpublish", "0001", "--yes")
            self.assertEqual(result, 1)
            self.assertEqual(self.snapshot_files(root), mismatched_snapshot)
            self.assertEqual(writing.locate_post("0001", root).metadata["status"], "published")

            paths["sfi"].write_bytes(original_sfi)
            before_failure = self.snapshot_files(root)
            original_move = writing.move_path
            move_count = 0

            def fail_second_move(source_path: Path, destination_path: Path) -> None:
                nonlocal move_count
                move_count += 1
                if move_count == 2:
                    raise OSError("injected unpublish failure")
                original_move(source_path, destination_path)

            with mock.patch("writing.move_path", side_effect=fail_second_move):
                result, _, _ = self.run_cli(root, "unpublish", "0001", "--yes")
            self.assertEqual(result, 1)
            self.assertEqual(self.snapshot_files(root), before_failure)
            self.assertEqual(writing.locate_post("0001", root).metadata["status"], "published")

    def test_erase_removes_draft_unpublished_and_published_posts(self) -> None:
        for status in ("draft", "unpublished", "published"):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                post = self.create_post(
                    root,
                    published=status in {"unpublished", "published"},
                    with_image=True,
                )
                paths = self.publication_paths(root, post)
                if status == "unpublished":
                    result, _, error = self.run_cli(
                        root, "unpublish", "0001", "--yes"
                    )
                    self.assertEqual(result, 0, error)
                    post = writing.locate_post("0001", root)
                author_directory = post.directory

                result, _, error = self.run_cli(root, "erase", "1", "--yes")
                self.assertEqual(result, 0, error)
                self.assertFalse(author_directory.exists())
                for path in paths.values():
                    self.assertFalse(path.exists(), path)

    def test_erase_requires_exact_confirmation_and_reuses_the_highest_entry(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root)
            with mock.patch("builtins.input", return_value="yes"):
                result, _, _ = self.run_cli(root, "erase", "0001")
            self.assertEqual(result, 1)
            self.assertTrue(post.directory.is_dir())

            with mock.patch("builtins.input", return_value="ERASE 0001"):
                result, _, error = self.run_cli(root, "erase", "0001")
            self.assertEqual(result, 0, error)
            self.assertFalse(post.directory.exists())

            result, _, error = self.run_cli(root, "erase", "9999", "--yes")
            self.assertEqual(result, 1)
            self.assertIn("post not found", error)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_post(root, entry="1")
            second = self.create_post(root, entry="2", published=True)
            result, _, error = self.run_cli(root, "erase", "2", "--yes")
            self.assertEqual(result, 0, error)
            self.assertFalse(second.directory.exists())
            self.assertEqual(writing.next_entry(root), "0002")

    def test_erase_rolls_back_author_and_generated_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_post(root, published=True, with_image=True)
            before_failure = self.snapshot_files(root)
            original_move = writing.move_path
            move_count = 0

            def fail_second_move(source_path: Path, destination_path: Path) -> None:
                nonlocal move_count
                move_count += 1
                if move_count == 2:
                    raise OSError("injected erase failure")
                original_move(source_path, destination_path)

            with mock.patch("writing.move_path", side_effect=fail_second_move):
                result, _, _ = self.run_cli(root, "erase", "0001", "--yes")
            self.assertEqual(result, 1)
            self.assertEqual(self.snapshot_files(root), before_failure)
            self.assertEqual(writing.locate_post("0001", root).metadata["status"], "published")

    def test_resource_from_legacy_entry_docx_keeps_it_as_inactive_manuscript(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root, with_image=True)
            legacy_word = post.directory / "entry.docx"
            legacy_bytes = b"legacy Word manuscript bytes"
            post.source_path.unlink()
            legacy_word.write_bytes(legacy_bytes)
            legacy_metadata = dict(post.metadata)
            legacy_metadata["source"] = "entry.docx"
            writing.write_json(post.path, legacy_metadata)

            replacement = root / "revised-entry.md"
            replacement.write_text(
                "## Revised entry\n\nA complete revised paragraph.\n",
                encoding="utf-8",
            )
            replacement_bytes = replacement.read_bytes()

            result, _, error = self.run_cli(
                root,
                "resource",
                "0001",
                "--source",
                str(replacement),
                "--yes",
            )
            self.assertEqual(result, 0, error)

            resourced = writing.locate_post("0001", root)
            expected_metadata = dict(legacy_metadata)
            expected_metadata["source"] = "entry.md"
            self.assertEqual(resourced.metadata, expected_metadata)
            self.assertEqual(resourced.source_path.read_bytes(), replacement_bytes)
            self.assertEqual(legacy_word.read_bytes(), legacy_bytes)
            self.assertEqual(
                (resourced.directory / "images" / "summit.jpg").read_bytes(),
                b"private-author-image",
            )
            self.assertEqual(replacement.read_bytes(), replacement_bytes)

            result, output, error = self.run_cli(root, "review", "0001")
            self.assertEqual(result, 0, error)
            self.assertIn("ready to publish", output)

    def test_resource_preserves_metadata_images_and_live_publication(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root, published=True, with_image=True)
            original_metadata = dict(post.metadata)
            original_author_image = (post.directory / "images" / "summit.jpg").read_bytes()
            paths = self.publication_paths(root, post)
            generated_before = {
                "sfi": paths["sfi"].read_bytes(),
                "newsletter": paths["newsletter"].read_bytes(),
                "image": (paths["images"] / "summit.jpg").read_bytes(),
            }
            replacement = post.directory / "0001-sfi.docx"
            self.create_docx(
                replacement,
                paragraph="A revised manuscript converted into editable HTML.",
            )
            word_bytes = replacement.read_bytes()

            before_dry_run = self.snapshot_files(root)
            result, _, error = self.run_cli(
                root,
                "resource",
                "0001",
                "--source",
                str(replacement),
                "--dry-run",
            )
            self.assertEqual(result, 0, error)
            self.assertEqual(self.snapshot_files(root), before_dry_run)

            with mock.patch("builtins.input", return_value="n"):
                result, _, _ = self.run_cli(
                    root, "resource", "0001", "--source", str(replacement)
                )
            self.assertEqual(result, 1)
            self.assertEqual(self.snapshot_files(root), before_dry_run)

            result, _, error = self.run_cli(
                root,
                "re-source",
                post.slug,
                "--source",
                str(replacement),
                "--yes",
            )
            self.assertEqual(result, 0, error)
            resourced = writing.locate_post("0001", root)
            expected_metadata = dict(original_metadata)
            expected_metadata["source"] = f"{post.slug}.html"
            self.assertEqual(resourced.metadata, expected_metadata)
            self.assertFalse((resourced.directory / "entry.md").exists())
            converted = resourced.directory / f"{post.slug}.html"
            converted_html = converted.read_text(encoding="utf-8")
            self.assertIn("<!doctype html>", converted_html.lower())
            self.assertIn("<body>", converted_html)
            self.assertIn(
                "A revised manuscript converted into editable HTML.", converted_html
            )
            self.assertIn('src="images/docx/image-1.png"', converted_html)
            self.assertEqual(
                (resourced.directory / replacement.name).read_bytes(), word_bytes
            )
            self.assertEqual(
                (resourced.directory / "images" / "docx" / "image-1.png").read_bytes(),
                b"embedded-word-image",
            )
            self.assertEqual(
                (resourced.directory / "images" / "summit.jpg").read_bytes(),
                original_author_image,
            )
            self.assertEqual(paths["sfi"].read_bytes(), generated_before["sfi"])
            self.assertEqual(
                paths["newsletter"].read_bytes(), generated_before["newsletter"]
            )
            self.assertEqual(
                (paths["images"] / "summit.jpg").read_bytes(),
                generated_before["image"],
            )

            before_noop = self.snapshot_files(root)
            result, output, error = self.run_cli(
                root,
                "resource",
                "0001",
                "--source",
                str(converted),
                "--yes",
            )
            self.assertEqual(result, 0, error)
            self.assertIn("already active", output)
            self.assertEqual(self.snapshot_files(root), before_noop)

            prompted_source = root / "prompted.txt"
            prompted_source.write_text("A source selected at the prompt.\n", encoding="utf-8")
            with mock.patch("builtins.input", return_value=str(prompted_source)):
                result, _, error = self.run_cli(
                    root,
                    "resource",
                    str(converted),
                    "--yes",
                )
            self.assertEqual(result, 0, error)
            prompted = writing.locate_post("0001", root)
            self.assertEqual(prompted.metadata["source"], "entry.txt")
            self.assertEqual(
                (prompted.directory / "entry.txt").read_text(encoding="utf-8"),
                prompted_source.read_text(encoding="utf-8"),
            )
            unchanged_except_source = dict(original_metadata)
            unchanged_except_source["source"] = "entry.txt"
            self.assertEqual(prompted.metadata, unchanged_except_source)
            self.assertEqual(paths["sfi"].read_bytes(), generated_before["sfi"])

    def test_resource_supports_every_document_type_and_rejects_others(self) -> None:
        cases = (
            ("md", "entry.md"),
            ("html", "entry.html"),
            ("htm", "entry.html"),
            ("txt", "entry.txt"),
        )
        for suffix, canonical_name in cases:
            with self.subTest(suffix=suffix), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                post = self.create_post(root, with_image=True)
                replacement = root / f"replacement.{suffix}"
                payload = f"replacement-{suffix}".encode()
                replacement.write_bytes(payload)
                result, _, error = self.run_cli(
                    root,
                    "resource",
                    str(post.path),
                    "--source",
                    str(replacement),
                    "--yes",
                )
                self.assertEqual(result, 0, error)
                resourced = writing.locate_post("0001", root)
                self.assertEqual(resourced.metadata["source"], canonical_name)
                self.assertEqual((resourced.directory / canonical_name).read_bytes(), payload)
                self.assertEqual(
                    (resourced.directory / "images" / "summit.jpg").read_bytes(),
                    b"private-author-image",
                )

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_post(root)
            replacement = root / "replacement.pdf"
            replacement.write_bytes(b"not supported")
            before = self.snapshot_files(root)
            result, _, _ = self.run_cli(
                root,
                "resource",
                "0001",
                "--source",
                str(replacement),
                "--yes",
            )
            self.assertEqual(result, 1)
            self.assertEqual(self.snapshot_files(root), before)

    def test_resource_rolls_back_source_and_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_post(root, published=True, with_image=True)
            replacement = root / "replacement.html"
            replacement.write_text("<p>Replacement.</p>\n", encoding="utf-8")
            before_failure = self.snapshot_files(root)
            original_move = writing.move_path
            move_count = 0

            def fail_second_move(source_path: Path, destination_path: Path) -> None:
                nonlocal move_count
                move_count += 1
                if move_count == 2:
                    raise OSError("injected resource failure")
                original_move(source_path, destination_path)

            with mock.patch("writing.move_path", side_effect=fail_second_move):
                result, _, _ = self.run_cli(
                    root,
                    "resource",
                    "0001",
                    "--source",
                    str(replacement),
                    "--yes",
                )
            self.assertEqual(result, 1)
            self.assertEqual(self.snapshot_files(root), before_failure)

    def test_render_builds_a_private_standalone_preview_without_publishing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root, published=True, with_image=True)
            post.source_path.write_text(
                "## A private revision\n\nPreview-only prose.\n\n"
                "![A summit view](images/summit.jpg)\n",
                encoding="utf-8",
            )
            metadata = dict(post.metadata)
            metadata["music"] = {
                "title": "Water & Wanderlust",
                "artist": "Yebba",
                "album": "Jean",
            }
            metadata["tags"] = ["sfi", "musings"]
            writing.write_json(post.path, metadata)
            post = writing.AuthorPost(post.path, metadata)
            author_before = self.snapshot_files(post.directory)
            paths = self.publication_paths(root, post)
            live_before = {
                "sfi": paths["sfi"].read_bytes(),
                "newsletter": paths["newsletter"].read_bytes(),
                "image": (paths["images"] / "summit.jpg").read_bytes(),
            }

            result, _, error = self.run_cli(root, "render", "0001")
            self.assertEqual(result, 0, error)
            preview = root / ".writing-preview" / post.slug
            index = preview / "index.html"
            self.assertTrue(index.is_file())
            preview_html = index.read_text(encoding="utf-8")
            self.assertIn("<!doctype html", preview_html.lower())
            self.assertIn("Preview-only prose.", preview_html)
            self.assertIn(str(post.metadata["subtitle"]), preview_html)
            self.assertIn(str(post.metadata["location"]), preview_html)
            self.assertIn(post.entry, preview_html)
            self.assertLess(
                preview_html.index('<ul class="labels">'),
                preview_html.index("Water &amp; Wanderlust"),
            )
            self.assertIn(
                'class="metadata-separator" aria-hidden="true">•</span>',
                preview_html,
            )
            self.assertIn('<li style="color: #f4a825">sfi</li>', preview_html)
            self.assertIn(
                '<li style="color: var(--green)">musings</li>', preview_html
            )
            preview_images = list(preview.rglob("summit.jpg"))
            self.assertEqual(len(preview_images), 1)
            self.assertEqual(preview_images[0].read_bytes(), b"private-author-image")

            self.assertEqual(self.snapshot_files(post.directory), author_before)
            self.assertEqual(paths["sfi"].read_bytes(), live_before["sfi"])
            self.assertEqual(
                paths["newsletter"].read_bytes(), live_before["newsletter"]
            )
            self.assertEqual(
                (paths["images"] / "summit.jpg").read_bytes(), live_before["image"]
            )
            self.assertEqual(writing.locate_post("0001", root).metadata["status"], "published")

    def test_view_renders_then_opens_the_standalone_preview(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            post = self.create_post(root, with_image=True)
            expected = (
                root / ".writing-preview" / post.slug / "index.html"
            ).resolve()
            with mock.patch("writing.webbrowser.open", return_value=True) as opened:
                result, _, error = self.run_cli(root, "view", "0001")
            self.assertEqual(result, 0, error)
            self.assertTrue(expected.is_file())
            opened.assert_called_once()
            self.assertEqual(opened.call_args.args[0], expected.as_uri())

    def test_post_command_is_not_part_of_the_suite(self) -> None:
        parser = writing.build_parser()
        subparsers = next(
            action
            for action in parser._actions
            if isinstance(action, writing.argparse._SubParsersAction)
        )
        self.assertEqual(
            set(subparsers.choices),
            {
                "draft",
                "review",
                "publish",
                "unpublish",
                "erase",
                "resource",
                "re-source",
                "render",
                "view",
                "newsletter",
            },
        )
        self.assertEqual(writing.STATUSES, ("draft", "unpublished", "published"))
        self.assertEqual(parser.parse_args(["unpublish", "1"]).entry, "0001")
        self.assertEqual(parser.parse_args(["erase", "1"]).entry, "0001")
        self.assertEqual(
            parser.parse_args(["resource", "some-slug"]).command, "resource"
        )
        self.assertEqual(
            parser.parse_args(["re-source", "some-slug"]).command, "re-source"
        )
        for command in ("unpublish", "erase"):
            with self.subTest(command=command), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    parser.parse_args([command, "some-slug"])

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
            source = (
                root
                / "writing"
                / "sfi"
                / "0007-scope-for-imagination-replace-me-20260825"
                / "entry.md"
            )
            result, _, error = self.run_cli(
                root, *base_arguments, "--source", str(source), "--replace"
            )
            self.assertEqual(result, 1)
            self.assertIn("inside the draft folder being replaced", error)
            self.assertTrue(source.is_file())
            result, _, error = self.run_cli(root, *base_arguments, "--replace")
            self.assertEqual(result, 0, error)
            metadata = writing.load_json_object(
                root
                / "writing"
                / "sfi"
                / "0007-scope-for-imagination-replace-me-20260825"
                / "post.json"
            )
            self.assertEqual(metadata["status"], "draft")


if __name__ == "__main__":
    unittest.main()
