# Venture entries

Venture is an adventure journal for hikes, trips, the Northeast 115, and the 63 U.S. national parks. The live site reads JSON field notes from `content/venture/entries/` and places every entry on the interactive globe using its latitude and longitude.

The two goal catalogs live separately from the journal entries:

- `trails/northeast-115.json` contains all 115 peaks, summit coordinates, completion state, repeated ascents, ratings, and the notes imported from Aaron's workbook.
- `parks/national-parks.json` contains all 63 parks and repeatable visit records. It starts with an empty visit history so no trips are invented.

Every peak and park has a canonical page. The atlas marker and the corresponding row on the trails or parks index use that same URL; a place page can then link to one or more full journal entries through `entrySlug`.

To add an entry, create `content/venture/entries/my-adventure.json` with this shape:

```json
{
  "$schema": "../entry.schema.json",
  "title": "Adventure title",
  "slug": "adventure-title",
  "date": "2026-08-24",
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

The `music` object is optional. Omit it entirely when an entry has no song attached; `title` and `artist` are required when it is present, while `url` is optional. Use an empty `collections` array for adventures outside the two current goals. Keeping the `venture` tag on every entry prepares these stories to be surfaced in Scope for Imagination later.

To re-import the Northeast 115 workbook, run:

```bash
python3 scripts/import_northeast_115.py /path/to/Northeast\ 115.xlsx /path/to/wilderlist-response.json
```

The importer requires `openpyxl`. The second argument is a saved response for the public Wilderlist Northeast 111 list; coordinates are stored locally and are never fetched at runtime.
