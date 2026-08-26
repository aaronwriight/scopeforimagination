# Venture author folders

Create and manage posts with the unified commands documented in [`writing/README.md`](../README.md).

Venture is a subset of Scope for Imagination, not a separate numbering system. A post stored here uses `"blog": "venture"`, includes `venture` in `tags`, and receives its next entry number from the shared SFI/Venture sequence. Publishing surfaces that one source in both SFI and Venture.

Use `trip` for the real-world trip name, `thread` when several posts belong to the same narrative group, and `collections` for site collections such as `northeast-115`, `national-parks`, or `travels`. Keep private trip notes outside public author and generated records.

Each author folder contains `post.json`, one active body named by its `source` field, and an `images/` folder. Native bodies use `entry.md`, `entry.html`, or `entry.txt`. Importing Word preserves the `.docx` manuscript as an inactive snapshot and creates editable `<full-slug>.html` as the active body; embedded Word images live in the managed `images/docx/` directory. Start one with `pnpm writing draft`; the guided workflow and format templates are documented in the canonical guide.
