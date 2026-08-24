import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VentureShell } from "@/components/site/site-content";
import { getAllNortheastPeaks, getNortheastPeak } from "@/lib/venture-trails";

export function generateStaticParams() {
  return getAllNortheastPeaks().map((peak) => ({ slug: peak.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const peak = getNortheastPeak(slug);
  if (!peak) return {};

  return {
    title: `${peak.name} | venture`,
    description: `${peak.name}, a ${peak.elevationFeet.toLocaleString()}-foot Northeast 115 summit in ${peak.state}.`,
  };
}

export default async function VentureTrailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const peak = getNortheastPeak(slug);
  if (!peak) notFound();

  return (
    <VentureShell title={peak.name} showTitle={false}>
      <article className="not-prose w-full max-w-none">
        <Link href="/venture/trails" className="text-xs lowercase tracking-widest text-stone-500">
          ← trails
        </Link>

        <header className="mt-10 border-b border-stone-300 pb-7 dark:border-stone-700">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-serif text-2xl font-normal leading-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
              {peak.name}
            </h1>
            {peak.completed && <span className="text-xs lowercase tracking-widest text-[#859900]">climbed</span>}
          </div>
          <p className="mt-3 font-serif text-base italic leading-6 text-stone-500">
            {peak.range}, {peak.state}
          </p>
        </header>

        <dl className="grid gap-x-8 gap-y-5 border-b border-stone-300 py-7 text-sm sm:grid-cols-4 dark:border-stone-700">
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">rank</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">{peak.rank} / 115</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">elevation</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">{peak.elevationFeet.toLocaleString()} ft</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">prominence</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">{peak.prominenceFeet.toLocaleString()} ft</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">ascents</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">{peak.timesHiked}</dd>
          </div>
        </dl>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">field notes</h2>
          {peak.ascents.length === 0 ? (
            <p className="mt-5 border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
              Not yet climbed. This page is ready for the story when it happens.
            </p>
          ) : (
            <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
              {peak.ascents.map((ascent) => (
                <article key={ascent.ordinal} className="border-b border-stone-300 py-6 dark:border-stone-700">
                  <p className="text-[0.65rem] lowercase tracking-widest text-[#859900]">
                    hike {ascent.ordinal}
                    {ascent.date ? ` · ${ascent.date}` : ""}
                  </p>
                  {ascent.note ? (
                    <p className="mt-3 max-w-3xl font-serif text-sm leading-7 text-stone-700 dark:text-stone-300">{ascent.note}</p>
                  ) : (
                    <p className="mt-3 font-serif text-sm italic text-stone-500">notes coming soon</p>
                  )}
                  {ascent.entrySlug && (
                    <Link href={`/venture/${ascent.entrySlug}`} className="mt-3 inline-block text-xs text-[#6f8200]">
                      read the full entry →
                    </Link>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 text-xs text-stone-500">
          <a href={peak.sourceUrl} target="_blank" rel="noreferrer" className="text-[#6f8200]">
            peak details on Peakbagger ↗
          </a>
        </p>
      </article>
    </VentureShell>
  );
}
