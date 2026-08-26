# Scope for Imagination author folders

Create and manage posts with the unified commands documented in [`writing/README.md`](../README.md). Do not manually copy a folder into this directory or choose its entry number unless you are deliberately migrating an older post.

SFI is the umbrella archive. A general post lives here with `"blog": "sfi"`. Venture posts live under `writing/venture/` but are also surfaced in SFI after publication, using the same global entry sequence.

Each author folder contains `post.json`, one active body named by its `source` field, and an `images/` folder. Native bodies use `entry.md`, `entry.html`, or `entry.txt`. Importing Word preserves the `.docx` manuscript as an inactive snapshot and creates editable `<full-slug>.html` as the active body; embedded Word images live in the managed `images/docx/` directory. Start one with `pnpm writing draft`; the guided workflow and format templates are documented in the canonical guide.
