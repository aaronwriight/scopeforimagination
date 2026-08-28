import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VentureShell } from "@/components/site/site-content";
import { getAllTravelDestinations, getTravelDestination } from "@/lib/venture-travels";

const ordinalNames = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"] as const;

function visitLabel(ordinal: number): string {
  return `${ordinalNames[ordinal - 1] ?? `${ordinal}th`} visit`;
}

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
  return getAllTravelDestinations().map((destination) => ({ slug: destination.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const destination = getTravelDestination(slug);
  if (!destination) return {};

  return {
    title: `${destination.name} | venture`,
    description: `Venture travel notes from ${destination.name}.`,
  };
}

export default async function VentureTravelDestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const destination = getTravelDestination(slug);
  if (!destination) notFound();
  const firstVisit = destination.visits[0];
  const visitsNewestFirst = [...destination.visits].sort((first, second) => {
    const chronology = (second.date ?? "").localeCompare(first.date ?? "");
    return chronology !== 0 ? chronology : second.ordinal - first.ordinal;
  });
  const trips = [
    ...new Set(
      destination.visits
        .map((visit) => visit.trip)
        .filter((trip): trip is string => trip !== null),
    ),
  ];
  const linkedVisits = visitsNewestFirst.filter(
    (visit): visit is typeof visit & { entrySlug: string } => Boolean(visit.entrySlug),
  );

  return (
    <VentureShell title={destination.name} showTitle={false}>
      <article className="not-prose w-full max-w-none">
        <Link href="/venture/travels" className="text-xs lowercase tracking-widest text-stone-500">
          ← travels
        </Link>

        <header className="mt-10 border-b border-stone-300 pb-7 dark:border-stone-700">
          <h1 className="font-serif text-2xl font-normal leading-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
            {destination.name}
          </h1>
          <p className="mt-3 font-serif text-base italic leading-6 text-stone-500">{destination.region}</p>
        </header>

        <dl className="grid gap-x-8 gap-y-5 border-b border-stone-300 py-7 text-sm sm:grid-cols-2 lg:grid-cols-3 dark:border-stone-700">
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">visits</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">{destination.visits.length}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">date first visit</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">
              {formatVisitDate(firstVisit?.date ?? null)}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] lowercase tracking-widest text-stone-500">trip</dt>
            <dd className="mt-1 font-serif text-stone-800 dark:text-stone-200">
              {trips.length > 0 ? trips.join(" · ") : "trip pending"}
            </dd>
          </div>
        </dl>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">field notes</h2>
          <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
            {visitsNewestFirst.map((visit) => (
              <article key={visit.ordinal} className="border-b border-stone-300 py-6 dark:border-stone-700">
                <h3 className="m-0 text-[0.65rem] font-normal lowercase tracking-widest text-[#6f8200]">
                  {visitLabel(visit.ordinal)}
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
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">
            journal entries
          </h2>
          {linkedVisits.length === 0 ? (
            <p className="mt-5 border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
              No journal entry linked yet.
            </p>
          ) : (
            <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
              {linkedVisits.map((visit) => (
                <Link
                  key={`${visit.ordinal}-${visit.entrySlug}`}
                  href={`/venture/${visit.entrySlug}`}
                  className="flex items-baseline justify-between gap-4 border-b border-stone-300 py-5 font-serif text-sm text-stone-700 transition-colors hover:text-[#6f8200] dark:border-stone-700 dark:text-stone-300"
                >
                  <span>{visitLabel(visit.ordinal)}</span>
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
