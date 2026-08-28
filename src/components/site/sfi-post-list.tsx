import type { SfiPost } from "@/lib/sfi-posts";
import { formatSfiMonth, getSfiYears } from "@/lib/sfi-posts";
import { SfiPostHeader } from "@/components/site/sfi-post-header";

function comparePostsNewest(first: SfiPost, second: SfiPost): number {
  const chronology = `${second.date}T${second.time}`.localeCompare(`${first.date}T${first.time}`);
  return chronology !== 0 ? chronology : second.entry.localeCompare(first.entry);
}

function PostRows({ posts }: { posts: SfiPost[] }) {
  if (posts.length === 0) {
    return <p className="border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">No entries yet.</p>;
  }

  return (
    <div className="border-t border-stone-300 dark:border-stone-700">
      {[...posts].sort(comparePostsNewest).map((post) => (
        <article
          key={post.entry}
          className="grid gap-x-10 gap-y-4 border-b border-stone-300 py-6 dark:border-stone-700 lg:grid-cols-[minmax(0,1.1fr)_minmax(15rem,0.9fr)] lg:items-end"
        >
          <SfiPostHeader post={post} href={`/scope-for-imagination/${post.entry}`} />
          {post.excerpt && (
            <p className="m-0 max-w-sm font-serif text-xs italic leading-5 text-stone-450 dark:text-stone-400 lg:justify-self-end">
              {post.excerpt}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function MonthGroups({ posts }: { posts: SfiPost[] }) {
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

export function SfiPostList({ posts, groupByYear = true }: { posts: SfiPost[]; groupByYear?: boolean }) {
  if (!groupByYear) return <MonthGroups posts={posts} />;

  const years = getSfiYears(posts);

  return (
    <div className="space-y-16">
      {years.map((year) => {
        const yearPosts = posts.filter((post) => post.date.startsWith(String(year)));
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
