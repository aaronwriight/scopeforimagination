import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VentureShell } from "@/components/site/site-content";
import { getAllTravelDestinations, getTravelDestination } from "@/lib/venture-travels";

const ordinalNames = ["first", "second", "third", "fourth"] as const;

function visitLabel(ordinal: number): string {
  return ordinalNames[ordinal - 1] ?? `visit ${ordinal}`;
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

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">visits</h2>
          <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
            {destination.visits.map((visit) => (
              <article key={visit.ordinal} className="border-b border-stone-300 py-6 dark:border-stone-700">
                <p className="text-[0.65rem] lowercase tracking-widest text-[#859900]">
                  {visitLabel(visit.ordinal)} visit · {visit.date ?? "date coming soon"}
                </p>
                {visit.entrySlug && (
                  <Link href={`/venture/${visit.entrySlug}`} className="mt-3 inline-block text-xs text-[#6f8200]">
                    read the full entry →
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </article>
    </VentureShell>
  );
}
