# Scope for Imagination posts

The primary workflow is repo-native: write a draft here, generate a numbered local post JSON file, preview it locally, and commit it with the rest of the site. Sanity's `Scope for Imagination Post` schema is available as a useful structure/checklist and optional publishing target, but it does not have to be the final destination.

The live site reads local JSON files in `content/scope-for-imagination/posts/*.json`. It can also read published Sanity `Scope for Imagination Post` documents. If the same four-digit `entry` exists in both places, the local JSON file wins.

## Local Workflow

1. Start a local HTML draft:

```sh
pnpm sfi:draft --subtitle="Post subtitle" --tags="musings"
```

This creates the next numbered file in `content/scope-for-imagination/drafts/` and prints the publish/check commands for that entry.
To pair the entry with a song, add `--music-title` and `--music-artist`; `--music-url` can optionally link the song. The generated publish command carries those values forward.

2. Edit the draft, replacing or removing every bracketed prompt.
3. Generate the local post JSON and newsletter template with the command printed by `pnpm sfi:draft`, for example:

```sh
pnpm sfi:new \
  --doc="content/scope-for-imagination/drafts/0002-post-subtitle.html" \
  --title="scope for imagination" \
  --subtitle="Post subtitle" \
  --tags="musings" \
  --location="Cambridge, MA"
```

4. Validate the generated post and email template:

```sh
pnpm sfi:check --entry=0002
```

5. Preview `/scope-for-imagination/index` and `/scope-for-imagination/0002`.
6. Create a Resend broadcast draft when you are ready to email the list:

```sh
pnpm sfi:newsletter --entry=0002
```

The generation step creates:

- `content/scope-for-imagination/posts/0002.json`
- `content/scope-for-imagination/newsletters/0002.json`

## Local Post Contract

Each local post follows the same shape:

- `title`, usually `scope for imagination`
- `subtitle`
- `date`, `YYYY-MM-DD`
- `time`, `HH:MM`
- `location`
- `entry`, four digits
- `tags`
- optional `music` object with `title`, `artist`, and an optional absolute `http(s)` `url`
- `bodyHtml`

The machine-readable version of this contract lives in `content/scope-for-imagination/post.schema.json`.

Every post header follows the same structure:

```text
scope for imagination
post subtitle
6.20.26 • 19:28 • Cambridge, MA • 0001
[song title], artist
```

The music line is omitted when an entry has no song. When a URL is supplied, the line links to it.

`pnpm sfi:check` validates this local contract and the paired newsletter template.

## Writing Inputs

`pnpm sfi:draft` creates an HTML draft in this repository. You can also start from Word, plain text, or another HTML file.

Word headings, bold text, italics, hyperlinks, quotations, lists, paragraphs, line breaks, and embedded images receive basic HTML formatting. Add useful alt text to images in Word when possible; the script carries it into the website.

For plain-text posts, separate paragraphs with a blank line. Lines beginning with `#`, `##`, or `###` become headings, and consecutive lines beginning with `-` become a list. HTML files use the contents of their `<body>` element.

Optional arguments for `pnpm sfi:new`:

- `--date=2026-06-20` sets the publication date; it defaults to today.
- `--time=19:28` sets the entry time using a 24-hour clock; it defaults to the current time.
- `--entry=0001` overrides the automatically assigned four-digit entry number.
- `--replace --entry=0001` replaces an existing numbered entry.
- `--music-title="Song title" --music-artist="Artist"` adds the optional music line. Both values are required together.
- `--music-url="https://example.com/song"` optionally links that line and requires the title and artist flags.

Images embedded in a Word document are extracted to `public/images/scope-for-imagination/<entry-number>/` and remain in their original position in the post.

## Optional Sanity Shape

The Sanity Studio schema mirrors the local contract, with a few authoring conveniences:

- `title`, usually `scope for imagination`
- `subtitle`
- `entry`, the four-digit post number used by the current route
- `slug`, usually generated from the entry number
- `publishedAt`
- `location`
- optional `music` with song title, artist, and link
- `status`, set to `published` when ready
- `tags`
- `excerpt`
- optional `heroImage`
- `body` for Portable Text posts written in Studio
- `bodyHtml` for posts generated locally and uploaded/exported
- optional newsletter subject and preview text

```sh
pnpm sfi:upload --entry=0002 --publish
```

The upload command is optional and requires `SANITY_API_WRITE_TOKEN`. The local site does not require it.
Generated newsletter templates include the same optional music line in both HTML and plain text.
