# Venture entries

For the complete author workflow and a trip-post example, start with [`docs/writing-and-publishing.md`](../../docs/writing-and-publishing.md).

Venture is an adventure journal for hikes, trips, the Northeast 115, and the 63 U.S. national parks. The live site reads JSON field notes from `content/venture/entries/` and places every entry on the interactive globe using its latitude and longitude.

The place catalogs live separately from the journal entries:

- `trails/northeast-115.json` contains all 115 peaks, summit coordinates, completion state, repeated ascents, and ratings. Workbook notes stay private unless the importer is run with the explicit `--include-private-notes` flag.
- `parks/national-parks.json` contains all 63 parks and repeatable visit records. Unknown dates are stored as `null` rather than invented.
- `travels/travels.json` contains the temporary international-travel branch. Every visit requires a date field; use `null` until the date is known, and add the optional `entrySlug` only when a full Venture entry exists.

Every ascent, park visit, travel visit, and standalone Venture entry also carries a `trip` field. Use `null` until the surrounding trip name is known.

Every peak and park has a canonical page. The atlas marker and the corresponding row on the trails or parks index use that same URL; a place page can then link to one or more full journal entries through `entrySlug`.

To add an entry, create `content/venture/entries/my-adventure.json` with this shape:

```json
{
  "$schema": "../entry.schema.json",
  "title": "Adventure title",
  "slug": "adventure-title",
  "date": "2026-08-24",
  "trip": "Trip or expedition name",
  "location": "Place, State",
  "latitude": 44.2706,
  "longitude": -71.3033,
  "excerpt": "A short introduction for the atlas and entry list.",
  "music": {
    "title": "Song title",
    "artist": "Artist name",
    "url": "https://example.com/song"
  },
  "tags": ["venture", "hiking"],
  "collections": ["northeast-115"],
  "bodyHtml": "<p>Write the story here.</p>"
}
```

The `music` object is optional. Omit it entirely when an entry has no song attached; `title` and `artist` are required when it is present, while `url` is optional. Use an empty `collections` array for adventures outside the current catalogs. Keeping the `venture` tag on every entry prepares these stories to be surfaced in Scope for Imagination later.

To re-import the Northeast 115 workbook, run:

```bash
python3 scripts/import_northeast_115.py /path/to/northeast_115.xlsx
```

The importer requires `openpyxl` and reads columns by their header names. With no second argument, it preserves the current catalog's stable slugs, coordinates, Peakbagger URLs, and linked entry slugs. To refresh coordinates, optionally supply a saved response for the public Wilderlist Northeast 111 list as the second argument; coordinates are stored locally and are never fetched at runtime. `NA` ascent dates become `null`, and a blank personal-ascent count remains unknown rather than creating a placeholder record. Workbook narrative columns remain private by default; only pass `--include-private-notes` when you deliberately want them copied into the public catalog.
