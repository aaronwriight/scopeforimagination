import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VentureShell } from "@/components/site/site-content";
import { formatVentureDate, getAllVentureEntries, getVentureEntry } from "@/lib/venture-entries";

const collectionLabels = {
  "northeast-115": "northeast 115",
  "national-parks": "national parks",
};

export async function generateStaticParams() {
  const entries = await getAllVentureEntries();
  return entries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getVentureEntry(slug);
  if (!entry) return {};

  return {
    title: `${entry.title} | venture`,
    description: entry.excerpt,
  };
}

export default async function VentureEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getVentureEntry(slug);
  if (!entry) notFound();

  return (
    <VentureShell title={entry.title} showTitle={false}>
      <article className="not-prose w-full max-w-none">
        <Link href="/venture" className="text-xs lowercase tracking-widest text-stone-500">
          ← venture
        </Link>

        <header className="mt-10 border-b border-stone-300 pb-7 dark:border-stone-700">
          <h1 className="font-serif text-2xl font-normal leading-tight text-stone-900 dark:text-stone-100 sm:text-3xl">{entry.title}</h1>
          <p className="mt-3 font-serif text-base italic leading-6 text-stone-500 sm:text-lg">{entry.excerpt}</p>
          <p className="mt-3 text-xs leading-6 text-stone-500">
            <time dateTime={entry.date}>{formatVentureDate(entry.date)}</time> • {entry.location}
          </p>
          {(entry.collections.length > 0 || entry.tags.length > 0) && (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] lowercase tracking-widest text-[#6f8200]">
              {entry.collections.map((collection) => (
                <li key={collection}>{collectionLabels[collection]}</li>
              ))}
              {entry.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
        </header>

        <div
          className="prose prose-stone mt-10 max-w-none font-serif text-sm leading-7 dark:prose-invert prose-headings:font-serif prose-a:text-[#6f8200] prose-img:my-10 prose-img:w-full"
          dangerouslySetInnerHTML={{ __html: entry.bodyHtml }}
        />
      </article>
    </VentureShell>
  );
}
