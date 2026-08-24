import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VentureShell } from "@/components/site/site-content";
import { formatNationalParkName, getAllNationalParks, getNationalPark } from "@/lib/venture-parks";

const visitOrdinals = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

function visitLabel(index: number): string {
  return `${visitOrdinals[index] ?? `${index + 1}th`} visit`;
}

export function generateStaticParams() {
  return getAllNationalParks().map((park) => ({ slug: park.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const park = getNationalPark(slug);
  if (!park) return {};
  const displayName = formatNationalParkName(park.name);

  return {
    title: `${displayName} | venture`,
    description: `Venture visits and memories for ${displayName}.`,
  };
}

export default async function VentureParkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const park = getNationalPark(slug);
  if (!park) notFound();
  const displayName = formatNationalParkName(park.name);
  const linkedVisits = park.visits
    .map((visit, index) => ({ visit, index }))
    .filter(({ visit }) => Boolean(visit.entrySlug));

  return (
    <VentureShell title={displayName} showTitle={false}>
      <article className="not-prose w-full max-w-none">
        <Link href="/venture/parks" className="text-xs lowercase tracking-widest text-stone-500">
          ← national parks
        </Link>

        <header className="mt-10 border-b border-stone-300 pb-7 dark:border-stone-700">
          <h1 className="font-serif text-2xl font-normal leading-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
            {displayName}
          </h1>
          <p className="mt-3 font-serif text-base italic leading-6 text-stone-500">{park.stateOrTerritory}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] lowercase tracking-widest text-stone-500">
            <span className={park.visited ? "text-[#859900]" : undefined}>
              {park.visited ? "visited" : "not yet visited"}
            </span>
            <span aria-hidden="true">·</span>
            <a href={park.sourceUrl} target="_blank" rel="noreferrer" className="text-[#6f8200]">
              official NPS page ↗
            </a>
          </div>
        </header>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">visits</h2>
          {park.visits.length === 0 ? (
            <p className="mt-5 border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
              Visit record coming soon.
            </p>
          ) : (
            <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
              {park.visits.map((visit, index) => (
                <article key={`${visit.date ?? "visit"}-${index}`} className="border-b border-stone-300 py-6 dark:border-stone-700">
                  <p className="text-[0.65rem] lowercase tracking-widest text-[#859900]">
                    {visitLabel(index)} · {visit.date ?? "date pending"}
                  </p>
                  {visit.fieldNote && (
                    <div className="mt-4">
                      <h3 className="text-[0.65rem] lowercase tracking-widest text-stone-500">field note</h3>
                      <p className="mt-2 max-w-3xl font-serif text-sm leading-7 text-stone-700 dark:text-stone-300">
                        {visit.fieldNote}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">journal entries</h2>
          {linkedVisits.length === 0 ? (
            <p className="mt-5 border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
              No journal entry linked yet.
            </p>
          ) : (
            <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
              {linkedVisits.map(({ visit, index }) => (
                <Link
                  key={`${visit.entrySlug}-${index}`}
                  href={`/venture/${visit.entrySlug}`}
                  className="flex items-baseline justify-between gap-4 border-b border-stone-300 py-5 font-serif text-sm text-stone-700 transition-colors hover:text-[#6f8200] dark:border-stone-700 dark:text-stone-300"
                >
                  <span>{visitLabel(index)}</span>
                  <span className="text-xs text-[#6f8200]">read the journal entry →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </article>
    </VentureShell>
  );
}
