import travelsJson from "../../content/venture/travels/travels.json";

const EXPECTED_DESTINATION_COUNT = 3;
const EXPECTED_DESTINATION_ORDER = ["iceland", "turkiye", "cambodia"] as const;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export type TravelVisit = Readonly<{
  ordinal: number;
  date: string | null;
  trip: string | null;
  entrySlug?: string;
}>;

export type TravelDestination = Readonly<{
  slug: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  visits: readonly TravelVisit[];
}>;

type TravelsCatalog = Readonly<{
  destinations: readonly TravelDestination[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !isoDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function parseVisit(value: unknown, destinationSlug: string, index: number): TravelVisit {
  if (!isRecord(value)) {
    throw new Error(`Invalid travel visit at ${destinationSlug}.visits[${index}]: expected an object.`);
  }

  const allowedKeys = ["ordinal", "date", "trip", "entrySlug"] as const;
  if (!hasOnlyKeys(value, allowedKeys)) {
    throw new Error(`Invalid travel visit at ${destinationSlug}.visits[${index}]: unexpected property.`);
  }
  if (!Number.isInteger(value.ordinal) || value.ordinal !== index + 1) {
    throw new Error(`Invalid travel visit ordinal at ${destinationSlug}.visits[${index}].`);
  }
  if (value.date !== null && !isIsoDate(value.date)) {
    throw new Error(`Invalid travel visit date at ${destinationSlug}.visits[${index}].`);
  }
  if (value.trip !== null && (typeof value.trip !== "string" || value.trip.trim().length === 0)) {
    throw new Error(`Invalid travel trip at ${destinationSlug}.visits[${index}].trip.`);
  }
  if (value.entrySlug !== undefined && (typeof value.entrySlug !== "string" || !slugPattern.test(value.entrySlug))) {
    throw new Error(`Invalid travel entry slug at ${destinationSlug}.visits[${index}].entrySlug.`);
  }

  return Object.freeze({
    ordinal: value.ordinal as number,
    date: value.date as string | null,
    trip: value.trip as string | null,
    ...(value.entrySlug === undefined ? {} : { entrySlug: value.entrySlug }),
  });
}

function parseDestination(value: unknown, index: number): TravelDestination {
  if (!isRecord(value)) {
    throw new Error(`Invalid travel destination at destinations[${index}]: expected an object.`);
  }

  const allowedKeys = ["slug", "name", "region", "latitude", "longitude", "visits"] as const;
  if (!hasOnlyKeys(value, allowedKeys)) {
    throw new Error(`Invalid travel destination at destinations[${index}]: unexpected property.`);
  }
  if (typeof value.slug !== "string" || !slugPattern.test(value.slug)) {
    throw new Error(`Invalid travel destination slug at destinations[${index}].slug.`);
  }
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    throw new Error(`Invalid travel destination name for ${value.slug}.`);
  }
  if (typeof value.region !== "string" || value.region.trim().length === 0) {
    throw new Error(`Invalid travel destination region for ${value.slug}.`);
  }
  if (typeof value.latitude !== "number" || !Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) {
    throw new Error(`Invalid latitude for travel destination ${value.slug}.`);
  }
  if (
    typeof value.longitude !== "number" ||
    !Number.isFinite(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180
  ) {
    throw new Error(`Invalid longitude for travel destination ${value.slug}.`);
  }
  if (!Array.isArray(value.visits) || value.visits.length === 0) {
    throw new Error(`Invalid visits list for travel destination ${value.slug}.`);
  }

  return Object.freeze({
    slug: value.slug,
    name: value.name,
    region: value.region,
    latitude: value.latitude,
    longitude: value.longitude,
    visits: Object.freeze(value.visits.map((visit, visitIndex) => parseVisit(visit, value.slug as string, visitIndex))),
  });
}

function parseCatalog(value: unknown): TravelsCatalog {
  if (!isRecord(value)) {
    throw new Error("Invalid travels catalog: expected an object.");
  }

  const allowedKeys = ["$schema", "destinations"] as const;
  if (!hasOnlyKeys(value, allowedKeys)) {
    throw new Error("Invalid travels catalog: unexpected property.");
  }
  if (!Array.isArray(value.destinations) || value.destinations.length !== EXPECTED_DESTINATION_COUNT) {
    throw new Error(`Travels catalog must contain exactly ${EXPECTED_DESTINATION_COUNT} destinations.`);
  }

  const destinations = Object.freeze(value.destinations.map(parseDestination));
  const slugs = new Set<string>();
  const names = new Set<string>();

  for (const destination of destinations) {
    if (slugs.has(destination.slug)) throw new Error(`Duplicate travel destination slug: ${destination.slug}.`);
    if (names.has(destination.name)) throw new Error(`Duplicate travel destination name: ${destination.name}.`);
    slugs.add(destination.slug);
    names.add(destination.name);
  }

  for (let index = 0; index < destinations.length; index += 1) {
    if (destinations[index].slug !== EXPECTED_DESTINATION_ORDER[index]) {
      throw new Error(
        `Travel destinations must follow the editorial order: ${EXPECTED_DESTINATION_ORDER.join(" → ")}.`,
      );
    }
  }

  return Object.freeze({ destinations });
}

const catalog = parseCatalog(travelsJson as unknown);
const destinationsBySlug = new Map(catalog.destinations.map((destination) => [destination.slug, destination]));

export function getAllTravelDestinations(): readonly TravelDestination[] {
  return catalog.destinations;
}

export function getTravelDestination(slug: string): TravelDestination | null {
  if (!slugPattern.test(slug)) return null;
  return destinationsBySlug.get(slug) ?? null;
}
