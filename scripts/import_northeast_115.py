#!/usr/bin/env python3
"""Import Aaron's Northeast 115 workbook into Venture's peak catalog.

The workbook is the source of truth for rankings, completion state, ratings,
and ascent counts. Workbook notes are private by default and are copied only
when ``--include-private-notes`` is explicitly supplied. Coordinates come from
the public Wilderlist Northeast 111 response, whose 115 mountains correspond to
the same peak-bagging list.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


PEAKBAGGER_LIST_URL = "https://www.peakbagger.com/list.aspx?lid=511"
COORDINATE_SOURCE_URL = "https://www.wilderlist.app/list/5db9de782d4ef1001786a442"
STATE_ABBREVIATIONS = {
    "Maine": "ME",
    "New Hampshire": "NH",
    "New York": "NY",
    "Vermont": "VT",
}
COORDINATE_ALIASES = {
    "Katahdin": "Mount Katahdin - Baxter Peak",
    "Hamlin Peak": "Mount Katahdin - Hamlin Peak",
    "Wildcat Mountain": "Wildcat Mountain, A Peak",
    "Mount Mansfield": "Mount Mansfield - The Chin",
    "Old Speck": "Old Speck Mountain",
    "Mount Osceola - East Peak": "East Osceola",
    "Avery Peak": "Bigelow Mountain - Avery Peak",
    "Wildcat D": "Wildcat Mountain, D Peak",
}

COMPLETION_NUMBERS = {
    "phelps-mountain": 26,
}

ASCENT_DETAILS = {
    ("upper-wolfjaw-mountain", 1): {
        "date": "2026-08-11",
        "trip": "La Vida August 2026 M1",
    },
    ("armstrong-mountain", 1): {
        "date": "2026-08-11",
        "trip": "La Vida August 2026 M1",
    },
    ("mount-haystack", 1): {
        "date": "2026-08-12",
        "trip": "La Vida August 2026 M1",
    },
    ("phelps-mountain", 1): {
        "date": "2026-08-14",
        "trip": "La Vida August 2026 M1",
    },
    ("algonquin-peak", 2): {
        "date": "2026-08-15",
        "trip": "La Vida August 2026 M1",
    },
}


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    value = value.replace("&", " and ").replace("'", "")
    value = re.sub(r"\([^)]*\)", " ", value)
    value = value.replace("formerly east dix", "east dix")
    value = value.replace("bondcliffs", "bondcliff")
    value = value.replace("table top", "tabletop")
    value = value.replace("rocky peak ridge", "rocky peak")
    value = value.replace("camels hump", "camel s hump")
    value = re.sub(r"\bmt\.?\b", "mount", value)
    value = re.sub(r"\bmountain\b", "mount", value)
    value = re.sub(r"\bpeak\b", "", value)
    value = re.sub(r"\bthe\b", "", value)
    return " ".join(re.findall(r"[a-z0-9]+", value))


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    value = re.sub(r"\s*\(formerly east dix\)\s*", "", value)
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", value))


def load_coordinates(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text())
    try:
        peak_list = payload["data"]["peakList"]
        coordinates = peak_list["mountains"] + peak_list.get("optionalMountains", [])
    except (KeyError, TypeError) as error:
        raise ValueError("Coordinate JSON is not a Wilderlist peak-list response") from error

    if len(coordinates) != 115:
        raise ValueError(f"Expected 115 coordinate records, found {len(coordinates)}")
    return coordinates


def coordinate_for(
    peak_name: str,
    state: str,
    coordinates: list[dict[str, Any]],
) -> tuple[float, float]:
    target_name = COORDINATE_ALIASES.get(peak_name, peak_name)
    state_abbreviation = STATE_ABBREVIATIONS[state]
    matches = [
        item
        for item in coordinates
        if item["locationTextShort"] == state_abbreviation
        and normalize_name(item["name"]) == normalize_name(target_name)
    ]
    if len(matches) != 1:
        raise ValueError(
            f"Expected one coordinate match for {peak_name}, found "
            f"{len(matches)}: {[item['name'] for item in matches]}"
        )

    longitude, latitude = matches[0]["location"]
    return round(float(latitude), 7), round(float(longitude), 7)


def nonempty_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def has_completion_highlight(cell: Any) -> bool:
    """Recognize the workbook's green completion fill without relying on a style ID."""
    fill = cell.fill
    color = fill.fgColor
    return fill.fill_type == "solid" and color.type == "theme" and color.theme == 9 and color.tint > 0


def build_catalog(
    workbook_path: Path,
    coordinate_path: Path,
    *,
    include_private_notes: bool = False,
) -> dict[str, Any]:
    workbook = load_workbook(workbook_path, data_only=True)
    sheet = workbook.active
    coordinates = load_coordinates(coordinate_path)

    source_rows: list[dict[str, Any]] = []
    for row in range(9, sheet.max_row + 1):
        rank = sheet.cell(row, 2).value
        name = nonempty_text(sheet.cell(row, 3).value)
        if not isinstance(rank, (int, float)) or not name:
            continue

        source_rows.append(
            {
                "row": row,
                "rank": int(rank),
                "name": name,
                "elevationFeet": int(sheet.cell(row, 4).value),
                "state": str(sheet.cell(row, 5).value),
                "range": str(sheet.cell(row, 6).value),
                "prominenceFeet": int(sheet.cell(row, 7).value),
                "peakbaggerAscents": int(sheet.cell(row, 8).value),
                "checked": nonempty_text(sheet.cell(row, 10).value) is not None,
                "rating": sheet.cell(row, 11).value,
                "timesHiked": sheet.cell(row, 12).value,
                "notes": [sheet.cell(row, column).value for column in (13, 14, 15)],
                "highlighted": has_completion_highlight(sheet.cell(row, 3)),
                "sourceUrl": sheet.cell(row, 3).hyperlink.target,
            }
        )

    if len(source_rows) != 115:
        raise ValueError(f"Expected 115 workbook rows, found {len(source_rows)}")

    base_slugs = [slugify(row["name"]) for row in source_rows]
    duplicate_slugs = {slug for slug, count in Counter(base_slugs).items() if count > 1}
    peaks: list[dict[str, Any]] = []

    for row, base_slug in zip(source_rows, base_slugs, strict=True):
        slug = base_slug
        if slug in duplicate_slugs:
            slug = f"{slug}-{STATE_ABBREVIATIONS[row['state']].lower()}"

        workbook_count = int(row["timesHiked"] or 0)
        workbook_completed = bool(row["checked"] or row["highlighted"] or workbook_count > 0)
        times_hiked = max(workbook_count, 1 if workbook_completed else 0)
        note_texts = (
            [nonempty_text(note) for note in row["notes"]]
            if include_private_notes
            else [None, None, None]
        )
        ascent_count = max(times_hiked, len([note for note in note_texts if note]))
        ascents = [
            {
                "ordinal": ordinal,
                "date": ASCENT_DETAILS.get((slug, ordinal), {}).get("date"),
                "trip": ASCENT_DETAILS.get((slug, ordinal), {}).get("trip"),
                "note": note_texts[ordinal - 1] if ordinal <= len(note_texts) else None,
                "entrySlug": None,
            }
            for ordinal in range(1, ascent_count + 1)
        ]
        latitude, longitude = coordinate_for(row["name"], row["state"], coordinates)

        rating = row["rating"]
        peaks.append(
            {
                "rank": row["rank"],
                "slug": slug,
                "name": row["name"],
                "elevationFeet": row["elevationFeet"],
                "state": row["state"],
                "stateAbbreviation": STATE_ABBREVIATIONS[row["state"]],
                "range": row["range"],
                "prominenceFeet": row["prominenceFeet"],
                "peakbaggerAscents": row["peakbaggerAscents"],
                "completed": times_hiked > 0,
                "completionNumber": COMPLETION_NUMBERS.get(slug),
                "rating": float(rating) if rating is not None else None,
                "timesHiked": times_hiked,
                "ascents": ascents,
                "latitude": latitude,
                "longitude": longitude,
                "sourceUrl": row["sourceUrl"],
            }
        )

    return {
        "$schema": "./northeast-115.schema.json",
        "name": "Northeast 115",
        "description": "A summit-by-summit log of the 4000-footers across New Hampshire, New York, Maine, and Vermont.",
        "peakbaggerListUrl": PEAKBAGGER_LIST_URL,
        "coordinateSourceUrl": COORDINATE_SOURCE_URL,
        "peaks": peaks,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("coordinates", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("content/venture/trails/northeast-115.json"),
    )
    parser.add_argument(
        "--include-private-notes",
        action="store_true",
        help="Explicitly copy private workbook notes into the public catalog.",
    )
    args = parser.parse_args()

    catalog = build_catalog(
        args.workbook,
        args.coordinates,
        include_private_notes=args.include_private_notes,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")

    complete = sum(peak["completed"] for peak in catalog["peaks"])
    print(f"Wrote {len(catalog['peaks'])} peaks ({complete} complete) to {args.output}")


if __name__ == "__main__":
    main()
