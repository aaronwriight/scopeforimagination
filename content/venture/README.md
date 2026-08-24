# Venture entries

Venture is an adventure journal for hikes, trips, the Northeast 115 4,000-footers, and the 63 U.S. national parks. The live site reads JSON files from `content/venture/entries/` and places every entry on the interactive globe using its latitude and longitude.

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
  "tags": ["venture", "hiking"],
  "collections": ["northeast-115"],
  "bodyHtml": "<p>Write the story here.</p>"
}
```

Use an empty `collections` array for adventures outside the two current goals. Keeping the `venture` tag on every entry prepares these stories to be surfaced in Scope for Imagination later.
