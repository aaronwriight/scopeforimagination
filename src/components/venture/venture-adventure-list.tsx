import Link from "next/link";
import { MusicTagline } from "@/components/site/music-tagline";
import type { MusicCredit } from "@/lib/music-credit";
import { formatVentureDate } from "@/lib/venture-entries";

export type VentureAdventureItem = Readonly<{
  id: string;
  title: string;
  href: string;
  date: string | null;
  location: string;
  occurrenceLabel: string;
  journalHref?: string;
  excerpt?: string;
  music?: MusicCredit;
}>;

function formatMonth(month: string): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
  });
}

function AdventureRows({ items }: { items: readonly VentureAdventureItem[] }) {
  return (
    <div className="border-t border-stone-300 dark:border-stone-700">
      {items.map((item) => (
        <article key={item.id} className="border-b border-stone-300 py-5 dark:border-stone-700">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="m-0 font-serif text-base font-normal leading-tight text-stone-900 dark:text-stone-100">
              <Link href={item.href}>{item.title}</Link>
            </h3>
            <span className="text-[0.65rem] lowercase tracking-widest text-[#859900]">{item.occurrenceLabel}</span>
          </div>
          <p className="mt-1 text-xs leading-6 text-stone-500">
            {item.date ? formatVentureDate(item.date) : "date to add"} · {item.location}
          </p>
          <MusicTagline music={item.music} className="mt-1" />
          {item.excerpt && <p className="mt-2 font-serif text-sm italic leading-6 text-stone-500">{item.excerpt}</p>}
          {item.journalHref && (
            <Link href={item.journalHref} className="mt-2 inline-block text-xs text-[#6f8200]">
              read the journal entry →
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}

export function VentureAdventureList({ items }: { items: readonly VentureAdventureItem[] }) {
  if (items.length === 0) {
    return <p className="font-serif text-sm italic text-stone-500">No adventures recorded yet.</p>;
  }

  const dated = items.filter((item) => item.date !== null).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const pending = items
    .filter((item) => item.date === null)
    .sort((a, b) => a.title.localeCompare(b.title, "en") || a.occurrenceLabel.localeCompare(b.occurrenceLabel, "en"));
  const years = [...new Set(dated.map((item) => item.date!.slice(0, 4)))];

  return (
    <div className="space-y-16">
      {years.map((year) => {
        const yearItems = dated.filter((item) => item.date!.startsWith(year));
        const months = [...new Set(yearItems.map((item) => item.date!.slice(0, 7)))];

        return (
          <section key={year}>
            <h2 className="mb-6 font-serif text-sm font-normal tracking-widest text-stone-500">{year}</h2>
            <div className="space-y-10">
              {months.map((month) => (
                <section key={month}>
                  <h3 className="mb-4 font-serif text-xs font-normal lowercase tracking-widest text-stone-500">
                    {formatMonth(month)}
                  </h3>
                  <AdventureRows items={yearItems.filter((item) => item.date!.startsWith(month))} />
                </section>
              ))}
            </div>
          </section>
        );
      })}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 font-serif text-sm font-normal lowercase tracking-widest text-stone-500">dates to add</h2>
          <p className="mb-5 max-w-2xl font-serif text-sm italic leading-6 text-stone-500">
            These adventures are recorded; their dates are waiting to be added.
          </p>
          <AdventureRows items={pending} />
        </section>
      )}
    </div>
  );
}
