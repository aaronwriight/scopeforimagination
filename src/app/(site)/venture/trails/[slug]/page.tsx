import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VentureShell } from "@/components/site/site-content";
import { CompletionStatus } from "@/components/venture/completion-status";
import {
  getAllNortheastPeaks,
  getNortheastPeak,
  type TrailAscent,
} from "@/lib/venture-trails";

const ascentNames = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
] as const;

function ascentLabel(ordinal: number): string {
  return `${ascentNames[ordinal - 1] ?? `#${ordinal}`} ascent`;
}

function formatAscentDate(date: string | null): string {
  if (!date) return "date pending";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

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
  const linkedAscents = peak.ascents.filter(
    (ascent): ascent is TrailAscent & { entrySlug: string } => ascent.entrySlug !== null,
  );

  return (
    <VentureShell title={peak.name} showTitle={false}>
      <article className="not-prose w-full max-w-none">
        <Link href="/venture/trails" className="text-xs lowercase tracking-widest text-stone-500">
          ← northeast 115
        </Link>

        <header className="mt-10 border-b border-stone-300 pb-7 dark:border-stone-700">
          <h1 className="font-serif text-2xl font-normal leading-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
            {peak.name}
          </h1>
          <p className="mt-3 font-serif text-base italic leading-6 text-stone-500">
            {peak.range}, {peak.state}
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs lowercase tracking-widest text-stone-500">
            <CompletionStatus
              complete={peak.completed}
              completeLabel="climbed"
              incompleteLabel="not yet climbed"
            />
            <span className={peak.completed ? "text-[#6f8200]" : undefined}>
              {peak.completed ? "climbed" : "not yet climbed"}
            </span>
          </p>
        </header>

        <dl className="grid gap-x-8 gap-y-5 border-b border-stone-300 py-7 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-stone-700">
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
          {peak.completionNumber !== null && (
            <div>
              <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">completion number</dt>
              <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">#{peak.completionNumber}</dd>
            </div>
          )}
          {peak.rating !== null && (
            <div>
              <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">rating</dt>
              <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">{peak.rating} / 10</dd>
            </div>
          )}
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">source</dt>
            <dd className="mt-1 font-serif">
              <a href={peak.sourceUrl} target="_blank" rel="noreferrer" className="text-[#6f8200]">
                Peakbagger ↗
              </a>
            </dd>
          </div>
        </dl>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">ascents</h2>
          {peak.ascents.length === 0 ? (
            <p className="mt-5 border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
              No ascents recorded yet.
            </p>
          ) : (
            <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
              {peak.ascents.map((ascent) => (
                <div key={ascent.ordinal} className="border-b border-stone-300 py-6 dark:border-stone-700">
                  <p className="text-[0.65rem] lowercase tracking-widest text-[#6f8200]">
                    {ascentLabel(ascent.ordinal)}
                  </p>
                  <p className="mt-2 font-serif text-sm text-stone-500">{formatAscentDate(ascent.date)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">field notes</h2>
          <p className="mt-5 border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
            Field notes are private for now.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">journal entries</h2>
          {linkedAscents.length === 0 ? (
            <p className="mt-5 border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
              No journal entry linked yet.
            </p>
          ) : (
            <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
              {linkedAscents.map((ascent) => (
                <Link
                  key={`${ascent.ordinal}-${ascent.entrySlug}`}
                  href={`/venture/${ascent.entrySlug}`}
                  className="flex items-center justify-between gap-4 border-b border-stone-300 py-5 font-serif text-sm text-[#6f8200] dark:border-stone-700"
                >
                  <span>{ascentLabel(ascent.ordinal)}</span>
                  <span aria-hidden="true">read →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </article>
    </VentureShell>
  );
}
