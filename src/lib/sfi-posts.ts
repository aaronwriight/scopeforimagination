import { promises as fs } from "node:fs";
import path from "node:path";

export type SfiPortableTextBlock = Record<string, unknown> & { _type: string };

export type SfiPost = {
  title: string;
  subtitle: string;
  date: string;
  time: string;
  location: string;
  entry: string;
  tags: string[];
  bodyHtml?: string;
  body?: SfiPortableTextBlock[];
  excerpt?: string;
  source?: "sanity" | "local";
};

const postsDirectory = path.join(process.cwd(), "content", "scope-for-imagination", "posts");

type SanityScopePost = {
  title?: string;
  subtitle?: string;
  entry?: string;
  publishedAt?: string;
  location?: string;
  tags?: string[];
  body?: SfiPortableTextBlock[];
  bodyHtml?: string;
  excerpt?: string;
};

function isSfiPost(value: unknown): value is SfiPost {
  if (!value || typeof value !== "object") return false;

  const post = value as Partial<SfiPost>;
  return (
    typeof post.title === "string" &&
    typeof post.subtitle === "string" &&
    typeof post.date === "string" &&
    typeof post.time === "string" &&
    typeof post.location === "string" &&
    typeof post.entry === "string" &&
    Array.isArray(post.tags) &&
    post.tags.every((tag) => typeof tag === "string") &&
    typeof post.bodyHtml === "string"
  );
}

async function readPostFile(fileName: string): Promise<SfiPost | null> {
  try {
    const contents = await fs.readFile(path.join(postsDirectory, fileName), "utf8");
    const post: unknown = JSON.parse(contents);
    return isSfiPost(post) ? { ...post, source: "local" } : null;
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

  return {
    title: post.title || "scope for imagination",
    subtitle: post.subtitle,
    date,
    time,
    location: post.location || "Cambridge, MA",
    entry: post.entry,
    tags: Array.isArray(post.tags) ? post.tags.filter((tag): tag is string => typeof tag === "string") : [],
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
        entry,
        publishedAt,
        location,
        tags,
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
  musings: "#859900",
  thoughts: "#859900",
  "cognitive science": "#2aa198",
  science: "#2aa198",
  photography: "#d33682",
  travel: "#268bd2",
  faith: "#6c71c4",
  adventure: "#cb4b16",
  venture: "#cb4b16",
  "life update": "#b58900",
};

const fallbackTagColors = ["#859900", "#2aa198", "#d33682", "#268bd2", "#6c71c4", "#cb4b16", "#b58900", "#dc322f"];

export function getSfiTagColor(tag: string): string {
  const normalizedTag = tag.trim().toLowerCase();
  if (tagColors[normalizedTag]) return tagColors[normalizedTag];

  const hash = [...normalizedTag].reduce((total, character) => total + character.charCodeAt(0), 0);
  return fallbackTagColors[hash % fallbackTagColors.length];
}
