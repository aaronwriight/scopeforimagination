import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VentureShell } from "@/components/site/site-content";
import { getAllNationalParks, getNationalPark } from "@/lib/venture-parks";

export function generateStaticParams() {
  return getAllNationalParks().map((park) => ({ slug: park.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const park = getNationalPark(slug);
  if (!park) return {};

  return {
    title: `${park.name} | venture`,
    description: `Venture field notes for ${park.name}.`,
  };
}

export default async function VentureParkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const park = getNationalPark(slug);
  if (!park) notFound();

  return (
    <VentureShell title={park.name} showTitle={false}>
      <article className="not-prose w-full max-w-none">
        <Link href="/venture/parks" className="text-xs lowercase tracking-widest text-stone-500">
          ← parks
        </Link>

        <header className="mt-10 border-b border-stone-300 pb-7 dark:border-stone-700">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-serif text-2xl font-normal leading-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
              {park.name}
            </h1>
            {park.visited && <span className="text-xs lowercase tracking-widest text-[#859900]">visited</span>}
          </div>
          <p className="mt-3 font-serif text-base italic leading-6 text-stone-500">{park.stateOrTerritory}</p>
        </header>

        <section className="mt-10">
          <h2 className="text-xs font-medium lowercase tracking-widest text-stone-700 dark:text-stone-300">field notes</h2>
          {park.visits.length === 0 ? (
            <p className="mt-5 border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
              Visit entry coming soon.
            </p>
          ) : (
            <div className="mt-5 border-t border-stone-300 dark:border-stone-700">
              {park.visits.map((visit, index) => (
                <article key={`${visit.date ?? "visit"}-${index}`} className="border-b border-stone-300 py-6 dark:border-stone-700">
                  <p className="text-[0.65rem] lowercase tracking-widest text-[#859900]">
                    visit {index + 1}{visit.date ? ` · ${visit.date}` : ""}
                  </p>
                  {visit.notes && <p className="mt-3 max-w-3xl font-serif text-sm leading-7 text-stone-700 dark:text-stone-300">{visit.notes}</p>}
                  {visit.entrySlug && (
                    <Link href={`/venture/${visit.entrySlug}`} className="mt-3 inline-block text-xs text-[#6f8200]">
                      read the full entry →
                    </Link>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 text-xs text-stone-500">
          <a href={park.sourceUrl} target="_blank" rel="noreferrer" className="text-[#6f8200]">
            official park site ↗
          </a>
        </p>
      </article>
    </VentureShell>
  );
}
