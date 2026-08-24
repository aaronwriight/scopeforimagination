import Link from "next/link";
import { MusicTagline } from "@/components/site/music-tagline";
import type { VentureEntry } from "@/lib/venture-entries";
import { formatVentureDate } from "@/lib/venture-entries";

function formatMonth(date: string): string {
  return new Date(`${date.slice(0, 7)}-01T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
  });
}

function EntryRows({ entries }: { entries: VentureEntry[] }) {
  return (
    <div className="border-t border-stone-300 dark:border-stone-700">
      {entries.map((entry) => (
        <article key={entry.slug} className="border-b border-stone-300 py-6 dark:border-stone-700">
          <h3 className="font-serif text-lg font-normal leading-tight text-stone-900 dark:text-stone-100">
            <Link href={`/venture/${entry.slug}`}>{entry.title}</Link>
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            {formatVentureDate(entry.date)} · {entry.location}
          </p>
          <MusicTagline music={entry.music} className="mt-1" />
          <p className="mt-2 font-serif text-sm italic leading-6 text-stone-500">{entry.excerpt}</p>
        </article>
      ))}
    </div>
  );
}

export function VentureEntryList({ entries }: { entries: VentureEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="border-t border-stone-300 pt-5 font-serif text-sm italic text-stone-500 dark:border-stone-700">
        No field notes yet. The index is ready for the first adventure.
      </p>
    );
  }

  const years = [...new Set(entries.map((entry) => entry.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-16">
      {years.map((year) => {
        const yearEntries = entries.filter((entry) => entry.date.startsWith(year));
        const months = [...new Set(yearEntries.map((entry) => entry.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));

        return (
          <section key={year}>
            <h2 className="mb-6 font-serif text-sm font-normal tracking-widest text-stone-500">{year}</h2>
            <div className="space-y-10">
              {months.map((month) => {
                const monthEntries = yearEntries.filter((entry) => entry.date.startsWith(month));
                return (
                  <section key={month}>
                    <h3 className="mb-4 font-serif text-xs font-normal lowercase tracking-widest text-stone-500">
                      {formatMonth(monthEntries[0].date)}
                    </h3>
                    <EntryRows entries={monthEntries} />
                  </section>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
