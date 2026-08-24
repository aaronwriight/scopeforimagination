import nationalParksJson from "../../content/venture/parks/national-parks.json";

const EXPECTED_NATIONAL_PARK_COUNT = 63;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const npsCodePattern = /^[A-Z]{4}$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export type NationalParkVisit = Readonly<{
  date?: string;
  notes?: string;
  entrySlug?: string;
}>;

export type NationalPark = Readonly<{
  slug: string;
  npsCode: string;
  name: string;
  stateOrTerritory: string;
  latitude: number;
  longitude: number;
  visited: boolean;
  visits: readonly NationalParkVisit[];
  sourceUrl: string;
}>;

type NationalParksCatalog = Readonly<{
  coordinateSourceUrl: string;
  coordinateSourceNote: string;
  parks: readonly NationalPark[];
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

function parseVisit(value: unknown, parkSlug: string, index: number): NationalParkVisit {
  if (!isRecord(value)) {
    throw new Error(`Invalid national park visit at ${parkSlug}.visits[${index}]: expected an object.`);
  }

  const allowedKeys = ["date", "notes", "entrySlug"] as const;
  if (!hasOnlyKeys(value, allowedKeys) || Object.keys(value).length === 0) {
    throw new Error(
      `Invalid national park visit at ${parkSlug}.visits[${index}]: expected at least one of date, notes, or entrySlug.`,
    );
  }

  if (value.date !== undefined && !isIsoDate(value.date)) {
    throw new Error(`Invalid national park visit date at ${parkSlug}.visits[${index}].date.`);
  }
  if (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.trim().length === 0)) {
    throw new Error(`Invalid national park visit notes at ${parkSlug}.visits[${index}].notes.`);
  }
  if (value.entrySlug !== undefined && (typeof value.entrySlug !== "string" || !slugPattern.test(value.entrySlug))) {
    throw new Error(`Invalid national park entry slug at ${parkSlug}.visits[${index}].entrySlug.`);
  }

  return Object.freeze({
    ...(value.date === undefined ? {} : { date: value.date }),
    ...(value.notes === undefined ? {} : { notes: value.notes }),
    ...(value.entrySlug === undefined ? {} : { entrySlug: value.entrySlug }),
  });
}

function parsePark(value: unknown, index: number): NationalPark {
  if (!isRecord(value)) {
    throw new Error(`Invalid national park at parks[${index}]: expected an object.`);
  }

  const allowedKeys = [
    "slug",
    "npsCode",
    "name",
    "stateOrTerritory",
    "latitude",
    "longitude",
    "visited",
    "visits",
    "sourceUrl",
  ] as const;

  if (!hasOnlyKeys(value, allowedKeys)) {
    throw new Error(`Invalid national park at parks[${index}]: unexpected property.`);
  }
  if (typeof value.slug !== "string" || !slugPattern.test(value.slug)) {
    throw new Error(`Invalid national park slug at parks[${index}].slug.`);
  }
  if (typeof value.npsCode !== "string" || !npsCodePattern.test(value.npsCode)) {
    throw new Error(`Invalid NPS code for national park ${value.slug}.`);
  }
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    throw new Error(`Invalid name for national park ${value.slug}.`);
  }
  if (typeof value.stateOrTerritory !== "string" || value.stateOrTerritory.trim().length === 0) {
    throw new Error(`Invalid state or territory for national park ${value.slug}.`);
  }
  if (typeof value.latitude !== "number" || !Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) {
    throw new Error(`Invalid latitude for national park ${value.slug}.`);
  }
  if (
    typeof value.longitude !== "number" ||
    !Number.isFinite(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180
  ) {
    throw new Error(`Invalid longitude for national park ${value.slug}.`);
  }
  if (typeof value.visited !== "boolean") {
    throw new Error(`Invalid visited status for national park ${value.slug}.`);
  }
  if (!Array.isArray(value.visits)) {
    throw new Error(`Invalid visits list for national park ${value.slug}.`);
  }
  if (!isHttpsUrl(value.sourceUrl, "www.nps.gov")) {
    throw new Error(`Invalid NPS source URL for national park ${value.slug}.`);
  }

  const expectedSourcePathPrefix = `/${value.npsCode.toLowerCase()}/`;
  if (!new URL(value.sourceUrl).pathname.startsWith(expectedSourcePathPrefix)) {
    throw new Error(`NPS source URL does not match the NPS code for national park ${value.slug}.`);
  }

  const visits = Object.freeze(value.visits.map((visit, visitIndex) => parseVisit(visit, value.slug as string, visitIndex)));
  if (value.visited !== (visits.length > 0)) {
    throw new Error(`Visited status and visits list disagree for national park ${value.slug}.`);
  }

  return Object.freeze({
    slug: value.slug,
    npsCode: value.npsCode,
    name: value.name,
    stateOrTerritory: value.stateOrTerritory,
    latitude: value.latitude,
    longitude: value.longitude,
    visited: value.visited,
    visits,
    sourceUrl: value.sourceUrl,
  });
}

function parseCatalog(value: unknown): NationalParksCatalog {
  if (!isRecord(value)) {
    throw new Error("Invalid national parks catalog: expected an object.");
  }

  const allowedKeys = ["$schema", "coordinateSourceUrl", "coordinateSourceNote", "parks"] as const;
  if (!hasOnlyKeys(value, allowedKeys)) {
    throw new Error("Invalid national parks catalog: unexpected property.");
  }
  if (!isHttpsUrl(value.coordinateSourceUrl, "services1.arcgis.com")) {
    throw new Error("Invalid national parks coordinate source URL.");
  }
  if (typeof value.coordinateSourceNote !== "string" || value.coordinateSourceNote.trim().length === 0) {
    throw new Error("Invalid national parks coordinate source note.");
  }
  if (!Array.isArray(value.parks) || value.parks.length !== EXPECTED_NATIONAL_PARK_COUNT) {
    throw new Error(`National parks catalog must contain exactly ${EXPECTED_NATIONAL_PARK_COUNT} parks.`);
  }

  const parks = Object.freeze(value.parks.map(parsePark));
  const slugs = new Set<string>();
  const npsCodes = new Set<string>();
  const names = new Set<string>();

  for (const park of parks) {
    if (slugs.has(park.slug)) throw new Error(`Duplicate national park slug: ${park.slug}.`);
    if (npsCodes.has(park.npsCode)) throw new Error(`Duplicate national park NPS code: ${park.npsCode}.`);
    if (names.has(park.name)) throw new Error(`Duplicate national park name: ${park.name}.`);
    slugs.add(park.slug);
    npsCodes.add(park.npsCode);
    names.add(park.name);
  }

  for (let index = 1; index < parks.length; index += 1) {
    if (parks[index - 1].name.localeCompare(parks[index].name, "en") >= 0) {
      throw new Error("National parks catalog must be sorted alphabetically by name.");
    }
  }

  return Object.freeze({
    coordinateSourceUrl: value.coordinateSourceUrl,
    coordinateSourceNote: value.coordinateSourceNote,
    parks,
  });
}

const catalog = parseCatalog(nationalParksJson as unknown);
const parksBySlug = new Map(catalog.parks.map((park) => [park.slug, park]));

export const nationalParkCoordinateSourceUrl = catalog.coordinateSourceUrl;
export const nationalParkCoordinateSourceNote = catalog.coordinateSourceNote;

export function getAllNationalParks(): readonly NationalPark[] {
  return catalog.parks;
}

export function getNationalPark(slug: string): NationalPark | null {
  if (!slugPattern.test(slug)) return null;
  return parksBySlug.get(slug) ?? null;
}
