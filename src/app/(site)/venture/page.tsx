import type { Metadata } from "next";
import Link from "next/link";
import { VentureGlobe } from "@/components/venture/venture-globe";
import { VentureShell } from "@/components/site/site-content";
import { formatVentureDate, getAllVentureEntries } from "@/lib/venture-entries";

export const metadata: Metadata = {
  title: "venture | aaron wright",
  description: "An atlas and field journal for hikes, trips, peaks, and national parks.",
};

export default async function VenturePage() {
  const entries = await getAllVentureEntries();
  const mapEntries = entries.map(({ title, slug, location, latitude, longitude }) => ({
    title,
    slug,
    location,
    latitude,
    longitude,
  }));

  return (
    <VentureShell title="venture">
      <p className="text-stone-500">an atlas of places worth remembering</p>
      <p>
        Venture is a field journal for hikes, trips, and the stories gathered along the way—including a path toward the Northeast 115 4,000-footers
        and all 63 U.S. national parks.
      </p>

      <section>
        <p className="m-0 font-medium">the atlas</p>
        <div className="mt-3">
          <VentureGlobe entries={mapEntries} />
        </div>
      </section>

      <section className="not-prose grid gap-3 sm:grid-cols-2">
        <div className="border-t border-stone-300 pt-3 dark:border-stone-700">
          <p className="m-0 text-xs lowercase tracking-widest text-[#6f8200]">northeast 115</p>
          <p className="mt-1 font-serif text-sm text-stone-600 dark:text-stone-400">the 4,000-footers</p>
        </div>
        <div className="border-t border-stone-300 pt-3 dark:border-stone-700">
          <p className="m-0 text-xs lowercase tracking-widest text-[#6f8200]">63 national parks</p>
          <p className="mt-1 font-serif text-sm text-stone-600 dark:text-stone-400">one park at a time</p>
        </div>
      </section>

      <section>
        <p className="m-0 font-medium">field notes</p>
        {entries.length === 0 ? (
          <p className="border-t border-stone-300 pt-5 font-serif italic text-stone-500 dark:border-stone-700">
            No entries yet. The atlas is ready for the first adventure.
          </p>
        ) : (
          <div className="not-prose mt-3 border-t border-stone-300 dark:border-stone-700">
            {entries.map((entry) => (
              <article key={entry.slug} className="border-b border-stone-300 py-5 dark:border-stone-700">
                <h2 className="font-serif text-lg font-normal text-stone-900 dark:text-stone-100">
                  <Link href={`/venture/${entry.slug}`}>{entry.title}</Link>
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  {formatVentureDate(entry.date)} • {entry.location}
                </p>
                <p className="mt-2 font-serif text-sm italic leading-6 text-stone-500">{entry.excerpt}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </VentureShell>
  );
}
