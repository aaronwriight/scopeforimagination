# Venture entries

For the canonical author workflow, shared SFI/Venture numbering, folder structure, and a La Vida example, start with [`writing/README.md`](../../writing/README.md).

Venture is an adventure journal for hikes, trips, the Northeast 115, and the 63 U.S. national parks. It is a subset of Scope for Imagination and shares its global entry sequence. Do not author posts directly in `content/venture/entries/`; `pnpm writing publish TARGET` generates those public records from `writing/venture/<slug>/`.

The live site reads generated journal records from `content/venture/entries/` and places every published entry on the interactive globe using its latitude and longitude.

The place catalogs live separately from the journal entries:

- `trails/northeast-115.json` contains all 115 peaks, summit coordinates, completion state, repeated ascents, and ratings. Workbook notes stay private unless the importer is run with the explicit `--include-private-notes` flag.
- `parks/national-parks.json` contains all 63 parks and repeatable visit records. Unknown dates are stored as `null` rather than invented.
- `travels/travels.json` contains the temporary international-travel branch. Every visit requires a date field; use `null` until the date is known, and add the optional `entrySlug` only when a full Venture entry exists.

Every ascent, park visit, travel visit, and standalone Venture entry also carries a `trip` field. Use `null` until the surrounding trip name is known.

Every peak and park has a canonical page. The atlas marker and the corresponding row on the trails or parks index use that same URL; a place page can then link to one or more full journal entries through `entrySlug`.

After publishing a Venture story, use its generated slug as the `entrySlug` on the relevant ascent or visit records. Several records can point to the same story. Keep private workbook and trip notes out of these public catalog files.

To re-import the Northeast 115 workbook, run:

```bash
python3 scripts/import_northeast_115.py /path/to/northeast_115.xlsx
```

The importer requires `openpyxl` and reads columns by their header names. With no second argument, it preserves the current catalog's stable slugs, coordinates, Peakbagger URLs, and linked entry slugs. To refresh coordinates, optionally supply a saved response for the public Wilderlist Northeast 111 list as the second argument; coordinates are stored locally and are never fetched at runtime. `NA` ascent dates become `null`, and a blank personal-ascent count remains unknown rather than creating a placeholder record. Workbook narrative columns remain private by default; only pass `--include-private-notes` when you deliberately want them copied into the public catalog.
