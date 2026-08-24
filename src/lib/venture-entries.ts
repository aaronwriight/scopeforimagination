import { promises as fs } from "node:fs";
import path from "node:path";
import type { MusicCredit } from "@/lib/music-credit";
import { isMusicCredit } from "@/lib/music-credit";

export const ventureCollections = ["northeast-115", "national-parks", "travels"] as const;
export type VentureCollection = (typeof ventureCollections)[number];

export type VentureEntry = {
  title: string;
  slug: string;
  date: string;
  location: string;
  latitude: number;
  longitude: number;
  excerpt: string;
  music?: MusicCredit;
  tags: string[];
  collections: VentureCollection[];
  bodyHtml: string;
};

const entriesDirectory = path.join(process.cwd(), "content", "venture", "entries");
const reservedVentureSlugs = new Set(["about", "index", "parks", "trails", "travels"]);

function isVentureEntry(value: unknown): value is VentureEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Partial<VentureEntry>;
  return (
    typeof entry.title === "string" &&
    typeof entry.slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) &&
    !reservedVentureSlugs.has(entry.slug) &&
    typeof entry.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    typeof entry.location === "string" &&
    typeof entry.latitude === "number" &&
    entry.latitude >= -90 &&
    entry.latitude <= 90 &&
    typeof entry.longitude === "number" &&
    entry.longitude >= -180 &&
    entry.longitude <= 180 &&
    typeof entry.excerpt === "string" &&
    (entry.music === undefined || isMusicCredit(entry.music)) &&
    Array.isArray(entry.tags) &&
    entry.tags.includes("venture") &&
    entry.tags.every((tag) => typeof tag === "string") &&
    Array.isArray(entry.collections) &&
    entry.collections.every((collection) => ventureCollections.includes(collection)) &&
    typeof entry.bodyHtml === "string"
  );
}

async function readEntryFile(fileName: string): Promise<VentureEntry | null> {
  try {
    const contents = await fs.readFile(path.join(entriesDirectory, fileName), "utf8");
    const entry: unknown = JSON.parse(contents);
    return isVentureEntry(entry) ? entry : null;
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

  return entries.filter((entry): entry is VentureEntry => entry !== null).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getVentureEntry(slug: string): Promise<VentureEntry | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || reservedVentureSlugs.has(slug)) return null;
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
