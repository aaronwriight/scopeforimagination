import type { Metadata } from "next";
import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { myPortableTextComponents } from "@/components/portable-components";
import { JournalShell } from "@/components/site/site-content";
import { SfiPostList } from "@/components/site/sfi-post-list";
import { SfiPostHeader } from "@/components/site/sfi-post-header";
import { formatSfiPostTitle, getAllSfiPosts, getSfiPost, getSfiYears } from "@/lib/sfi-posts";

export async function generateStaticParams() {
  const posts = await getAllSfiPosts();
  const years = getSfiYears(posts);
  return [...posts.map((post) => ({ slug: post.entry })), ...years.map((year) => ({ slug: String(year) }))];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const posts = await getAllSfiPosts();
  const years = getSfiYears(posts);

  if (years.includes(Number(slug))) {
    return {
      title: `${slug} | scope for imagination`,
      description: `Scope for Imagination journal entries from ${slug}.`,
    };
  }

  const post = await getSfiPost(slug);
  if (!post) return {};

  return {
    title: `${formatSfiPostTitle(post)} | aaron wright`,
    description: post.excerpt || `A Scope for Imagination journal entry by Aaron Wright.`,
  };
}

export default async function ScopeForImaginationEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const allPosts = await getAllSfiPosts();
  const years = getSfiYears(allPosts);

  if (years.includes(Number(slug))) {
    const year = Number(slug);
    const posts = allPosts.filter((post) => post.date.startsWith(slug));
    return (
      <JournalShell title={slug} years={years}>
        <div className="not-prose mt-10">
          <SfiPostList posts={posts} groupByYear={false} />
        </div>
      </JournalShell>
    );
  }

  const post = await getSfiPost(slug);
  if (!post) notFound();

  const postYear = post.date.slice(0, 4);

  return (
    <JournalShell title={post.title} showTitle={false} years={years}>
      <div className="w-full max-w-3xl">
        <div className="not-prose">
          <Link href={`/scope-for-imagination/${postYear}`} className="text-xs lowercase tracking-widest text-stone-500">
            ← {postYear}
          </Link>

          <SfiPostHeader post={post} large className="mt-10 border-b border-stone-300 pb-7 dark:border-stone-700" />
        </div>

        <div className="prose prose-stone mt-10 max-w-none font-serif text-sm leading-7 dark:prose-invert prose-headings:font-serif prose-a:text-[#6f8200] prose-img:my-10 prose-img:w-full">
          {post.body ? (
            <PortableText value={post.body} components={myPortableTextComponents} />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: post.bodyHtml || "" }} />
          )}
        </div>
      </div>
    </JournalShell>
  );
}
