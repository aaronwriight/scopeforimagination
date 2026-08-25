# Scope for Imagination author folders

Create and manage posts with the unified commands documented in [`writing/README.md`](../README.md). Do not manually copy a folder into this directory or choose its entry number unless you are deliberately migrating an older post.

SFI is the umbrella archive. A general post lives here with `"blog": "sfi"`. Venture posts live under `writing/venture/` but are also surfaced in SFI after publication, using the same global entry sequence.

Each author folder contains `post.json`, one canonical `entry.<ext>` body, and an `images/` folder. Start one with `pnpm writing draft`; the guided workflow and format templates are documented in the canonical guide.
