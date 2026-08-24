import northeast115Json from "../../content/venture/trails/northeast-115.json";

const EXPECTED_PEAK_COUNT = 115;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const stateAbbreviations = {
  Maine: "ME",
  "New Hampshire": "NH",
  "New York": "NY",
  Vermont: "VT",
} as const;

export type TrailAscent = Readonly<{
  ordinal: number;
  date: string | null;
  note: string | null;
  entrySlug: string | null;
}>;

export type NortheastPeak = Readonly<{
  rank: number;
  slug: string;
  name: string;
  elevationFeet: number;
  state: keyof typeof stateAbbreviations;
  stateAbbreviation: (typeof stateAbbreviations)[keyof typeof stateAbbreviations];
  range: string;
  prominenceFeet: number;
  peakbaggerAscents: number;
  completed: boolean;
  completionNumber: number | null;
  rating: number | null;
  timesHiked: number;
  ascents: readonly TrailAscent[];
  latitude: number;
  longitude: number;
  sourceUrl: string;
}>;

export type NortheastRangeArea = Readonly<{
  name: string;
  latitude: number;
  longitude: number;
  radiusDegrees: number;
  peakCount: number;
  completedPeakCount: number;
  stateAbbreviations: readonly NortheastPeak["stateAbbreviation"][];
}>;

type Northeast115Catalog = Readonly<{
  name: "Northeast 115";
  description: string;
  peakbaggerListUrl: string;
  coordinateSourceUrl: string;
  peaks: readonly NortheastPeak[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isHttpsUrl(value: unknown, expectedHostname?: string): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!expectedHostname || url.hostname === expectedHostname);
  } catch {
    return false;
  }
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !isoDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function parseAscent(value: unknown, peakSlug: string, index: number): TrailAscent {
  if (!isRecord(value)) {
    throw new Error(`Invalid ascent at ${peakSlug}.ascents[${index}].`);
  }

  const allowedKeys = ["ordinal", "date", "note", "entrySlug"] as const;
  if (!hasOnlyKeys(value, allowedKeys)) {
    throw new Error(`Unexpected ascent property at ${peakSlug}.ascents[${index}].`);
  }
  if (!Number.isInteger(value.ordinal) || value.ordinal !== index + 1) {
    throw new Error(`Invalid ascent ordinal at ${peakSlug}.ascents[${index}].`);
  }
  if (value.date !== null && !isIsoDate(value.date)) {
    throw new Error(`Invalid ascent date at ${peakSlug}.ascents[${index}].`);
  }
  if (value.note !== null && (typeof value.note !== "string" || value.note.trim().length === 0)) {
    throw new Error(`Invalid ascent note at ${peakSlug}.ascents[${index}].`);
  }
  if (value.entrySlug !== null && (typeof value.entrySlug !== "string" || !slugPattern.test(value.entrySlug))) {
    throw new Error(`Invalid entry slug at ${peakSlug}.ascents[${index}].`);
  }

  return Object.freeze({
    ordinal: value.ordinal as number,
    date: value.date as string | null,
    note: value.note as string | null,
    entrySlug: value.entrySlug as string | null,
  });
}

function parsePeak(value: unknown, index: number): NortheastPeak {
  if (!isRecord(value)) {
    throw new Error(`Invalid Northeast 115 peak at peaks[${index}].`);
  }

  const allowedKeys = [
    "rank",
    "slug",
    "name",
    "elevationFeet",
    "state",
    "stateAbbreviation",
    "range",
    "prominenceFeet",
    "peakbaggerAscents",
    "completed",
    "completionNumber",
    "rating",
    "timesHiked",
    "ascents",
    "latitude",
    "longitude",
    "sourceUrl",
  ] as const;
  if (!hasOnlyKeys(value, allowedKeys)) {
    throw new Error(`Unexpected property on Northeast 115 peak at peaks[${index}].`);
  }
  if (!Number.isInteger(value.rank) || (value.rank as number) < 1 || (value.rank as number) > EXPECTED_PEAK_COUNT) {
    throw new Error(`Invalid rank for Northeast 115 peak at peaks[${index}].`);
  }
  if (typeof value.slug !== "string" || !slugPattern.test(value.slug)) {
    throw new Error(`Invalid slug for Northeast 115 peak at peaks[${index}].`);
  }
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    throw new Error(`Invalid name for Northeast 115 peak ${value.slug}.`);
  }
  if (!Number.isInteger(value.elevationFeet) || (value.elevationFeet as number) <= 0) {
    throw new Error(`Invalid elevation for Northeast 115 peak ${value.slug}.`);
  }
  if (typeof value.state !== "string" || !(value.state in stateAbbreviations)) {
    throw new Error(`Invalid state for Northeast 115 peak ${value.slug}.`);
  }
  const state = value.state as keyof typeof stateAbbreviations;
  if (value.stateAbbreviation !== stateAbbreviations[state]) {
    throw new Error(`State abbreviation mismatch for Northeast 115 peak ${value.slug}.`);
  }
  if (typeof value.range !== "string" || value.range.trim().length === 0) {
    throw new Error(`Invalid range for Northeast 115 peak ${value.slug}.`);
  }
  if (!Number.isInteger(value.prominenceFeet) || (value.prominenceFeet as number) < 0) {
    throw new Error(`Invalid prominence for Northeast 115 peak ${value.slug}.`);
  }
  if (!Number.isInteger(value.peakbaggerAscents) || (value.peakbaggerAscents as number) < 0) {
    throw new Error(`Invalid Peakbagger ascent count for Northeast 115 peak ${value.slug}.`);
  }
  if (typeof value.completed !== "boolean") {
    throw new Error(`Invalid completion status for Northeast 115 peak ${value.slug}.`);
  }
  if (
    value.completionNumber !== null &&
    (!Number.isInteger(value.completionNumber) ||
      (value.completionNumber as number) < 1 ||
      (value.completionNumber as number) > EXPECTED_PEAK_COUNT)
  ) {
    throw new Error(`Invalid completion number for Northeast 115 peak ${value.slug}.`);
  }
  if (value.completionNumber !== null && !value.completed) {
    throw new Error(`Incomplete Northeast 115 peak ${value.slug} cannot have a completion number.`);
  }
  if (value.rating !== null && (typeof value.rating !== "number" || value.rating < 0 || value.rating > 10)) {
    throw new Error(`Invalid rating for Northeast 115 peak ${value.slug}.`);
  }
  if (!Number.isInteger(value.timesHiked) || (value.timesHiked as number) < 0) {
    throw new Error(`Invalid hike count for Northeast 115 peak ${value.slug}.`);
  }
  if (!Array.isArray(value.ascents)) {
    throw new Error(`Invalid ascent list for Northeast 115 peak ${value.slug}.`);
  }
  if (typeof value.latitude !== "number" || !Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) {
    throw new Error(`Invalid latitude for Northeast 115 peak ${value.slug}.`);
  }
  if (
    typeof value.longitude !== "number" ||
    !Number.isFinite(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180
  ) {
    throw new Error(`Invalid longitude for Northeast 115 peak ${value.slug}.`);
  }
  if (!isHttpsUrl(value.sourceUrl, "www.peakbagger.com")) {
    throw new Error(`Invalid Peakbagger URL for Northeast 115 peak ${value.slug}.`);
  }

  const ascents = Object.freeze(value.ascents.map((ascent, ascentIndex) => parseAscent(ascent, value.slug as string, ascentIndex)));
  if (ascents.length !== value.timesHiked || value.completed !== ((value.timesHiked as number) > 0)) {
    throw new Error(`Completion fields disagree for Northeast 115 peak ${value.slug}.`);
  }

  return Object.freeze({
    rank: value.rank as number,
    slug: value.slug,
    name: value.name,
    elevationFeet: value.elevationFeet as number,
    state,
    stateAbbreviation: value.stateAbbreviation as NortheastPeak["stateAbbreviation"],
    range: value.range,
    prominenceFeet: value.prominenceFeet as number,
    peakbaggerAscents: value.peakbaggerAscents as number,
    completed: value.completed,
    completionNumber: value.completionNumber as number | null,
    rating: value.rating as number | null,
    timesHiked: value.timesHiked as number,
    ascents,
    latitude: value.latitude,
    longitude: value.longitude,
    sourceUrl: value.sourceUrl,
  });
}

function parseCatalog(value: unknown): Northeast115Catalog {
  if (!isRecord(value)) throw new Error("Invalid Northeast 115 catalog.");

  const allowedKeys = [
    "$schema",
    "name",
    "description",
    "peakbaggerListUrl",
    "coordinateSourceUrl",
    "peaks",
  ] as const;
  if (!hasOnlyKeys(value, allowedKeys)) throw new Error("Unexpected property in Northeast 115 catalog.");
  if (value.name !== "Northeast 115") throw new Error("Invalid Northeast 115 catalog name.");
  if (typeof value.description !== "string" || value.description.trim().length === 0) {
    throw new Error("Invalid Northeast 115 catalog description.");
  }
  if (!isHttpsUrl(value.peakbaggerListUrl, "www.peakbagger.com")) {
    throw new Error("Invalid Northeast 115 source URL.");
  }
  if (!isHttpsUrl(value.coordinateSourceUrl, "www.wilderlist.app")) {
    throw new Error("Invalid Northeast 115 coordinate source URL.");
  }
  if (!Array.isArray(value.peaks) || value.peaks.length !== EXPECTED_PEAK_COUNT) {
    throw new Error(`Northeast 115 catalog must contain exactly ${EXPECTED_PEAK_COUNT} peaks.`);
  }

  const peaks = Object.freeze(value.peaks.map(parsePeak));
  const slugs = new Set(peaks.map((peak) => peak.slug));
  if (slugs.size !== peaks.length) throw new Error("Northeast 115 peak slugs must be unique.");
  const completionNumbers = peaks.flatMap((peak) =>
    peak.completionNumber === null ? [] : [peak.completionNumber],
  );
  if (new Set(completionNumbers).size !== completionNumbers.length) {
    throw new Error("Northeast 115 completion numbers must be unique.");
  }
  for (let index = 1; index < peaks.length; index += 1) {
    if (peaks[index - 1].rank > peaks[index].rank) {
      throw new Error("Northeast 115 peaks must be sorted by rank.");
    }
  }

  return Object.freeze({
    name: value.name,
    description: value.description,
    peakbaggerListUrl: value.peakbaggerListUrl,
    coordinateSourceUrl: value.coordinateSourceUrl,
    peaks,
  });
}

const catalog = parseCatalog(northeast115Json as unknown);
const peaksBySlug = new Map(catalog.peaks.map((peak) => [peak.slug, peak]));

export const northeast115SourceUrl = catalog.peakbaggerListUrl;
export const northeast115CoordinateSourceUrl = catalog.coordinateSourceUrl;

export function getAllNortheastPeaks(): readonly NortheastPeak[] {
  return catalog.peaks;
}

export function getNortheastPeak(slug: string): NortheastPeak | null {
  if (!slugPattern.test(slug)) return null;
  return peaksBySlug.get(slug) ?? null;
}

export function getCompletedNortheastPeaks(): readonly NortheastPeak[] {
  return catalog.peaks.filter((peak) => peak.completed);
}

function angularDistanceDegrees(
  first: Pick<NortheastPeak, "latitude" | "longitude">,
  second: Pick<NortheastPeak, "latitude" | "longitude">,
): number {
  const radians = Math.PI / 180;
  const firstLatitude = first.latitude * radians;
  const secondLatitude = second.latitude * radians;
  const latitudeDelta = (second.latitude - first.latitude) * radians;
  const longitudeDelta = (second.longitude - first.longitude) * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return (2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))) / radians;
}

/**
 * Geographic summaries for ranges containing at least one recorded summit.
 * The atlas can reuse the centers and radii to draw the same range highlights
 * as the Northeast map without duplicating grouping logic.
 */
export function getCompletedNortheastRangeAreas(): readonly NortheastRangeArea[] {
  const grouped = new Map<string, NortheastPeak[]>();
  for (const peak of catalog.peaks) {
    const peaks = grouped.get(peak.range) ?? [];
    peaks.push(peak);
    grouped.set(peak.range, peaks);
  }

  return Object.freeze(
    [...grouped.entries()]
      .map(([name, peaks]) => {
        const completedPeakCount = peaks.filter((peak) => peak.completed).length;
        const latitude = peaks.reduce((sum, peak) => sum + peak.latitude, 0) / peaks.length;
        const longitude = peaks.reduce((sum, peak) => sum + peak.longitude, 0) / peaks.length;
        const center = { latitude, longitude };
        const radiusDegrees = Math.max(
          0.16,
          ...peaks.map((peak) => angularDistanceDegrees(center, peak) + 0.1),
        );

        return Object.freeze({
          name,
          latitude,
          longitude,
          radiusDegrees,
          peakCount: peaks.length,
          completedPeakCount,
          stateAbbreviations: Object.freeze(
            [...new Set(peaks.map((peak) => peak.stateAbbreviation))].sort(),
          ),
        });
      })
      .filter((area) => area.completedPeakCount > 0)
      .sort((first, second) => first.name.localeCompare(second.name)),
  );
}
