# Writing and publishing

This is the canonical guide for writing both **Scope for Imagination (SFI)** and **Venture** posts. Run commands from the repository root.

The everyday workflow is:

```sh
pnpm writing draft
pnpm writing review 0001
pnpm writing render 0001
pnpm writing publish 0001 --dry-run
pnpm writing publish 0001
```

The `writing/` folder is the author workspace and source of truth. Files under `content/` are generated website records; do not draft by editing those generated files.

> **Privacy note:** this GitHub repository is public. `"status": "draft"` or `"status": "unpublished"` keeps a post out of locally generated site records, but it does not make a committed source file private on GitHub. Keep unpublished writing uncommitted until its text and images are safe to share publicly.

## Command reference

```text
pnpm writing draft [OPTIONS]
pnpm writing review [TARGET]
pnpm writing resource TARGET [--source PATH] [--dry-run] [--yes]
pnpm writing re-source TARGET [--source PATH] [--dry-run] [--yes]
pnpm writing render [TARGET]
pnpm writing view [TARGET]
pnpm writing publish [TARGET] [--dry-run] [--replace] [--yes]
pnpm writing newsletter TARGET [--send] [--dry-run] [--yes]
pnpm writing unpublish ENTRY [--dry-run] [--yes]
pnpm writing erase ENTRY [--dry-run] [--yes]
```

`TARGET` may be an entry number, slug, post folder, active source path, or `post.json` path. When your terminal is already inside a post folder, `review`, `render`, `view`, and `publish` can infer the nearest `post.json`, so their target may be omitted. `unpublish` and `erase` are intentionally stricter: they require an explicit numeric `ENTRY` and never infer a destructive target from the current directory.

There is no separate `post` command. `review` is the read-only way to inspect a post and its publication readiness.

### Draft options

In an interactive terminal, the simplest command starts a guided draft:

```sh
pnpm writing draft
```

Every question begins with the exact `post.json` field it fills, such as `post.json "title"` or `post.json "trip"`. The prompts let you import an existing document or start a new one and show defaults in brackets; press Return to accept a displayed default. `trip`, `thread`, and `collections` are offered for both SFI and Venture. Automatic fields—including `entry`, `source`, `excerpt`, `date`, `time`, `slug`, and `status`—are labeled and announced too.

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
--music-artist TEXT
--music-album TEXT
--music-url URL
--no-prompt
--replace
```

Use `--format` only when starting a new blank source. When `--source` points to an existing `.md`, `.html`, `.htm`, `.txt`, or `.docx` document, its file type is inferred instead. Imported `.htm` files are normalized to `.html`.

Use `--no-prompt` for scripts or when you deliberately want omitted values to use noninteractive defaults. Use `--entry` only for a deliberate migration or reservation. By default, `excerpt` and `date` remain blank until first publication; `--excerpt` and `--date` are manual overrides for intentional summaries or retrospective dates. The automatic slug combines the entry, title, subtitle, and date as `NNNN-title-subtitle-YYYYMMDD`. A manual `--slug` requires `--date`, may override the generated title-and-subtitle portion, and must retain the matching `NNNN-` entry prefix and `-YYYYMMDD` date suffix. Use draft-time `--replace` only when you intend to replace an existing draft author folder; the replacement is staged and the existing draft is restored if preparation or promotion fails.

## One journal sequence, two views

SFI is the umbrella journal. Venture is its adventure-focused subset.

- Every post receives one globally unique four-digit entry number.
- SFI and Venture use the **same** sequence. If SFI entry `0022` is followed by a Venture story, that Venture story is `0023`.
- An SFI-only post uses `"blog": "sfi"`.
- A Venture post uses `"blog": "venture"` and includes `"venture"` in `tags`.
- A published Venture post appears in both the SFI archive and the specialized Venture journal. It is not duplicated in the author workspace and does not receive a second number.
- Draft and unpublished author folders continue to reserve their entry numbers.
- `entry` is a JSON **string**, such as `"0023"`, because JSON numbers cannot preserve leading zeroes.

The sequence describes publication order. `tags`, `collections`, `trip`, and `thread` describe how entries relate to one another.

With no author or generated entries, the first guided draft starts at `0001`.

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
│   └── 0001-scope-for-imagination-a-note-from-cambridge-20260825/
│       ├── post.json
│       ├── entry.md
│       └── images/
│           └── .gitkeep
└── venture/
    ├── README.md
    └── 0002-venture-la-vida-august-2026-m1-20260826/
        ├── post.json
        ├── 0002-venture-la-vida-august-2026-m1-20260826.html
        ├── la-vida-august-2026-m1.docx
        └── images/
            ├── docx/
            │   └── image-1.jpg
            ├── summit-view.jpg
            └── trail-map.png
```

Inside a post folder:

- `post.json` contains author metadata.
- The filename stored in `post.json` as `source` is the one active essay body.
- Native bodies use `entry.md`, `entry.html`, or `entry.txt`.
- A Word import keeps the original `.docx` as an inactive manuscript snapshot and creates editable `<full-slug>.html` as the active body.
- `images/` contains image files that belong to the post.

The metadata key is named `source`, and its value always points to the active body filename, such as `"entry.md"` or `"0002-venture-la-vida-august-2026-m1-20260826.html"`. The automatic slug—and therefore a Word-derived HTML filename—combines `ENTRY + TITLE + SUBTITLE + date` after slugifying the text fields.

Keep one **active** source per post folder. Supporting files may coexist with it: the preserved Word manuscript is a snapshot, ordinary author images remain under `images/`, and Word-embedded images are managed under `images/docx/`.

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
- creates a provisionally dated folder and slug from entry, title, subtitle, and date;
- copies a reusable native template as `entry.<ext>`, or converts an imported Word manuscript immediately into editable `<full-slug>.html`;
- creates `images/` and `post.json`;
- leaves `excerpt`, `date`, and `time` blank for first publication unless an override was supplied; and
- does not publish, deploy, or email anything.

When importing, the original filename can supply a suggested subtitle. Markdown, HTML, and text imports become their native `entry.<ext>` active source. A Word import is different: the selected manuscript remains unchanged, a snapshot with its original filename is kept in the author folder, and its content is converted to the slug-named HTML file referenced by `post.json`. Confirm the prompted values and resulting files before writing.

### 2. Write the entry

Choose whichever supported format feels best:

| Format | How it is created | Best for |
| --- | --- | --- |
| `entry.md` | New template or import | Lightweight prose, headings, links, images, quotations, and layout directives. |
| `entry.html` | New template or import | Direct semantic HTML and the most control over figures and structure. Only the document body is published. |
| `entry.txt` | New template or import | Plain writing with the same small set of structural markers and layout directives as Markdown. |
| `<full-slug>.html` | Automatic result of a Word import | Editable HTML converted from existing Word writing, including basic headings, lists, links, emphasis, quotations, and images. This is the active source. |
| Original `*.docx` filename | Preserved Word-import snapshot | The unchanged manuscript retained beside the active HTML for provenance or later re-sourcing; it is not rendered directly. |

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

`review` reports missing local image references. On publish, local image references are rewritten to `/images/posts/<slug>/...`, and author images are copied there recursively. Images embedded in an imported Word manuscript are extracted during conversion into the managed author directory `images/docx/`; publication copies that directory beneath `/images/posts/<slug>/docx/`.

### Replace an entry's source

Use `resource` when an author folder already exists but you want its body to come from a different document:

```sh
pnpm writing resource 0001 --source "/path/to/revised-entry.docx" --dry-run
pnpm writing resource 0001 --source "/path/to/revised-entry.docx"
```

`re-source` is an exact alias for the same command:

```sh
pnpm writing re-source 0001 --source "/path/to/revised-entry.docx"
```

When `--source` is omitted in an interactive terminal, the command prompts for the document path. It accepts the same import formats as `draft`. Markdown, HTML, and text become the matching native `entry.<ext>` source. Word is converted immediately into editable `<full-slug>.html`, `post.json.source` points to that HTML, and the selected `.docx` remains unchanged while a manuscript snapshot is kept in the post folder. If a legacy post still uses `entry.docx` directly and you switch it to a native source, that Word file is retained as an inactive manuscript snapshot. Other metadata and author images are preserved. Re-sourcing an older draft whose automatic slug omitted its journal title also upgrades that slug and folder to the current entry–title–subtitle–date form; the summary and dry run show the rename.

Re-sourcing from Word regenerates the slug-named HTML and the managed `images/docx/` directory. After confirmation, that intentionally overwrites manual tweaks in the existing converted HTML and replaces previously extracted Word images. Keep unrelated images elsewhere under `images/`; they are preserved. Use `--dry-run`, and save or commit HTML edits you may want to recover before re-sourcing.

Use `--dry-run` to inspect the planned replacement without changing files. Without `--yes`, a real replacement asks for confirmation. Re-sourcing a published post does not change the currently generated or deployed copy: run `review`, then `publish --replace`, before the revised body becomes the new local live record.

### 3. Complete the metadata

The guided draft fills much of `post.json`; you can edit it by hand before review. The [metadata reference](#metadata-field-reference) explains every key.

Replace every bracketed prompt, `TODO`, `TBD`, `FIXME`, `TK`, private note, and placeholder before publication.

### 4. Review

```sh
pnpm writing review 0001
```

`review` is read-only. It checks the author folder, metadata shape, publication requirements, source document, unfinished prompts, entry and slug collisions, music fields, tags, collections, coordinates, and blog-specific rules. It also renders the body so missing images and malformed source content can be caught before publication.

Blank draft `excerpt`, `date`, and `time` values are expected. Review previews the excerpt that will be derived from the first meaningful prose block and notes that the publication date and time will be stamped later. Fix every blocker and read every note as an editorial checklist.

These targets are equivalent:

```sh
pnpm writing review 0001
pnpm writing review 0001-scope-for-imagination-a-note-from-cambridge-20260825
pnpm writing review writing/sfi/0001-scope-for-imagination-a-note-from-cambridge-20260825
pnpm writing review writing/sfi/0001-scope-for-imagination-a-note-from-cambridge-20260825/entry.md
pnpm writing review writing/sfi/0001-scope-for-imagination-a-note-from-cambridge-20260825/post.json
```

From inside that post folder, `pnpm writing review` with no target reviews the current post.

### Render or view a private preview

Render a standalone local preview without publishing:

```sh
pnpm writing render 0001
```

`render` writes `.writing-preview/<slug>/index.html`. The `.writing-preview/` tree is gitignored and is only a private local preview workspace; it is not a website record or deployment artifact.

To render the same preview and open it in your default browser:

```sh
pnpm writing view 0001
```

Neither `render` nor `view` changes post metadata, publishes generated content, deploys the website, or sends a newsletter.

### 5. Preview publication

```sh
pnpm writing publish 0001 --dry-run
```

A dry run performs the publication review and shows the derived excerpt, publication date/time, final slug, any planned folder or Word-derived HTML rename, and records that would be generated. It does not write output, rename the draft, or save any automatic value.

### 6. Publish locally

```sh
pnpm writing publish 0001
```

`publish` runs the same review, displays the post and planned outputs, and asks for confirmation before writing anything. Answer `y` only after the summary is correct.

On the first successful publish, the command:

- derives a blank `excerpt` from the first meaningful prose block, without headings or captions, and shortens it to at most 160 characters;
- stamps a blank `date` and the publication `time` from the local machine's clock, confirming the time immediately after approval;
- finalizes the slug's date suffix and atomically renames the provisional author folder and Word-derived `<full-slug>.html` together when needed; and
- preserves any nonblank `--excerpt` or `--date` override.

A dry run, failed review, cancelled confirmation, or failed promotion leaves the provisional folder, HTML filename, and metadata untouched. Republishing an existing entry with `--replace` preserves its original excerpt, date, time, slug, and folder.

The reviewed body, generated records, images, and finalized author metadata are staged together. If promotion fails, the command restores the prior files instead of leaving a partial publication.

A normal publish generates local website records; it does **not** push to GitHub, deploy the website, or send a newsletter.

When intentionally regenerating an existing published entry after editing its author source, use:

```sh
pnpm writing publish 0001 --replace
```

The command still asks for confirmation. `--yes` skips the question and is intended for deliberate automation:

```sh
pnpm writing publish 0001 --replace --yes
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
pnpm writing newsletter 0001
```

Without `--send`, this prepares a Resend broadcast draft for review. Inspect its audience, sender, subject, preview text, post URL, formatting, music line, and unsubscribe link in Resend.

Preview without creating a remote draft:

```sh
pnpm writing newsletter 0001 --dry-run
```

Immediate sending is intentionally explicit and asks for confirmation:

```sh
pnpm writing newsletter 0001 --send
```

`--send --yes` skips that final question and should be reserved for intentional automation. Newsletter setup and private environment variables are documented in [`docs/newsletter-setup.md`](../docs/newsletter-setup.md). Never place API keys or subscriber data in a post folder.

Because Venture is part of SFI, the same newsletter command works for a Venture entry when you want that story sent to the SFI readership. Publishing a post never sends its newsletter automatically.

## Taking an entry off the site

### Unpublish but keep the author files

Use `unpublish` when a published entry should come out of the locally generated site while its author folder remains available for revision:

```sh
pnpm writing unpublish 0001 --dry-run
pnpm writing unpublish 0001
```

`unpublish` accepts a numeric entry only. It verifies and removes the entry's local SFI record, local newsletter template, and generated public image copies, plus its generated Venture record when applicable. It changes `"status": "published"` to `"status": "unpublished"` and preserves the author source, original author images, entry number, slug, excerpt, date, time, and all other metadata. The original publication stamp therefore remains intact, and the entry number remains allocated.

A dry run prints the exact plan without changing anything. Without `--yes`, the real command asks for confirmation; `--yes` is reserved for deliberate automation. Repeating the command for an already unpublished entry is safe. It refuses a draft, because a draft has never been published and has no publication state to withdraw.

To revise and republish it later, use the ordinary workflow without `--replace`:

```sh
pnpm writing review 0001
pnpm writing view 0001
pnpm writing publish 0001 --dry-run
pnpm writing publish 0001
```

Republishing restores the generated records while retaining the original publication date, time, excerpt, slug, and URL.

### Erase the entire local entry

Use `erase` only when the generated copies and the complete author folder should both be removed:

```sh
pnpm writing erase 0001 --dry-run
pnpm writing erase 0001
```

`erase` accepts a numeric entry only and works for draft, published, or unpublished entries. It removes verified local generated records and public image copies, then removes the complete `writing/<blog>/<slug>/` author folder, including its source and original images. The interactive safeguard requires typing `ERASE 0001` exactly; `--yes` bypasses that safeguard for intentional automation. Always inspect `--dry-run` first.

Erasure cannot be undone by the writing command. Uncommitted author files may be irrecoverable. Files that were committed can remain recoverable—and publicly visible—in Git history, so `erase` is not a privacy-history rewrite.

`unpublish` keeps an entry allocated because its author folder remains. `erase` releases its local allocation. The allocator chooses one greater than the highest entry still present: erasing the newest entry can make that number available to the next draft, while erasing an older entry leaves a gap. Reusing a number whose URL or newsletter has circulated can point old links at different writing, so do it only deliberately.

### Local and external copies

Both commands change the local repository only. Commit and deploy the removals before the public Vercel site changes. A development server, production build, CDN, browser, search engine, or social-preview cache may continue to show an older copy temporarily; restart or rebuild the local site when needed.

Neither command deletes a legacy Sanity mirror. Because the site can merge Sanity posts with local records, remove or unpublish that remote record separately if one exists. They also do not contact Resend: delete a remote Resend draft separately, and remember that a sent newsletter cannot be recalled. Committed content remains in Git history. For Venture entries, remove any manual peak, park, or travel `entrySlug` references separately so they do not become dead links.

## Metadata field reference

The machine-readable contract is [`writing/post.schema.json`](../writing/post.schema.json). Draft metadata may contain empty or `null` values so a new idea can be saved immediately; `review` and `publish` enforce the fields required for a public post.

| Field | Who sets it | Meaning |
| --- | --- | --- |
| `$schema` | draft command | Relative path to `writing/post.schema.json`. |
| `source` | draft or resource command | Filename of the one active body: native `entry.md`, `entry.html`, or `entry.txt`, or `<full-slug>.html` converted from Word. A preserved `.docx` snapshot is not the active source. |
| `title` | author | Journal/post title shown in the header. SFI normally uses `scope for imagination`; Venture normally uses `venture`. |
| `subtitle` | author | The entry-specific title used in headers, indexes, and the automatic slug. |
| `excerpt` | publish command, or author override | Short plain-text description for indexes and newsletters. Blank drafts derive it from the first meaningful prose block; use `--excerpt` or edit the value for a manual summary. |
| `entry` | draft command | One global four-digit string shared by SFI and Venture, for example `"0023"`. |
| `date` | publish command, or author override | Blank during normal drafting. First publish stamps local `YYYY-MM-DD` and uses it for the final eight slug digits; `--date` supports a deliberate retrospective date. |
| `time` | publish command | Blank during drafting. The first successful publish stamps local `HH:MM` immediately after approval and verifies that an automatic date has not rolled over; replacement publication preserves it. |
| `location` | author | Where the entry was written or situated, using the wording you want displayed. |
| `trip` | author | Optional public trip or grouping name for either blog, such as `La Vida August 2026 M1`. Venture requires one; unrelated SFI posts may use `null`. |
| `thread` | author | Optional lowercase, hyphenated slug shared by several entries in one story, trip, or series. |
| `slug` | commands, author may override | `NNNN-title-subtitle-YYYYMMDD`, automatically derived from entry, title, subtitle, and date. Draft creates a provisional date suffix; first publish finalizes it, the folder, and any Word-derived HTML filename. A manual slug requires an explicit date. |
| `music` | author | Optional tagline with required `title` and `artist`, plus optional `album` and absolute `url`. Use `null` for no song. |
| `tags` | author | Manual descriptive tags. Every Venture post must include `venture`. |
| `blog` | author at draft creation | `sfi` for a general entry or `venture` for the Venture subset. |
| `collections` | author | Optional collection slugs such as `northeast-115`, `national-parks`, or `travels`. |
| `latitude` / `longitude` | author | Coordinates for mapping. SFI-only posts may leave both `null`; Venture publication requires both. |
| `status` | commands | `draft` before first publication, `published` while generated records are live, and `unpublished` after withdrawal. `publish` and `unpublish` manage the transitions; do not change this field by hand. |

### Music example

```json
"music": {
  "title": "Sweet Heat Lightning",
  "artist": "Gregory Alan Isakov",
  "album": "Appaloosa Bones",
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
  --location "Cambridge, MA" \
  --tags "musings"
```

If created on August 25, the draft metadata will look like this; its slug date is provisional:

```json
{
  "$schema": "../../post.schema.json",
  "source": "entry.md",
  "title": "scope for imagination",
  "subtitle": "a note from cambridge",
  "excerpt": "",
  "entry": "0001",
  "date": "",
  "time": "",
  "location": "Cambridge, MA",
  "trip": null,
  "thread": null,
  "slug": "0001-scope-for-imagination-a-note-from-cambridge-20260825",
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
pnpm writing review 0001
pnpm writing publish 0001 --dry-run
pnpm writing publish 0001
```

The successful publish derives `excerpt`, fills `date` and `time`, finalizes the slug/folder date—and a Word-derived HTML filename when applicable—and changes `status` to `published`.

## Example: La Vida August 2026 M1

Import the source:

```sh
pnpm writing draft \
  --blog venture \
  --source "/path/to/la-vida-august-2026-m1.docx" \
  --title "venture" \
  --subtitle "La Vida August 2026 M1" \
  --location "Adirondack Mountains, New York" \
  --trip "La Vida August 2026 M1" \
  --thread "la-vida-august-2026-m1" \
  --tags "venture,hiking" \
  --collections "northeast-115" \
  --latitude 44.1437 \
  --longitude -73.986
```

If created on August 26, the Word manuscript is preserved as `la-vida-august-2026-m1.docx`, while its editable active source is `0002-venture-la-vida-august-2026-m1-20260826.html`. The draft metadata includes:

```json
{
  "$schema": "../../post.schema.json",
  "source": "0002-venture-la-vida-august-2026-m1-20260826.html",
  "title": "venture",
  "subtitle": "La Vida August 2026 M1",
  "excerpt": "",
  "entry": "0002",
  "date": "",
  "time": "",
  "location": "Adirondack Mountains, New York",
  "trip": "La Vida August 2026 M1",
  "thread": "la-vida-august-2026-m1",
  "slug": "0002-venture-la-vida-august-2026-m1-20260826",
  "music": null,
  "tags": ["venture", "hiking"],
  "blog": "venture",
  "collections": ["northeast-115"],
  "latitude": 44.1437,
  "longitude": -73.986,
  "status": "draft"
}
```

The number is illustrative; use the number assigned by `draft`. If several La Vida posts belong together, keep the same `trip` and `thread` while giving each its own entry, subtitle, slug, publication stamp, and source folder.

Review and publish through the same pipeline:

```sh
pnpm writing review 0002
pnpm writing publish 0002 --dry-run
pnpm writing publish 0002
```

The result appears as one globally numbered entry in SFI and as a specialized Venture story. Link its published Venture slug from relevant peak, park, or travel field-note records when those places should point to the story.

## Author sources and generated outputs

Author-owned files live under `writing/`:

```text
writing/<blog>/<slug>/post.json
writing/<blog>/<slug>/entry.{md,html,txt}
writing/<blog>/<slug>/<slug>.html        # active body converted from Word
writing/<blog>/<slug>/*.docx             # optional preserved manuscript snapshot
writing/<blog>/<slug>/images/*
writing/<blog>/<slug>/images/docx/*      # managed Word-embedded images
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

Private standalone previews are generated separately and ignored by Git:

```text
.writing-preview/<slug>/index.html
```

Treat generated files like build artifacts:

- edit `writing/.../post.json` or the active file named by its `source` field, not generated JSON;
- rerun `review` and `publish --replace` after an intentional edit;
- commit author sources, generated records, and generated public images together; and
- never store private trip notes, secrets, or unpublished material in generated public records.

## Pre-publish checklist

- The entry number is the one assigned by `draft` and is not duplicated.
- The provisional folder name and `slug` match.
- Title, subtitle, and location are final.
- The derived excerpt and publication date/time shown by `publish --dry-run` are right, or deliberate overrides are present.
- The source contains no visible starter prompt, `TODO`, `TBD`, `FIXME`, `TK`, private notes, or unintended comments.
- Tags are intentional; Venture includes `venture`.
- Trip, thread, and collections describe the right grouping.
- Music title and artist are paired, and its optional URL works.
- SFI coordinates are either both supplied or both `null`; Venture coordinates are both supplied.
- Every image has useful alt text and contains nothing private.
- `pnpm writing review TARGET` passes.
- `pnpm writing render TARGET` shows the intended standalone preview.
- `pnpm writing publish TARGET --dry-run` lists the expected outputs.
- The local post and indexes look right.
- `pnpm build` passes before pushing.
- The public URL works before a newsletter is created or sent.

## Troubleshooting

### “Target not found” or “target is ambiguous”

Use the complete path to the author metadata:

```sh
pnpm writing review writing/venture/0002-venture-la-vida-august-2026-m1-20260826/post.json
```

Entry numbers and slugs must be unique across both blog folders.

### The next entry number looks wrong

Do not manually reuse a number. Check both `writing/sfi/` and `writing/venture/`, including draft and unpublished entries. The sequence is global, and every author folder reserves its assigned number. `erase` releases that local allocation; only erasing the highest entry can make the same number the allocator's next choice.

### Review reports blank fields

Open `post.json` and fill the reported value. Blank `excerpt`, `date`, and `time` are intentional for an unpublished draft: first publish derives or stamps them. `review` shows the planned excerpt and notes the automatic fields.

### Review finds unfinished text

Search the active file named by `post.json.source` for the visible starter prompt, bracketed placeholders, `TODO`, `TBD`, `FIXME`, `TK`, placeholder URLs, and scaffolding language. The commented quick reference is ignored by rendering and may remain.

### The date changed after the draft was created

Do not rename the draft manually. First publish atomically aligns `date`, the final eight slug digits, the post folder, and any Word-derived slug HTML filename after confirmation. Use `--date` when drafting—or enter an intentional date in `post.json`—for a retrospective post; `publish --dry-run` shows the resulting final paths without changing anything.

### A Venture story is missing from one journal

Confirm `"blog": "venture"`, the `venture` tag, and `"status": "published"`; then republish with `--replace`. A valid Venture publish generates both records from the same author source.

### Images are missing

Keep originals in the post's `images/` folder, use `images/...` relative references, and check alt text and filename casing. Rerun `review`, then `publish --replace`. Published copies live under `/images/posts/<slug>/`; do not edit those generated copies directly.

### Publish refuses to overwrite a record

This protects an existing published entry. Confirm that you are editing the correct author folder, run `review`, preview with `publish --dry-run`, and then use `publish TARGET --replace`.

### Re-sourcing did not change the website

That separation is intentional. `resource` and `re-source` update only the active author source. For a Word manuscript, they regenerate the editable slug HTML and managed `images/docx/` files after confirmation, without touching the current generated website record. Run `review`, inspect `render` or `view`, then use `publish TARGET --replace` to regenerate the local website records. Commit and deploy those changes before the public site updates.

### An unpublished or erased entry is still visible

Confirm that the local deletion was committed and successfully deployed. Then check for a legacy Sanity copy and allow for Vercel/CDN, browser, search-engine, and social-preview caches. A Resend broadcast and Git history are separate systems and are not removed by either command.

### Newsletter cannot connect

First use `--dry-run`. Then check the private Resend environment variables described in [`docs/newsletter-setup.md`](../docs/newsletter-setup.md). Publishing remains local and safe even when newsletter credentials are absent.
