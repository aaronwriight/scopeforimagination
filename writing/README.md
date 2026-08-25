# Writing and publishing

This is the canonical guide for writing both **Scope for Imagination (SFI)** and **Venture** posts. Run every command from the repository root.

The short version is:

```sh
pnpm writing draft --blog sfi --subtitle "your subtitle"
pnpm writing review 0003
pnpm writing post 0003
pnpm writing publish 0003 --dry-run
pnpm writing publish 0003
```

The `writing/` folder is the author workspace and source of truth. Files under `content/` are generated website records; do not draft by editing those generated files.

> **Privacy note:** this GitHub repository is public. `"status": "draft"` keeps a post off the website, but it does not make a committed source file private on GitHub. Keep a draft uncommitted until its text and images are safe to share publicly.

## Command reference

```text
pnpm writing draft [OPTIONS]
pnpm writing review [TARGET]
pnpm writing publish [TARGET] [--dry-run] [--replace] [--yes]
pnpm writing post TARGET [--json]
pnpm writing newsletter TARGET [--send] [--dry-run] [--yes]
```

`TARGET` may be an entry number, slug, post folder, source-document path, or `post.json` path. When your terminal is already inside a post folder, `review` and `publish` can infer the nearest `post.json`, so their target may be omitted.

`draft` accepts:

```text
--blog sfi|venture
--source PATH
--title TEXT
--subtitle TEXT
--excerpt TEXT
--entry NNNN
--date YYYY-MM-DD
--time HH:MM
--location TEXT
--trip TEXT
--thread TEXT
--slug SLUG
--tags COMMA-SEPARATED-TAGS
--collections COMMA-SEPARATED-COLLECTIONS
--latitude NUMBER
--longitude NUMBER
--music-title TEXT
--music-album TEXT
--music-artist TEXT
--music-url URL
--replace
```

Most metadata flags are conveniences; it is fine to initialize a sparse draft and edit `post.json`. The command assigns the next global entry number and generates the slug when those values are omitted. A manual `--slug` can change only the middle title words; it must retain the matching `NNNN-` entry prefix and `-YYYYMMDD` date suffix. Use `--entry` only for a deliberate migration or reservation, and use draft-time `--replace` only when you intend to replace an existing author draft.

## One journal sequence, two views

SFI is the umbrella journal. Venture is its adventure-focused subset.

- Every post receives one globally unique four-digit entry number.
- SFI and Venture use the **same** sequence. If SFI entry `0022` is followed by a Venture story, that Venture story is `0023`.
- An SFI-only post uses `"blog": "sfi"`.
- A Venture post uses `"blog": "venture"` and includes `"venture"` in `tags`.
- A published Venture post appears in both the SFI archive and the specialized Venture journal. It is not duplicated in the author workspace and does not receive a second number.
- `entry` is a JSON **string**, such as `"0023"`, because JSON numbers cannot preserve leading zeroes.

The sequence describes publication order. `tags`, `collections`, `trip`, and `thread` describe how entries relate to one another.

## The folder structure

Each post has one self-contained folder named after its slug:

```text
writing/
├── README.md
├── post.schema.json
├── sfi/
│   ├── README.md
│   └── 0001-an-ode-to-slow-living-20260620/
│       ├── post.json
│       ├── source.html
│       └── images/
│           └── .gitkeep
└── venture/
    ├── README.md
    └── 0023-la-vida-august-2026-m1-20260815/
        ├── post.json
        ├── la-vida-august-2026-m1.docx
        └── images/
            ├── summit-view.jpg
            └── trail-map.png
```

Inside a post folder:

- `post.json` is the author metadata. Edit it by hand.
- `source.md`, `source.html`, `source.txt`, or `source.docx` is the actual essay.
- `images/` contains image files that belong to this post.

Keep one source document per post folder. The `source` field in `post.json` points to that file using a path relative to the post folder. A blank draft starts with `source.md`; an imported document keeps its original filename.

## The regular workflow

### 1. Create or import a draft

Start a blank SFI post:

```sh
pnpm writing draft --blog sfi --subtitle "a note from cambridge"
```

Start a blank Venture post:

```sh
pnpm writing draft --blog venture --subtitle "La Vida August 2026 M1"
```

Or import an existing Word, HTML, plain-text, or Markdown document:

```sh
pnpm writing draft \
  --blog venture \
  --source "/path/to/la-vida.docx" \
  --subtitle "La Vida August 2026 M1"
```

`draft` selects the next entry number from **both** `writing/sfi/` and `writing/venture/`, creates the post folder, copies or initializes the source document, creates `images/`, and writes a starter `post.json`. It does not publish, deploy, or email anything.

When a source is supplied, `draft` copies it into the new author folder and uses its filename as the subtitle only when `--subtitle` is omitted. The document body is rendered during review and publication; the remaining metadata comes from your flags or the starter defaults. Open `post.json` after every import and confirm it yourself.

### 2. Write the source and complete `post.json`

Write in whichever supported format feels best:

- `.md` for Markdown;
- `.html` for hand-authored HTML; only the document body becomes the post body;
- `.txt` for simple prose with blank lines between paragraphs;
- `.docx` for Word documents, including basic headings, lists, links, emphasis, quotations, and images.

Replace every bracketed prompt, `TODO`, and placeholder before publication. Put post-specific image files in the post's `images/` folder and give every meaningful image useful alt text in the source document.

Reference a local Markdown image like this:

```md
![A view across the Adirondack ridgeline](images/summit-view.jpg)
```

Or in HTML:

```html
<img src="images/summit-view.jpg" alt="A view across the Adirondack ridgeline" />
```

`review` reports missing local image references. On publish, local image references are rewritten to `/images/posts/<slug>/...`, and the contents of the author `images/` folder are copied there recursively. Images embedded in a Word source are extracted beneath that generated post directory in `docx/`.

Complete the metadata in `post.json`; the [field reference](#metadata-field-reference) below explains each key.

### 3. Review

```sh
pnpm writing review 0003
```

`review` is read-only. It checks the author folder, metadata shape, publication requirements, source document, unfinished prompts, entry and slug collisions, music fields, tags, collections, coordinates, and blog-specific rules. It reports fields that are blank or still need a human decision.

Fix every error before publishing. Read warnings as an editorial checklist: some may be intentional, but they should never be surprising.

A target may be an entry number, slug, post folder, source-document path, or `post.json` path. These are equivalent:

```sh
pnpm writing review 0003
pnpm writing review 0003-a-note-from-cambridge-20260825
pnpm writing review writing/sfi/0003-a-note-from-cambridge-20260825
pnpm writing review writing/sfi/0003-a-note-from-cambridge-20260825/source.md
pnpm writing review writing/sfi/0003-a-note-from-cambridge-20260825/post.json
```

From inside that post folder, `pnpm writing review` with no target reviews the current post.

### 4. Inspect the finished post

```sh
pnpm writing post 0003
```

This prints an easy-to-read summary of the resolved author record and its source/output paths. For the normalized machine-readable record, use:

```sh
pnpm writing post 0003 --json
```

Use `post` whenever you want to answer “what will this entry publish as?” without changing any files.

### 5. Preview the publish operation

```sh
pnpm writing publish 0003 --dry-run
```

The dry run performs the publication review and shows what would be generated without writing generated records or changing the draft's status.

### 6. Publish locally

```sh
pnpm writing publish 0003
```

`publish` runs the same review, displays the post and planned outputs, and asks for confirmation before writing anything. Answer `y` only after the summary is correct. A normal publish generates local website records; it does **not** push to GitHub, deploy the website, or send a newsletter.

When intentionally regenerating an existing published entry after editing its author source, use:

```sh
pnpm writing publish 0003 --replace
```

The command still asks for confirmation. `--yes` skips the question and is intended for deliberate automation:

```sh
pnpm writing publish 0003 --replace --yes
```

Do not use `--yes` as the everyday workflow; the confirmation summary is the last safeguard against publishing the wrong entry or metadata.

### 7. Preview the site and commit

Run the site locally if needed:

```sh
pnpm dev
```

Check the post itself and its index placement. Published entries appear at:

- every post: `/scope-for-imagination/NNNN`;
- Venture posts additionally: `/venture/<slug>`.

Before pushing, run:

```sh
pnpm build
```

Commit the author folder, generated record or records, and generated public images together. The GitHub/Vercel workflow remains the step that makes the post public.

### 8. Create the newsletter

Only create a newsletter after the public post URL works:

```sh
pnpm writing newsletter 0003
```

Without `--send`, this prepares a Resend broadcast draft for review. Inspect its audience, sender, subject, preview text, post URL, formatting, music line, and unsubscribe link in Resend.

Preview without creating a remote draft:

```sh
pnpm writing newsletter 0003 --dry-run
```

Immediate sending is intentionally explicit and asks for confirmation:

```sh
pnpm writing newsletter 0003 --send
```

`--send --yes` skips that final question and should be reserved for intentional automation. Newsletter setup and private environment variables are documented in [`docs/newsletter-setup.md`](../docs/newsletter-setup.md). Never place API keys or subscriber data in a post folder.

Because Venture is part of SFI, the same newsletter command works for a Venture entry when you want that story sent to the SFI readership. Publishing a post never sends its newsletter automatically.

## Metadata field reference

The machine-readable contract is [`writing/post.schema.json`](post.schema.json). Draft metadata may contain empty or `null` values so a new idea can be saved immediately; `review` and `publish` enforce the fields required for a public post.

| Field | Who sets it | Meaning |
| --- | --- | --- |
| `$schema` | draft command | Relative path to `writing/post.schema.json`. |
| `source` | draft command, then author | Source filename within the post folder. Supplying a document to `draft` is optional; a post needs a readable source before publication. |
| `title` | author | The journal/post title shown in the header. SFI normally uses `scope for imagination`. |
| `subtitle` | author | The entry's specific title or subtitle. It is used in headers and indexes. |
| `excerpt` | author | A short plain-text description for indexes and newsletters. Do not paste the entire opening paragraph by default. |
| `entry` | draft command | One global four-digit **string** shared by SFI and Venture, for example `"0023"`. Do not renumber an existing post casually. |
| `date` | author | Publication date in `YYYY-MM-DD` form. |
| `time` | author | Publication time in 24-hour `HH:MM` form. |
| `location` | author | Where the entry was written or situated, using the wording you want displayed. |
| `trip` | author | Venture trip name, such as `La Vida August 2026 M1`. Use `null` for an unrelated SFI post. |
| `thread` | author | Optional lowercase, hyphenated slug shared by several entries in one story, trip, or series. Use `null` for a standalone post. |
| `slug` | draft command, author may override | Uses `NNNN-title-YYYYMMDD`. A manual `--slug` may customize the lowercase, hyphenated title words, but it must preserve the matching entry prefix and date suffix, stay unique, and match its folder name. |
| `music` | author | Optional tagline with required `title` and `artist`, plus optional `album` and absolute `url`. Use `null` for no song. |
| `tags` | author | Manual descriptive tags. Every Venture post must include `venture`. |
| `blog` | author at draft creation | `sfi` for a general entry or `venture` for the Venture subset. |
| `collections` | author | Optional collection slugs, such as `northeast-115`, `national-parks`, or `travels`. Use `[]` when none apply. |
| `latitude` / `longitude` | author | Coordinates for mapping. SFI-only posts may leave both `null`; Venture publication requires both. |
| `status` | commands | `draft` while writing; `publish` changes it to `published`. Do not mark a draft published by hand. |

### Music example

```json
"music": {
  "title": "Sweet Heat Lightning",
  "album": "Appaloosa Bones",
  "artist": "Gregory Alan Isakov",
  "url": "https://example.com/song"
}
```

If there is no music tagline, use:

```json
"music": null
```

## Example: a regular SFI post

Create the author folder:

```sh
pnpm writing draft \
  --blog sfi \
  --title "scope for imagination" \
  --subtitle "a note from cambridge" \
  --date 2026-08-25 \
  --location "Cambridge, MA" \
  --tags "musings"
```

The meaningful metadata will look like this after editing:

```json
{
  "$schema": "../../post.schema.json",
  "source": "source.md",
  "title": "scope for imagination",
  "subtitle": "a note from cambridge",
  "excerpt": "A short introduction to the idea at the center of this entry.",
  "entry": "0003",
  "date": "2026-08-25",
  "time": "20:15",
  "location": "Cambridge, MA",
  "trip": null,
  "thread": null,
  "slug": "0003-a-note-from-cambridge-20260825",
  "music": null,
  "tags": ["musings"],
  "blog": "sfi",
  "collections": [],
  "latitude": null,
  "longitude": null,
  "status": "draft"
}
```

Then review, inspect, and publish:

```sh
pnpm writing review 0003
pnpm writing post 0003
pnpm writing publish 0003 --dry-run
pnpm writing publish 0003
```

## Example: La Vida August 2026 M1

Create or import the source:

```sh
pnpm writing draft \
  --blog venture \
  --source "/path/to/la-vida-august-2026-m1.docx" \
  --title "venture" \
  --subtitle "La Vida August 2026 M1" \
  --excerpt "A field note from five August days among Adirondack summits." \
  --date 2026-08-15 \
  --time 19:28 \
  --location "Adirondack Mountains, New York" \
  --trip "La Vida August 2026 M1" \
  --thread "la-vida-august-2026-m1" \
  --tags "venture,hiking" \
  --collections "northeast-115" \
  --latitude 44.1437 \
  --longitude -73.986
```

Then confirm metadata along these lines:

```json
{
  "$schema": "../../post.schema.json",
  "source": "la-vida-august-2026-m1.docx",
  "title": "venture",
  "subtitle": "La Vida August 2026 M1",
  "excerpt": "A field note from five August days among Adirondack summits.",
  "entry": "0003",
  "date": "2026-08-15",
  "time": "19:28",
  "location": "Adirondack Mountains, New York",
  "trip": "La Vida August 2026 M1",
  "thread": "la-vida-august-2026-m1",
  "slug": "0003-la-vida-august-2026-m1-20260815",
  "music": null,
  "tags": ["venture", "hiking"],
  "blog": "venture",
  "collections": ["northeast-115"],
  "latitude": 44.1437,
  "longitude": -73.986,
  "status": "draft"
}
```

The number shown here is illustrative: use the number assigned by `draft`. If this is one of several La Vida posts, keep the same `trip` and `thread` on each post while giving every post its own entry, subtitle, slug, date, and source folder.

Review and publish it through the same pipeline:

```sh
pnpm writing review 0003
pnpm writing post 0003
pnpm writing publish 0003 --dry-run
pnpm writing publish 0003
```

The result appears as the same globally numbered entry in SFI and as a specialized Venture story. Link the published Venture slug from the relevant peak, park, or travel field-note records when that place should point to the story.

## Author sources versus generated outputs

Author-owned files live under `writing/`:

```text
writing/<blog>/<slug>/post.json
writing/<blog>/<slug>/source.<ext>
writing/<blog>/<slug>/images/*
```

Publishing generates the records consumed by the site:

```text
content/scope-for-imagination/posts/NNNN.json
content/scope-for-imagination/newsletters/NNNN.json
public/images/posts/<slug>/*
```

For a Venture post, publishing also generates:

```text
content/venture/entries/<slug>.json
```

All generated records come from the same author folder. A Venture entry is written to the SFI post collection so global numbering and the umbrella archive stay consistent, then also to the Venture entry collection so the specialized route, index, and map can find it.

Treat generated files like build artifacts:

- edit `writing/.../post.json` or the source document, not the generated post JSON;
- rerun `review` and `publish --replace` after an intentional edit;
- commit source and generated changes together;
- never store private trip notes, secrets, or unpublished material in generated public records.

## Pre-publish checklist

- The entry number is the one assigned by `draft` and is not duplicated.
- The folder name and `slug` match.
- Title, subtitle, excerpt, date, time, and location are final.
- The source contains no bracketed prompts, `TODO`s, private notes, or accidental comments.
- Tags are intentional; Venture includes the `venture` tag.
- Trip, thread, and collections describe the right grouping.
- Music title and artist are paired, and its optional URL works.
- SFI coordinates are either both supplied or both `null`; Venture coordinates are both supplied.
- Every image has useful alt text and contains nothing private.
- `pnpm writing review TARGET` passes.
- `pnpm writing publish TARGET --dry-run` lists the expected outputs.
- The local post and indexes look right.
- `pnpm build` passes before pushing.
- The public URL works before a newsletter is created or sent.

## Troubleshooting

### “Target not found” or “target is ambiguous”

Use the complete path to the author metadata:

```sh
pnpm writing review writing/venture/0023-la-vida-august-2026-m1-20260815/post.json
```

Entry numbers and slugs must be unique across both blog folders.

### The next entry number looks wrong

Do not manually reuse a number. Check both `writing/sfi/` and `writing/venture/`, including drafts. The sequence is global, and drafts reserve their assigned numbers.

### Review reports blank fields

Open the post's `post.json` and fill the reported value. Empty strings and `null` are allowed while drafting so ideas can be saved early; they are not automatically valid for publication.

### Review finds unfinished text

Search the source document for bracketed prompts, `TODO`, placeholder URLs, and scaffolding language. Remove or replace every item intended only as a writing prompt.

### The date changed after the draft was created

Keep `date`, the final eight digits of `slug`, and the post folder name aligned. Rename the folder and update `slug` together, then run `review` by its new path.

### A Venture story is missing from one journal

Confirm `"blog": "venture"`, the `venture` tag, and `"status": "published"`; then republish with `--replace`. A valid Venture publish generates both the SFI record and Venture record from the same author source.

### Images are missing

Keep the original files in the post's `images/` folder, use `images/...` relative references in Markdown or HTML, and check alt text and filename casing. Rerun `review`, then `publish --replace`. Published copies live under `/images/posts/<slug>/`; do not edit those generated copies directly.

### Publish refuses to overwrite a record

This protects an existing published entry. Confirm that you are editing the correct author folder, inspect it with `post`, run a dry run, and then use `publish TARGET --replace`.

### Newsletter cannot connect

First use `--dry-run`. Then check the private Resend environment variables described in [`docs/newsletter-setup.md`](../docs/newsletter-setup.md). Publishing remains local and safe even when newsletter credentials are absent.
