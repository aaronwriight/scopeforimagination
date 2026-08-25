import { readFileSync } from "node:fs";
import { join } from "node:path";
import nationalParksJson from "../../content/venture/parks/national-parks.json";

const EXPECTED_NATIONAL_PARK_COUNT = 63;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const npsCodePattern = /^[A-Z]{4}$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export type NationalParkVisit = Readonly<{
  date: string | null;
  trip: string | null;
  fieldNote?: string;
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
  visitNumber: number | null;
  visits: readonly NationalParkVisit[];
  sourceUrl: string;
}>;

type NationalParksCatalog = Readonly<{
  coordinateSourceUrl: string;
  coordinateSourceNote: string;
  parks: readonly NationalPark[];
}>;

type Position = [number, number];
type PolygonCoordinates = Position[][];
type MultiPolygonCoordinates = Position[][][];

export type NationalParkBoundaryGeometry =
  | { type: "Polygon"; coordinates: PolygonCoordinates }
  | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates };

export type NationalParkBoundaryFeature = Readonly<{
  type: "Feature";
  id: string;
  geometry: NationalParkBoundaryGeometry;
  properties: Readonly<{
    id: string;
    npsCode: string;
    slug: string;
    title: string;
    href: string;
    location: string;
    sourceUrl: string;
    visited: boolean;
  }>;
}>;

type NationalParkBoundaryCollection = Readonly<{
  sourceUrl: string;
  sourceNote: string;
  features: readonly NationalParkBoundaryFeature[];
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

  const allowedKeys = ["date", "trip", "fieldNote", "entrySlug"] as const;
  if (!hasOnlyKeys(value, allowedKeys) || !("date" in value) || !("trip" in value)) {
    throw new Error(`Invalid national park visit at ${parkSlug}.visits[${index}]: date and trip are required.`);
  }

  if (value.date !== null && !isIsoDate(value.date)) {
    throw new Error(`Invalid national park visit date at ${parkSlug}.visits[${index}].date.`);
  }
  if (value.trip !== null && (typeof value.trip !== "string" || value.trip.trim().length === 0)) {
    throw new Error(`Invalid national park trip at ${parkSlug}.visits[${index}].trip.`);
  }
  if (
    value.fieldNote !== undefined &&
    (typeof value.fieldNote !== "string" || value.fieldNote.trim().length === 0)
  ) {
    throw new Error(`Invalid national park field note at ${parkSlug}.visits[${index}].fieldNote.`);
  }
  if (value.entrySlug !== undefined && (typeof value.entrySlug !== "string" || !slugPattern.test(value.entrySlug))) {
    throw new Error(`Invalid national park entry slug at ${parkSlug}.visits[${index}].entrySlug.`);
  }

  return Object.freeze({
    date: value.date,
    trip: value.trip,
    ...(value.fieldNote === undefined ? {} : { fieldNote: value.fieldNote }),
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
    "visitNumber",
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
  if (
    value.visitNumber !== null &&
    (typeof value.visitNumber !== "number" ||
      !Number.isInteger(value.visitNumber) ||
      value.visitNumber < 1 ||
      value.visitNumber > EXPECTED_NATIONAL_PARK_COUNT)
  ) {
    throw new Error(`Invalid visit number for national park ${value.slug}.`);
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
  if (!value.visited && value.visitNumber !== null) {
    throw new Error(`Unvisited national park ${value.slug} cannot have a visit number.`);
  }

  return Object.freeze({
    slug: value.slug,
    npsCode: value.npsCode,
    name: value.name,
    stateOrTerritory: value.stateOrTerritory,
    latitude: value.latitude,
    longitude: value.longitude,
    visited: value.visited,
    visitNumber: value.visitNumber,
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
  const visitNumbers = new Set<number>();

  for (const park of parks) {
    if (slugs.has(park.slug)) throw new Error(`Duplicate national park slug: ${park.slug}.`);
    if (npsCodes.has(park.npsCode)) throw new Error(`Duplicate national park NPS code: ${park.npsCode}.`);
    if (names.has(park.name)) throw new Error(`Duplicate national park name: ${park.name}.`);
    if (park.visitNumber !== null && visitNumbers.has(park.visitNumber)) {
      throw new Error(`Duplicate national park visit number: ${park.visitNumber}.`);
    }
    slugs.add(park.slug);
    npsCodes.add(park.npsCode);
    names.add(park.name);
    if (park.visitNumber !== null) visitNumbers.add(park.visitNumber);
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

function parsePosition(value: unknown, context: string): Position {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    !Number.isFinite(value[0]) ||
    value[0] < -180 ||
    value[0] > 180 ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[1]) ||
    value[1] < -90 ||
    value[1] > 90
  ) {
    throw new Error(`Invalid national park boundary position at ${context}.`);
  }

  return [value[0], value[1]];
}

function parseLinearRing(value: unknown, context: string): Position[] {
  if (!Array.isArray(value) || value.length < 4) {
    throw new Error(`Invalid national park boundary ring at ${context}.`);
  }

  const ring = value.map((position, index) => parsePosition(position, `${context}[${index}]`));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new Error(`National park boundary ring is not closed at ${context}.`);
  }
  return ring;
}

function parsePolygonCoordinates(value: unknown, context: string): PolygonCoordinates {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid national park boundary polygon at ${context}.`);
  }
  return value.map((ring, index) => parseLinearRing(ring, `${context}[${index}]`));
}

function parseBoundaryGeometry(value: unknown, context: string): NationalParkBoundaryGeometry {
  if (!isRecord(value) || !hasOnlyKeys(value, ["type", "coordinates"])) {
    throw new Error(`Invalid national park boundary geometry at ${context}.`);
  }

  if (value.type === "Polygon") {
    return { type: "Polygon", coordinates: parsePolygonCoordinates(value.coordinates, `${context}.coordinates`) };
  }

  if (value.type === "MultiPolygon") {
    if (!Array.isArray(value.coordinates) || value.coordinates.length === 0) {
      throw new Error(`Invalid national park multipolygon at ${context}.coordinates.`);
    }
    return {
      type: "MultiPolygon",
      coordinates: value.coordinates.map((polygon, index) =>
        parsePolygonCoordinates(polygon, `${context}.coordinates[${index}]`),
      ),
    };
  }

  throw new Error(`Unsupported national park boundary geometry at ${context}.`);
}

export function formatNationalParkName(name: string): string {
  if (name.startsWith("National Park of ")) return name.slice("National Park of ".length);
  return name.replace(/ National Park(?: and Preserve)?$/, "");
}

function parseBoundaryCollection(
  value: unknown,
  parksByNpsCode: ReadonlyMap<string, NationalPark>,
): NationalParkBoundaryCollection {
  if (!isRecord(value) || !hasOnlyKeys(value, ["type", "sourceUrl", "sourceNote", "features"])) {
    throw new Error("Invalid national park boundary collection.");
  }
  if (value.type !== "FeatureCollection") {
    throw new Error("Invalid national park boundary collection type.");
  }
  if (!isHttpsUrl(value.sourceUrl, "services1.arcgis.com") || !new URL(value.sourceUrl).pathname.endsWith("/2")) {
    throw new Error("Invalid national park boundary source URL.");
  }
  if (typeof value.sourceNote !== "string" || value.sourceNote.trim().length === 0) {
    throw new Error("Invalid national park boundary source note.");
  }
  if (!Array.isArray(value.features) || value.features.length === 0) {
    throw new Error("National park boundary collection must contain features.");
  }

  const seenCodes = new Set<string>();
  const features = value.features.map((featureValue, index): NationalParkBoundaryFeature => {
    if (!isRecord(featureValue) || !hasOnlyKeys(featureValue, ["type", "geometry", "properties"])) {
      throw new Error(`Invalid national park boundary at features[${index}].`);
    }
    if (featureValue.type !== "Feature" || !isRecord(featureValue.properties)) {
      throw new Error(`Invalid national park boundary feature at features[${index}].`);
    }
    if (!hasOnlyKeys(featureValue.properties, ["npsCode", "name", "status"])) {
      throw new Error(`Invalid national park boundary properties at features[${index}].`);
    }

    const { npsCode, name, status } = featureValue.properties;
    if (typeof npsCode !== "string" || !npsCodePattern.test(npsCode) || seenCodes.has(npsCode)) {
      throw new Error(`Invalid or duplicate NPS code at boundary features[${index}].`);
    }
    const park = parksByNpsCode.get(npsCode);
    if (!park || name !== park.name || (status !== "Official" && status !== "Legacy")) {
      throw new Error(`National park boundary does not match the parks catalog at features[${index}].`);
    }
    seenCodes.add(npsCode);

    return Object.freeze({
      type: "Feature",
      id: park.slug,
      geometry: parseBoundaryGeometry(featureValue.geometry, `features[${index}].geometry`),
      properties: Object.freeze({
        id: park.slug,
        npsCode: park.npsCode,
        slug: park.slug,
        title: formatNationalParkName(park.name),
        href: `/venture/parks/${park.slug}`,
        location: park.stateOrTerritory,
        sourceUrl: park.sourceUrl,
        visited: park.visited,
      }),
    });
  });

  const parkCodes = [...parksByNpsCode.keys()];
  if (parkCodes.length !== seenCodes.size || parkCodes.some((npsCode) => !seenCodes.has(npsCode))) {
    throw new Error("National park boundary collection must cover all 63 parks exactly once.");
  }

  return Object.freeze({
    sourceUrl: value.sourceUrl,
    sourceNote: value.sourceNote,
    features: Object.freeze(features),
  });
}

const catalog = parseCatalog(nationalParksJson as unknown);
const parksBySlug = new Map(catalog.parks.map((park) => [park.slug, park]));
const parksByNpsCode = new Map(catalog.parks.map((park) => [park.npsCode, park]));
let boundaryCollectionCache: NationalParkBoundaryCollection | null = null;

function getBoundaryCollection(): NationalParkBoundaryCollection {
  if (boundaryCollectionCache) return boundaryCollectionCache;

  const boundaryPath = join(
    process.cwd(),
    "content",
    "venture",
    "parks",
    "visited-national-park-boundaries.json",
  );
  const boundaryJson = JSON.parse(readFileSync(boundaryPath, "utf8")) as unknown;
  boundaryCollectionCache = parseBoundaryCollection(boundaryJson, parksByNpsCode);
  return boundaryCollectionCache;
}

export const nationalParkCoordinateSourceUrl = catalog.coordinateSourceUrl;
export const nationalParkCoordinateSourceNote = catalog.coordinateSourceNote;
export const nationalParkBoundarySourceUrl =
  "https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2";
export const nationalParkBoundarySourceNote =
  "National Park Service boundary polygons for all 63 national parks, simplified to 0.025 degrees for offline web display. The source currently marks Acadia and New River Gorge as Legacy; the remaining 61 park records are Official.";

export function getNationalParkBoundaries(): readonly NationalParkBoundaryFeature[] {
  return getBoundaryCollection().features;
}

export function getVisitedNationalParkBoundaries(): readonly NationalParkBoundaryFeature[] {
  return Object.freeze(
    getBoundaryCollection().features.filter((boundary) => boundary.properties.visited),
  );
}

export function getAllNationalParks(): readonly NationalPark[] {
  return catalog.parks;
}

export function getNationalPark(slug: string): NationalPark | null {
  if (!slugPattern.test(slug)) return null;
  return parksBySlug.get(slug) ?? null;
}

export function getNationalParkStates(park: NationalPark): readonly string[] {
  return park.stateOrTerritory
    .replace(/,\s+and\s+/g, ", ")
    .replace(/\s+and\s+/g, ", ")
    .split(",")
    .map((state) => state.trim())
    .filter(Boolean);
}
