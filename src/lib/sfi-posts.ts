import { promises as fs } from "node:fs";
import path from "node:path";
import type { MusicCredit } from "@/lib/music-credit";
import { isMusicCredit } from "@/lib/music-credit";

export type SfiPortableTextBlock = Record<string, unknown> & { _type: string };
export type SfiBlog = "sfi" | "venture";
export type SfiPostStatus = "published";

export type SfiPost = {
  title: string;
  subtitle: string;
  slug?: string;
  date: string;
  time: string;
  location: string;
  entry: string;
  trip?: string | null;
  thread?: string | null;
  music?: MusicCredit | null;
  tags: string[];
  blog?: SfiBlog;
  collections?: string[];
  latitude?: number | null;
  longitude?: number | null;
  status?: SfiPostStatus;
  bodyHtml?: string;
  body?: SfiPortableTextBlock[];
  excerpt?: string;
  source?: "sanity" | "local";
};

const postsDirectory = path.join(process.cwd(), "content", "scope-for-imagination", "posts");

type SanityScopePost = {
  title?: string;
  subtitle?: string;
  slug?: { current?: string };
  entry?: string;
  publishedAt?: string;
  location?: string;
  trip?: string | null;
  thread?: string | null;
  music?: unknown;
  tags?: string[];
  blog?: SfiBlog;
  collections?: string[];
  latitude?: number | null;
  longitude?: number | null;
  status?: SfiPostStatus;
  body?: SfiPortableTextBlock[];
  bodyHtml?: string;
  excerpt?: string;
};

function isSfiPost(value: unknown): value is SfiPost {
  if (!value || typeof value !== "object") return false;

  const post = value as Partial<SfiPost>;
  return (
    typeof post.title === "string" &&
    post.title.trim().length > 0 &&
    typeof post.subtitle === "string" &&
    post.subtitle.trim().length > 0 &&
    typeof post.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(post.date) &&
    typeof post.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(post.time) &&
    typeof post.location === "string" &&
    post.location.trim().length > 0 &&
    typeof post.entry === "string" &&
    /^\d{4}$/.test(post.entry) &&
    (post.slug === undefined || /^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*-\d{8}$/.test(post.slug)) &&
    (post.excerpt === undefined || (typeof post.excerpt === "string" && post.excerpt.trim().length > 0)) &&
    (post.trip === undefined || post.trip === null || (typeof post.trip === "string" && post.trip.trim().length > 0)) &&
    (post.thread === undefined ||
      post.thread === null ||
      (typeof post.thread === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.thread))) &&
    (post.music === undefined || post.music === null || isMusicCredit(post.music)) &&
    Array.isArray(post.tags) &&
    post.tags.every((tag) => typeof tag === "string" && tag.trim().length > 0) &&
    new Set(post.tags).size === post.tags.length &&
    (post.blog === undefined || post.blog === "sfi" || post.blog === "venture") &&
    (post.collections === undefined ||
      (Array.isArray(post.collections) &&
        post.collections.every(
          (collection) => typeof collection === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collection),
        ) &&
        new Set(post.collections).size === post.collections.length)) &&
    (post.latitude === undefined ||
      post.latitude === null ||
      (typeof post.latitude === "number" && post.latitude >= -90 && post.latitude <= 90)) &&
    (post.longitude === undefined ||
      post.longitude === null ||
      (typeof post.longitude === "number" && post.longitude >= -180 && post.longitude <= 180)) &&
    (post.status === undefined || post.status === "published") &&
    typeof post.bodyHtml === "string" &&
    post.bodyHtml.trim().length > 0
  );
}

async function readPostFile(fileName: string): Promise<SfiPost | null> {
  try {
    const contents = await fs.readFile(path.join(postsDirectory, fileName), "utf8");
    const post: unknown = JSON.parse(contents);
    return isSfiPost(post) && post.entry === path.parse(fileName).name ? { ...post, source: "local" } : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function sanityPostToSfiPost(post: SanityScopePost): SfiPost | null {
  const hasPortableBody = Array.isArray(post.body) && post.body.length > 0;
  const bodyHtml = typeof post.bodyHtml === "string" && post.bodyHtml.trim() ? post.bodyHtml : undefined;

  if (!post.entry || !/^\d{4}$/.test(post.entry) || !post.publishedAt || !post.subtitle || (!hasPortableBody && !bodyHtml)) {
    return null;
  }

  const [date, timeWithZone = "00:00"] = post.publishedAt.split("T");
  const time = timeWithZone.slice(0, 5);
  const music = isMusicCredit(post.music) ? post.music : undefined;

  return {
    title: post.title || "scope for imagination",
    subtitle: post.subtitle,
    slug: post.slug?.current || post.entry,
    date,
    time,
    location: post.location || "Cambridge, MA",
    entry: post.entry,
    trip: post.trip ?? null,
    thread: post.thread ?? null,
    ...(music ? { music } : {}),
    tags: Array.isArray(post.tags) ? post.tags.filter((tag): tag is string => typeof tag === "string") : [],
    blog: post.blog === "venture" ? "venture" : "sfi",
    collections: Array.isArray(post.collections)
      ? post.collections.filter((collection): collection is string => typeof collection === "string")
      : [],
    latitude: typeof post.latitude === "number" ? post.latitude : null,
    longitude: typeof post.longitude === "number" ? post.longitude : null,
    status: "published",
    body: hasPortableBody ? post.body : undefined,
    bodyHtml,
    excerpt: post.excerpt,
    source: "sanity",
  };
}

async function getLocalSfiPosts(): Promise<SfiPost[]> {
  let fileNames: string[];

  try {
    fileNames = await fs.readdir(postsDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const posts = await Promise.all(
    fileNames.filter((fileName) => fileName.endsWith(".json")).map((fileName) => readPostFile(fileName)),
  );

  return posts.filter((post): post is SfiPost => post !== null).sort((a, b) => b.date.localeCompare(a.date));
}

async function getSanitySfiPosts(): Promise<SfiPost[]> {
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || !process.env.NEXT_PUBLIC_SANITY_DATASET) {
    return [];
  }

  try {
    const { client } = await import("@/sanity/lib/client");
    const posts = await client.fetch<SanityScopePost[]>(
      `*[_type == "scopePost" && status == "published"] | order(publishedAt desc) {
        title,
        subtitle,
        slug,
        entry,
        publishedAt,
        location,
        trip,
        thread,
        music { title, album, artist, url },
        tags,
        blog,
        collections,
        latitude,
        longitude,
        status,
        excerpt,
        body,
        bodyHtml
      }`,
      {},
      { next: { revalidate: 60 } },
    );

    return posts.map(sanityPostToSfiPost).filter((post): post is SfiPost => post !== null);
  } catch (error) {
    console.error("Failed to load Scope for Imagination posts from Sanity", error);
    return [];
  }
}

export async function getAllSfiPosts(): Promise<SfiPost[]> {
  const [localPosts, sanityPosts] = await Promise.all([getLocalSfiPosts(), getSanitySfiPosts()]);
  const postsByEntry = new Map<string, SfiPost>();

  for (const post of sanityPosts) postsByEntry.set(post.entry, post);
  for (const post of localPosts) postsByEntry.set(post.entry, post);

  return [...postsByEntry.values()].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}

export async function getSfiPost(entry: string): Promise<SfiPost | null> {
  if (!/^\d{4}$/.test(entry)) return null;
  const posts = await getAllSfiPosts();
  return posts.find((post) => post.entry === entry) || null;
}

export function getSfiYears(posts: SfiPost[]): number[] {
  return [...new Set(posts.map((post) => Number(post.date.slice(0, 4))))].filter(Number.isFinite).sort((a, b) => b - a);
}

export function formatSfiDate(date: string, includeYear = true): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  });
}

export function formatSfiHeaderDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${Number(month)}.${Number(day)}.${year.slice(-2)}`;
}

export function formatSfiMonth(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "long" });
}

export function formatSfiPostTitle(post: Pick<SfiPost, "title" | "subtitle">): string {
  return post.subtitle ? `${post.title}: ${post.subtitle}` : post.title;
}

const tagColors: Record<string, string> = {
  sfi: "#cb4b16",
  venture: "#586e75",
};

export function getSfiTagColor(tag: string): string {
  const normalizedTag = tag.trim().toLowerCase();
  return tagColors[normalizedTag] ?? "#859900";
}
