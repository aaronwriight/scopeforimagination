# Writing and publishing posts

This is the authoring guide for the site's two journals:

- **Scope for Imagination (SFI)** is the numbered journal at `/scope-for-imagination/NNNN`. It has a guided draft command, a post generator, validation, an optional Sanity upload, and an optional Resend newsletter.
- **Venture** is the adventure journal at `/venture/<slug>`. Its entries are currently authored as JSON and can be linked to one or more peak ascents, park visits, or travel visits.

Both journals support an optional music tagline. Writing a local post never uploads it, deploys the site, or emails anyone by itself.

## Scope for Imagination: the regular workflow

Run all commands from the repository root.

### 1. Start a draft

```sh
pnpm sfi:draft \
  --subtitle="Post subtitle" \
  --tags="musings" \
  --location="Cambridge, MA"
```

This command:

- chooses the next four-digit entry number by looking at both existing posts and existing HTML drafts;
- creates `content/scope-for-imagination/drafts/NNNN-post-subtitle.html`;
- prints the exact `pnpm sfi:new` and `pnpm sfi:check` commands for that entry.

The generated section headings are scaffolding. Keep, rename, reorder, or remove them. Replace or remove every square-bracketed prompt before generating the post; the checker treats bracketed text as unfinished draft material.

To request a specific entry number, add `--entry=0002`. To overwrite an existing HTML draft intentionally, add `--replace` as well.

### 2. Add an optional music tagline

Add the song when creating the draft:

```sh
pnpm sfi:draft \
  --subtitle="Post subtitle" \
  --tags="musings" \
  --music-title="Song title" \
  --music-artist="Artist name" \
  --music-url="https://example.com/song"
```

`--music-title` and `--music-artist` must be supplied together. `--music-url` is optional, must be an absolute `http(s)` URL, and makes the tagline clickable. The draft command carries these values into the `sfi:new` command it prints.

If the song is chosen after the draft was created, add the same music flags directly to `pnpm sfi:new`. With no music flags, the post simply has no music line.

### 3. Write and edit

Edit the generated HTML file. Only the contents of its `<body>` become the post body, so the metadata comment at the top is a writing reference rather than a source the generator reads automatically.

The generator also accepts another source document:

- `.html` or `.htm`: uses the contents of `<body>`;
- `.txt`: turns blank-line-separated blocks into paragraphs, `#`/`##`/`###` lines into headings, and consecutive `-` lines into a list;
- `.docx`: carries across basic headings, paragraphs, emphasis, links, quotations, lists, line breaks, and embedded images.

Images extracted from Word are stored in `public/images/scope-for-imagination/NNNN/`. Useful image alt text written in Word is carried into the site.

### 4. Generate the site entry

Use the exact command printed by `pnpm sfi:draft`. It will look like this:

```sh
pnpm sfi:new \
  --doc="content/scope-for-imagination/drafts/0002-post-subtitle.html" \
  --title="scope for imagination" \
  --subtitle="Post subtitle" \
  --tags="musings" \
  --location="Cambridge, MA" \
  --entry=0002
```

This creates two local files:

- `content/scope-for-imagination/posts/0002.json`, which the website reads;
- `content/scope-for-imagination/newsletters/0002.json`, the paired Resend email template.

Unless supplied explicitly, the post date and time are the date and time when `sfi:new` runs. For an exact header timestamp, add:

```sh
--date=2026-08-25 --time=19:28
```

Dates use `YYYY-MM-DD`; times use the 24-hour `HH:MM` format.

If the post JSON already exists and the draft changes, rerun the same command with `--replace --entry=NNNN`. This also regenerates the paired newsletter template. When the source is a Word document, replacing a post clears and re-extracts that entry's generated image directory.

### 5. Validate

```sh
pnpm sfi:check --entry=0002
```

This checks the post fields, four-digit entry number, date, time, tags, optional music data, unfinished bracketed prompts, script tags, and the paired newsletter template. To check every local SFI post, run `pnpm sfi:check` with no entry flag.

### 6. Preview locally

Start the site if it is not already running:

```sh
pnpm dev
```

Then review:

- `http://localhost:3000/scope-for-imagination/NNNN` for the entry;
- `http://localhost:3000/scope-for-imagination/index` for its placement in the journal index;
- the music line, links, headings, images, alt text, and mobile-width wrapping.

Keep editing the source draft and rerunning `sfi:new` with `--replace` until the entry is ready. Before pushing the site, run the full production check:

```sh
pnpm build
```

### 7. Publish the website

The local JSON post is the primary publishing source. Include the draft only if you want it versioned; the files required by the website are the generated post JSON and any post images. Include the generated newsletter JSON if the entry may be emailed.

Commit and push the finished website files through the site's normal GitHub/Vercel workflow. `sfi:new` itself does **not** deploy anything. Verify the public `/scope-for-imagination/NNNN` URL before sending its newsletter.

The site can also read published SFI documents from Sanity, but this is optional. A local JSON post wins when Sanity and the repository contain the same entry number. To mirror a local entry to Sanity:

```sh
pnpm sfi:upload --entry=0002 --publish
```

This requires the Sanity environment variables and `SANITY_API_WRITE_TOKEN`. Without `--publish`, the upload's status is `draft`; use `--replace` when intentionally replacing an existing Sanity document. Sanity is not required for the repo-native workflow.

### 8. Create or send the newsletter

Generating the post creates an email **template**, not a Resend broadcast. After the public entry URL works, create a broadcast draft with:

```sh
pnpm sfi:newsletter --entry=0002
```

This requires `RESEND_API_KEY`, `RESEND_SFI_SEGMENT_ID`, and `SFI_NEWSLETTER_FROM`. It uses the local newsletter template first, replaces its entry URL placeholder with `NEXT_PUBLIC_SITE_URL`, and creates a draft in Resend. Review the audience, sender, subject, preview text, links, formatting, and unsubscribe link in Resend before sending it there.

The following variant sends immediately and should only be used deliberately:

```sh
pnpm sfi:newsletter --entry=0002 --send
```

If no local newsletter template exists, the command can build one from a matching published Sanity post when the Sanity read environment is configured. See `docs/newsletter-setup.md` for the one-time Resend configuration.

## Venture: an adventure post

Venture does not yet have a post generator. Create one JSON file in `content/venture/entries/`, using `content/venture/entry.schema.json` as its contract. For example, the La Vida trip can begin as:

```json
{
  "$schema": "../entry.schema.json",
  "title": "La Vida August 2026 M1",
  "slug": "la-vida-august-2026-m1",
  "date": "2026-08-15",
  "trip": "La Vida August 2026 M1",
  "location": "Adirondack Mountains, New York",
  "latitude": 44.1437,
  "longitude": -73.986,
  "excerpt": "A short introduction for the Venture index and entry header.",
  "music": {
    "title": "Song title",
    "artist": "Artist name",
    "url": "https://example.com/song"
  },
  "tags": ["venture", "hiking"],
  "collections": ["northeast-115"],
  "bodyHtml": "<p>Write the trip story here.</p>"
}
```

Treat the example coordinates, date, excerpt, music, and body as placeholders to confirm while writing. Omit the entire `music` object when there is no song. A Venture entry must include the `venture` tag; the allowed collection values are `northeast-115`, `national-parks`, and `travels`.

The Venture entry's `date` is the journal entry date. The individual ascent or visit records retain their own dates, ordinal labels, and trip names.

### Link the story to its places

Set the matching ascent or visit record's `entrySlug` to the Venture entry slug:

- peaks: `content/venture/trails/northeast-115.json`;
- parks: `content/venture/parks/national-parks.json`;
- international travel: `content/venture/travels/travels.json`.

Several records can share one `entrySlug`. For a trip-wide story such as La Vida, each ascent covered by that story can point to `la-vida-august-2026-m1`. This makes the associated journal link appear from those place pages and from the Venture index. Do not copy private workbook notes into these public JSON files; write only the field note or story intended for the website.

Preview the result at:

- `http://localhost:3000/venture/la-vida-august-2026-m1`;
- `http://localhost:3000/venture/index`;
- each linked peak, park, or travel page.

Run `pnpm build` before committing and pushing; the build parses the Venture catalogs and generates their entry routes. There is currently no Venture-specific newsletter command.

## How SFI and Venture relate today

The two journals are separate publishing surfaces right now:

- An SFI post appears in SFI because it exists in `content/scope-for-imagination/posts/` (or as a published Sanity SFI document).
- A Venture post appears in Venture because it exists in `content/venture/entries/`.
- The required `venture` tag on a Venture entry prepares it for future SFI surfacing, but Venture entries are **not automatically shown in SFI yet**.
- If one story must appear in both places today, create an SFI entry tagged `venture` and a Venture entry separately. They do not currently cross-link automatically.

## Quick pre-publish checklist

- All draft prompts and placeholder values are gone.
- Title, subtitle/excerpt, date, time, location, and trip are correct.
- Music title and artist are paired; its optional URL opens correctly.
- Images have meaningful alt text and do not expose private information.
- Venture catalog links point to the intended `entrySlug`.
- `pnpm sfi:check --entry=NNNN` passes for an SFI entry.
- The entry and index pages look right locally.
- `pnpm build` passes.
- The public entry URL works before a Resend broadcast is sent.

