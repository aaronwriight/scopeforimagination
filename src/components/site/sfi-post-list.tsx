import type { SfiPost } from "@/lib/sfi-posts";
import { SfiPostListClient, type SfiPostListItem } from "@/components/site/sfi-post-list-client";

export function SfiPostList({ posts, groupByYear = true }: { posts: SfiPost[]; groupByYear?: boolean }) {
  const listItems: SfiPostListItem[] = posts.map((post) => ({
    title: post.title,
    subtitle: post.subtitle,
    date: post.date,
    time: post.time,
    location: post.location,
    entry: post.entry,
    music: post.music,
    tags: post.tags,
    excerpt: post.excerpt,
  }));

  return <SfiPostListClient posts={listItems} groupByYear={groupByYear} />;
}
