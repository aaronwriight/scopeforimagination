import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VentureShell } from "@/components/site/site-content";
import { formatOccurrence, formatOrdinal } from "@/lib/venture-format";
import { formatNationalParkName, getAllNationalParks, getNationalPark } from "@/lib/venture-parks";

function formatVisitDate(date: string | null): string {
  if (!date) return "date pending";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
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
  const visitsNewestFirst = park.visits
    .map((visit, index) => ({ visit, index }))
    .sort((first, second) => {
      const chronology = (second.visit.date ?? "").localeCompare(first.visit.date ?? "");
      return chronology !== 0 ? chronology : second.index - first.index;
    });
  const linkedVisits = visitsNewestFirst
    .filter(({ visit }) => Boolean(visit.entrySlug));
  const trips = [...new Set(park.visits.flatMap((visit) => (visit.trip ? [visit.trip] : [])))];
  const firstVisitDate = park.visits[0]?.date ?? null;
  const pendingOrEmpty = park.visited ? "pending" : "—";

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
        </header>

        <dl className="grid gap-x-8 gap-y-5 border-b border-stone-300 py-7 text-sm sm:grid-cols-2 lg:grid-cols-3 dark:border-stone-700">
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">visits</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">{park.visits.length}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">date first visit</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">
              {firstVisitDate ? formatVisitDate(firstVisitDate) : park.visited ? "date pending" : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">no. visited</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">
              {park.visitNumber === null ? pendingOrEmpty : formatOrdinal(park.visitNumber)}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">trip</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">
              {trips.length > 0 ? trips.join(" · ") : park.visited ? "trip pending" : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">source</dt>
            <dd className="mt-1 font-serif">
              <a href={park.sourceUrl} target="_blank" rel="noreferrer" className="text-[#6f8200]">
                official NPS page ↗
              </a>
            </dd>
          </div>
        </dl>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">field notes</h2>
          {park.visits.length === 0 ? (
            <p className="mt-5 border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
              Field notes will begin with the first visit.
            </p>
          ) : (
            <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
              {visitsNewestFirst.map(({ visit, index }) => (
                <article key={`${visit.date ?? "visit"}-${index}`} className="border-b border-stone-300 py-6 dark:border-stone-700">
                  <h3 className="m-0 text-[0.65rem] font-normal lowercase tracking-widest text-[#6f8200]">
                    {formatOccurrence(index + 1, "visit")}
                  </h3>
                  <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[0.62rem] lowercase tracking-widest text-stone-500">date</dt>
                      <dd className="mt-1 font-serif text-stone-700 dark:text-stone-300">
                        {formatVisitDate(visit.date)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.62rem] lowercase tracking-widest text-stone-500">trip</dt>
                      <dd className="mt-1 font-serif text-stone-700 dark:text-stone-300">
                        {visit.trip ?? "trip pending"}
                      </dd>
                    </div>
                  </dl>
                  {visit.fieldNote && (
                    <p className="mt-4 max-w-3xl font-serif text-sm leading-7 text-stone-700 dark:text-stone-300">
                      {visit.fieldNote}
                    </p>
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
                  <span>{formatOccurrence(index + 1, "visit")}</span>
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
