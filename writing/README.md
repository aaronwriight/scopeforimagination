# Writing and publishing

This is the canonical guide for writing both **Scope for Imagination (SFI)** and **Venture** posts. Run commands from the repository root.

The everyday workflow is:

```sh
pnpm writing draft
pnpm writing review 0003
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
pnpm writing newsletter TARGET [--send] [--dry-run] [--yes]
```

`TARGET` may be an entry number, slug, post folder, `entry.*` source path, or `post.json` path. When your terminal is already inside a post folder, `review` and `publish` can infer the nearest `post.json`, so their target may be omitted.

There is no separate `post` command. `review` is the read-only way to inspect a post and its publication readiness.

### Draft options

In an interactive terminal, the simplest command starts a guided draft:

```sh
pnpm writing draft
```

The prompts collect the missing author fields, let you import an existing document or start a new one, and show defaults in brackets. Press Return to accept a displayed default. The next global entry number and slug are assigned automatically.

For a new document, choose `md`, `html`, or `txt`; the default is `md`. A Word document can be imported, but the command does not generate a blank `.docx` template.

Flags can prefill the same workflow. Add `--no-prompt` when a fully specified command should run without questions:

```text
--blog sfi|venture
--source PATH
--format md|html|txt
--title TEXT
--subtitle TEXT
--excerpt TEXT
--entry NNNN
--date YYYY-MM-DD
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
--no-prompt
--replace
```

Use `--format` only when starting a new blank source. When `--source` points to an existing `.md`, `.html`, `.htm`, `.txt`, or `.docx` document, its file type is inferred instead. Imported `.htm` files are normalized to `.html`.

Use `--no-prompt` for scripts or when you deliberately want omitted values to use noninteractive defaults. Use `--entry` only for a deliberate migration or reservation. A manual `--slug` may customize the middle title words, but it must retain the matching `NNNN-` entry prefix and `-YYYYMMDD` date suffix. Use draft-time `--replace` only when you intend to replace an existing unpublished author folder.

## One journal sequence, two views

SFI is the umbrella journal. Venture is its adventure-focused subset.

- Every post receives one globally unique four-digit entry number.
- SFI and Venture use the **same** sequence. If SFI entry `0022` is followed by a Venture story, that Venture story is `0023`.
- An SFI-only post uses `"blog": "sfi"`.
- A Venture post uses `"blog": "venture"` and includes `"venture"` in `tags`.
- A published Venture post appears in both the SFI archive and the specialized Venture journal. It is not duplicated in the author workspace and does not receive a second number.
- `entry` is a JSON **string**, such as `"0023"`, because JSON numbers cannot preserve leading zeroes.

The sequence describes publication order. `tags`, `collections`, `trip`, and `thread` describe how entries relate to one another.

## Folder structure

Each post has one self-contained folder named after its slug:

```text
writing/
├── README.md
├── post.schema.json
├── templates/
│   ├── entry.md
│   ├── entry.html
│   └── entry.txt
├── sfi/
│   ├── README.md
│   └── 0003-a-note-from-cambridge-20260825/
│       ├── post.json
│       ├── entry.md
│       └── images/
│           └── .gitkeep
└── venture/
    ├── README.md
    └── 0023-la-vida-august-2026-m1-20260815/
        ├── post.json
        ├── entry.docx
        └── images/
            ├── summit-view.jpg
            └── trail-map.png
```

Inside a post folder:

- `post.json` contains author metadata.
- `entry.md`, `entry.html`, `entry.txt`, or imported `entry.docx` contains the essay.
- `images/` contains image files that belong to the post.

The canonical author-body name is always `entry.<ext>`. An imported document is copied and renamed to that form; its original file remains untouched. The metadata key is still named `source`, and its value points to the relative body filename, such as `"entry.md"`.

Keep one source document per post folder.

## Regular workflow

### 1. Create or import a draft

For the guided workflow:

```sh
pnpm writing draft
```

For a prefilled SFI draft:

```sh
pnpm writing draft \
  --blog sfi \
  --format md \
  --subtitle "a note from cambridge"
```

For a prefilled Venture draft:

```sh
pnpm writing draft \
  --blog venture \
  --format html \
  --subtitle "La Vida August 2026 M1"
```

To import an existing document:

```sh
pnpm writing draft \
  --blog venture \
  --source "/path/to/la-vida.docx" \
  --subtitle "La Vida August 2026 M1"
```

`draft`:

- chooses the next entry number across both `writing/sfi/` and `writing/venture/`;
- creates the slug-named post folder;
- copies a reusable template or imports the selected source as `entry.<ext>`;
- creates `images/` and `post.json`;
- leaves `time` blank for publication; and
- does not publish, deploy, or email anything.

When importing, the original source filename can supply a suggested subtitle, but the copied file is still named `entry.<ext>`. Confirm the prompted values and the resulting `post.json` before writing.

### 2. Write the entry

Choose whichever supported format feels best:

| Format | How it is created | Best for |
| --- | --- | --- |
| `entry.md` | New template or import | Lightweight prose, headings, links, images, quotations, and layout directives. |
| `entry.html` | New template or import | Direct semantic HTML and the most control over figures and structure. Only the document body is published. |
| `entry.txt` | New template or import | Plain writing with the same small set of structural markers and layout directives as Markdown. |
| `entry.docx` | Import only | Existing Word writing, including basic headings, lists, links, emphasis, quotations, and images. |

Each blank template begins with a commented quick reference. Those comments are removed when the entry is rendered and are never included in the public body. Replace the visible bracketed starter prompt before review.

#### Markdown and text quick syntax

The `.md` and `.txt` renderers support:

```md
# Section heading
## Subheading

A paragraph with **bold**, *italic*, and [a link](https://example.com).

- an unordered item
- another item

1. an ordered item
2. another item

![Useful alt text](images/summit-view.jpg)

*An optional caption beneath the image.*

> A quotation can span more than one line.
>
> — Attribution
```

The page owns the main title, so `#` in an author source begins the entry's first section rather than creating a second page title.

Use a `center` directive for centered text, images, or both:

```md
::: center
Centered text.

![A view across the Adirondack ridgeline](images/summit-view.jpg)

*An optional centered caption.*
:::
```

Use a `callout` directive for a distinct aside:

```md
::: callout
**Field note.** A short detail that should stand apart from the main narrative.
:::
```

Both directives must have their opening and closing `:::` lines. Do not nest directives.

#### HTML patterns

For HTML, keep entry content inside `<body>`. The template includes examples of headings, paragraphs, emphasis, links, lists, figures, centered content, block quotations, and callouts. Use local image paths such as:

```html
<figure>
  <img src="images/summit-view.jpg" alt="A view across the Adirondack ridgeline" />
  <figcaption>An optional caption.</figcaption>
</figure>
```

#### Images

Put post-specific images in the post's `images/` folder and give every meaningful image useful alt text. Markdown and text use:

```md
![A view across the Adirondack ridgeline](images/summit-view.jpg)
```

HTML uses:

```html
<img src="images/summit-view.jpg" alt="A view across the Adirondack ridgeline" />
```

`review` reports missing local image references. On publish, local image references are rewritten to `/images/posts/<slug>/...`, and author images are copied there recursively. Images embedded in a Word source are extracted beneath that generated post directory in `docx/`.

### 3. Complete the metadata

The guided draft fills much of `post.json`; you can edit it by hand before review. The [metadata reference](#metadata-field-reference) explains every key.

Replace every bracketed prompt, `TODO`, `TBD`, `FIXME`, `TK`, private note, and placeholder before publication.

### 4. Review

```sh
pnpm writing review 0003
```

`review` is read-only. It checks the author folder, metadata shape, publication requirements, source document, unfinished prompts, entry and slug collisions, music fields, tags, collections, coordinates, and blog-specific rules. It also renders the body so missing images and malformed source content can be caught before publication.

A blank draft `time` is expected: review notes that it will be stamped at publication. Fix every blocker and read every note as an editorial checklist.

These targets are equivalent:

```sh
pnpm writing review 0003
pnpm writing review 0003-a-note-from-cambridge-20260825
pnpm writing review writing/sfi/0003-a-note-from-cambridge-20260825
pnpm writing review writing/sfi/0003-a-note-from-cambridge-20260825/entry.md
pnpm writing review writing/sfi/0003-a-note-from-cambridge-20260825/post.json
```

From inside that post folder, `pnpm writing review` with no target reviews the current post.

### 5. Preview publication

```sh
pnpm writing publish 0003 --dry-run
```

A dry run performs the publication review and shows the records that would be generated. It does not write output, change status, or save a publication time.

### 6. Publish locally

```sh
pnpm writing publish 0003
```

`publish` runs the same review, displays the post and planned outputs, and asks for confirmation before writing anything. Answer `y` only after the summary is correct.

The first successful publish stamps `time` using the local machine's current 24-hour `HH:MM` time. A dry run or cancelled confirmation leaves it blank. Republishing an existing entry with `--replace` preserves its original publication time.

A normal publish generates local website records; it does **not** push to GitHub, deploy the website, or send a newsletter.

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

Published entries appear at:

- every post: `/scope-for-imagination/NNNN`;
- Venture posts additionally: `/venture/<slug>`.

Before pushing, run:

```sh
pnpm build
```

Commit the author folder, generated record or records, and generated public images together. The GitHub/Vercel workflow is what makes the post public.

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
| `source` | draft command | Canonical body filename inside the post folder: `entry.md`, `entry.html`, `entry.txt`, or imported `entry.docx`. The metadata key remains `source`. |
| `title` | author | Journal/post title shown in the header. SFI normally uses `scope for imagination`; Venture normally uses `venture`. |
| `subtitle` | author | The entry-specific title used in headers, indexes, and the default slug. |
| `excerpt` | author | Short plain-text description for indexes and newsletters. |
| `entry` | draft command | One global four-digit string shared by SFI and Venture, for example `"0023"`. |
| `date` | author | Entry date in `YYYY-MM-DD` form. It also supplies the final eight slug digits. |
| `time` | publish command | Blank during drafting. The first successful publish stamps local `HH:MM`; replacement publication preserves it. |
| `location` | author | Where the entry was written or situated, using the wording you want displayed. |
| `trip` | author | Venture trip name, such as `La Vida August 2026 M1`. Use `null` for an unrelated SFI post. |
| `thread` | author | Optional lowercase, hyphenated slug shared by several entries in one story, trip, or series. |
| `slug` | draft command, author may override | `NNNN-title-YYYYMMDD`; it must match the folder, entry, and date and remain unique. |
| `music` | author | Optional tagline with required `title` and `artist`, plus optional `album` and absolute `url`. Use `null` for no song. |
| `tags` | author | Manual descriptive tags. Every Venture post must include `venture`. |
| `blog` | author at draft creation | `sfi` for a general entry or `venture` for the Venture subset. |
| `collections` | author | Optional collection slugs such as `northeast-115`, `national-parks`, or `travels`. |
| `latitude` / `longitude` | author | Coordinates for mapping. SFI-only posts may leave both `null`; Venture publication requires both. |
| `status` | commands | `draft` while writing; `publish` changes it to `published`. Do not change it by hand. |

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

## Example: regular SFI post

Start interactively with `pnpm writing draft`, or prefill it:

```sh
pnpm writing draft \
  --blog sfi \
  --format md \
  --title "scope for imagination" \
  --subtitle "a note from cambridge" \
  --excerpt "A short introduction to the idea at the center of this entry." \
  --date 2026-08-25 \
  --location "Cambridge, MA" \
  --tags "musings"
```

The draft metadata will look like:

```json
{
  "$schema": "../../post.schema.json",
  "source": "entry.md",
  "title": "scope for imagination",
  "subtitle": "a note from cambridge",
  "excerpt": "A short introduction to the idea at the center of this entry.",
  "entry": "0003",
  "date": "2026-08-25",
  "time": "",
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

Then review and publish:

```sh
pnpm writing review 0003
pnpm writing publish 0003 --dry-run
pnpm writing publish 0003
```

The successful publish fills `time` and changes `status` to `published`.

## Example: La Vida August 2026 M1

Import the source:

```sh
pnpm writing draft \
  --blog venture \
  --source "/path/to/la-vida-august-2026-m1.docx" \
  --title "venture" \
  --subtitle "La Vida August 2026 M1" \
  --excerpt "A field note from five August days among Adirondack summits." \
  --date 2026-08-15 \
  --location "Adirondack Mountains, New York" \
  --trip "La Vida August 2026 M1" \
  --thread "la-vida-august-2026-m1" \
  --tags "venture,hiking" \
  --collections "northeast-115" \
  --latitude 44.1437 \
  --longitude -73.986
```

The copied author source is `entry.docx`, and the draft metadata includes:

```json
{
  "$schema": "../../post.schema.json",
  "source": "entry.docx",
  "title": "venture",
  "subtitle": "La Vida August 2026 M1",
  "excerpt": "A field note from five August days among Adirondack summits.",
  "entry": "0003",
  "date": "2026-08-15",
  "time": "",
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

The number is illustrative; use the number assigned by `draft`. If several La Vida posts belong together, keep the same `trip` and `thread` while giving each its own entry, subtitle, slug, date, and source folder.

Review and publish through the same pipeline:

```sh
pnpm writing review 0003
pnpm writing publish 0003 --dry-run
pnpm writing publish 0003
```

The result appears as one globally numbered entry in SFI and as a specialized Venture story. Link its published Venture slug from relevant peak, park, or travel field-note records when those places should point to the story.

## Author sources and generated outputs

Author-owned files live under `writing/`:

```text
writing/<blog>/<slug>/post.json
writing/<blog>/<slug>/entry.<ext>
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

Treat generated files like build artifacts:

- edit `writing/.../post.json` or `entry.<ext>`, not generated JSON;
- rerun `review` and `publish --replace` after an intentional edit;
- commit author sources, generated records, and generated public images together; and
- never store private trip notes, secrets, or unpublished material in generated public records.

## Pre-publish checklist

- The entry number is the one assigned by `draft` and is not duplicated.
- The folder name and `slug` match.
- Title, subtitle, excerpt, date, and location are final.
- `time` is blank for a first publication or retains its original value for a replacement.
- The source contains no visible starter prompt, `TODO`, `TBD`, `FIXME`, `TK`, private notes, or unintended comments.
- Tags are intentional; Venture includes `venture`.
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

Open `post.json` and fill the reported value. Blank `time` is the intentional exception for an unpublished draft; the first successful publish supplies it.

### Review finds unfinished text

Search `entry.<ext>` for the visible starter prompt, bracketed placeholders, `TODO`, `TBD`, `FIXME`, `TK`, placeholder URLs, and scaffolding language. The commented quick reference is ignored by rendering and may remain.

### The date changed after the draft was created

Keep `date`, the final eight slug digits, and the post folder name aligned. Rename the folder and update `slug` together, then run `review` by its new path.

### A Venture story is missing from one journal

Confirm `"blog": "venture"`, the `venture` tag, and `"status": "published"`; then republish with `--replace`. A valid Venture publish generates both records from the same author source.

### Images are missing

Keep originals in the post's `images/` folder, use `images/...` relative references, and check alt text and filename casing. Rerun `review`, then `publish --replace`. Published copies live under `/images/posts/<slug>/`; do not edit those generated copies directly.

### Publish refuses to overwrite a record

This protects an existing published entry. Confirm that you are editing the correct author folder, run `review`, preview with `publish --dry-run`, and then use `publish TARGET --replace`.

### Newsletter cannot connect

First use `--dry-run`. Then check the private Resend environment variables described in [`docs/newsletter-setup.md`](../docs/newsletter-setup.md). Publishing remains local and safe even when newsletter credentials are absent.
