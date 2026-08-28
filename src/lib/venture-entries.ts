import { promises as fs } from "node:fs";
import path from "node:path";
import type { MusicCredit } from "@/lib/music-credit";
import { isMusicCredit } from "@/lib/music-credit";

export type VentureEntry = {
  title: string;
  subtitle: string;
  slug: string;
  entry: string;
  date: string;
  time: string;
  trip: string | null;
  thread: string | null;
  location: string;
  latitude: number;
  longitude: number;
  excerpt: string;
  music?: MusicCredit | null;
  tags: string[];
  blog: "venture";
  collections: string[];
  status: "published";
  bodyHtml: string;
};

const entriesDirectory = path.join(process.cwd(), "content", "venture", "entries");
const reservedVentureSlugs = new Set(["about", "index", "parks", "trails", "travels"]);

function isVentureEntry(value: unknown): value is VentureEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Partial<VentureEntry>;
  return (
    typeof entry.title === "string" &&
    entry.title.trim().length > 0 &&
    typeof entry.subtitle === "string" &&
    entry.subtitle.trim().length > 0 &&
    typeof entry.slug === "string" &&
    /^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*-\d{8}$/.test(entry.slug) &&
    !reservedVentureSlugs.has(entry.slug) &&
    typeof entry.entry === "string" &&
    /^\d{4}$/.test(entry.entry) &&
    typeof entry.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    typeof entry.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time) &&
    (entry.trip === null || (typeof entry.trip === "string" && entry.trip.trim().length > 0)) &&
    (entry.thread === null || (typeof entry.thread === "string" && entry.thread.trim().length > 0)) &&
    typeof entry.location === "string" &&
    entry.location.trim().length > 0 &&
    typeof entry.latitude === "number" &&
    entry.latitude >= -90 &&
    entry.latitude <= 90 &&
    typeof entry.longitude === "number" &&
    entry.longitude >= -180 &&
    entry.longitude <= 180 &&
    typeof entry.excerpt === "string" &&
    entry.excerpt.trim().length > 0 &&
    (entry.music === undefined || entry.music === null || isMusicCredit(entry.music)) &&
    Array.isArray(entry.tags) &&
    entry.tags.includes("venture") &&
    entry.tags.every((tag) => typeof tag === "string" && tag.trim().length > 0) &&
    new Set(entry.tags).size === entry.tags.length &&
    entry.blog === "venture" &&
    Array.isArray(entry.collections) &&
    entry.collections.every(
      (collection) => typeof collection === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collection),
    ) &&
    new Set(entry.collections).size === entry.collections.length &&
    entry.status === "published" &&
    typeof entry.bodyHtml === "string" &&
    entry.bodyHtml.trim().length > 0
  );
}

async function readEntryFile(fileName: string): Promise<VentureEntry | null> {
  try {
    const contents = await fs.readFile(path.join(entriesDirectory, fileName), "utf8");
    const entry: unknown = JSON.parse(contents);
    return isVentureEntry(entry) && entry.slug === path.parse(fileName).name ? entry : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function getAllVentureEntries(): Promise<VentureEntry[]> {
  let fileNames: string[];

  try {
    fileNames = await fs.readdir(entriesDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const entries = await Promise.all(
    fileNames.filter((fileName) => fileName.endsWith(".json")).map((fileName) => readEntryFile(fileName)),
  );

  return entries
    .filter((entry): entry is VentureEntry => entry !== null)
    .sort((a, b) => {
      const chronology = `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`);
      return chronology !== 0 ? chronology : b.entry.localeCompare(a.entry);
    });
}

export async function getVentureEntry(slug: string): Promise<VentureEntry | null> {
  if (!/^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*-\d{8}$/.test(slug) || reservedVentureSlugs.has(slug)) return null;
  const entries = await getAllVentureEntries();
  return entries.find((entry) => entry.slug === slug) || null;
}

export function formatVentureDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatVentureHeaderDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${Number(month)}.${Number(day)}.${year.slice(-2)}`;
}
