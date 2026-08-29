"use client";

import { useId, useMemo, useState } from "react";
import {
  ListBatchSizeControl,
  ProgressiveRevealControl,
  type ListBatchSize,
} from "@/components/site/progressive-list-controls";
import { SfiPostHeader, type SfiPostHeaderData } from "@/components/site/sfi-post-header";
import { formatSfiMonth } from "@/lib/sfi-post-display";

export type SfiPostListItem = SfiPostHeaderData & {
  excerpt?: string;
};

function comparePostsNewest(first: SfiPostListItem, second: SfiPostListItem): number {
  const chronology = `${second.date}T${second.time}`.localeCompare(`${first.date}T${first.time}`);
  return chronology !== 0 ? chronology : second.entry.localeCompare(first.entry);
}

function PostRows({ posts }: { posts: readonly SfiPostListItem[] }) {
  return (
    <div className="border-t border-stone-300 dark:border-stone-700">
      {posts.map((post) => (
        <article
          key={post.entry}
          className="grid gap-x-10 gap-y-4 border-b border-stone-300 py-6 dark:border-stone-700 lg:grid-cols-[minmax(0,1.1fr)_minmax(15rem,0.9fr)] lg:items-end"
        >
          <SfiPostHeader post={post} href={`/scope-for-imagination/${post.entry}`} />
          {post.excerpt ? (
            <p className="m-0 max-w-sm font-serif text-xs italic leading-5 text-stone-450 lg:justify-self-end">
              {post.excerpt}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function MonthGroups({ posts }: { posts: readonly SfiPostListItem[] }) {
  const months = [...new Set(posts.map((post) => post.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-10">
      {months.map((month) => {
        const monthPosts = posts.filter((post) => post.date.startsWith(month));
        return (
          <section key={month}>
            <h3 className="mb-4 font-serif text-xs font-normal lowercase tracking-widest text-stone-500">
              {formatSfiMonth(monthPosts[0].date)}
            </h3>
            <PostRows posts={monthPosts} />
          </section>
        );
      })}
    </div>
  );
}

function GroupedPosts({ posts, groupByYear }: { posts: readonly SfiPostListItem[]; groupByYear: boolean }) {
  if (!groupByYear) return <MonthGroups posts={posts} />;

  const years = [...new Set(posts.map((post) => post.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-16">
      {years.map((year) => {
        const yearPosts = posts.filter((post) => post.date.startsWith(year));
        return (
          <section key={year}>
            <h2 className="mb-6 font-serif text-sm font-normal tracking-widest text-stone-500">{year}</h2>
            <MonthGroups posts={yearPosts} />
          </section>
        );
      })}
    </div>
  );
}

export function SfiPostListClient({
  posts,
  groupByYear,
}: {
  posts: readonly SfiPostListItem[];
  groupByYear: boolean;
}) {
  const [batchSize, setBatchSize] = useState<ListBatchSize>(5);
  const [visibleCount, setVisibleCount] = useState(5);
  const regionId = useId();
  const sortedPosts = useMemo(() => [...posts].sort(comparePostsNewest), [posts]);

  if (sortedPosts.length === 0) {
    return <p className="border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">No entries yet.</p>;
  }

  const shownCount = Math.min(visibleCount, sortedPosts.length);
  const visiblePosts = sortedPosts.slice(0, shownCount);
  const hasProgressiveControls = sortedPosts.length > 5;

  const changeBatchSize = (nextBatchSize: ListBatchSize) => {
    setBatchSize(nextBatchSize);
    setVisibleCount(nextBatchSize);
  };

  return (
    <div>
      {hasProgressiveControls ? (
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <ListBatchSizeControl value={batchSize} onChange={changeBatchSize} label="show posts at a time" />
          <p className="m-0 text-xs text-stone-450">
            {sortedPosts.length} {sortedPosts.length === 1 ? "entry" : "entries"}
          </p>
        </div>
      ) : null}

      <div id={regionId}>
        <GroupedPosts posts={visiblePosts} groupByYear={groupByYear} />
      </div>

      {sortedPosts.length > batchSize ? (
        <ProgressiveRevealControl
          visibleCount={shownCount}
          totalCount={sortedPosts.length}
          batchSize={batchSize}
          regionId={regionId}
          singularLabel="entry"
          pluralLabel="entries"
          onShowMore={() => setVisibleCount((current) => Math.min(current + batchSize, sortedPosts.length))}
        />
      ) : null}
    </div>
  );
}
