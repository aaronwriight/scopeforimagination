"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MusicTagline } from "@/components/site/music-tagline";
import type { MusicCredit } from "@/lib/music-credit";

export type VentureAdventureKind = "peak" | "park" | "travel" | "journal";

export type VentureAdventureRecord = Readonly<{
  id: string;
  label: string;
  date: string | null;
  trip: string | null;
  journalHref?: string;
}>;

export type VentureAdventureItem = Readonly<{
  id: string;
  title: string;
  href: string;
  kind: VentureAdventureKind;
  location: string;
  entry?: string;
  time?: string;
  records: readonly VentureAdventureRecord[];
  excerpt?: string;
  music?: MusicCredit | null;
}>;

type OrganizeBy = "type" | "trip";

const kindOrder: readonly VentureAdventureKind[] = ["peak", "park", "travel", "journal"];
const kindLabels: Record<VentureAdventureKind, string> = {
  peak: "peaks",
  park: "national parks",
  travel: "travels",
  journal: "journal entries",
};

function formatAdventureDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function uniqueTrips(item: VentureAdventureItem): string[] {
  return [...new Set(item.records.flatMap((record) => record.trip ? [record.trip] : []))].sort((first, second) =>
    first.localeCompare(second, "en"),
  );
}

function dateSummary(item: VentureAdventureItem): string {
  const dates = [...new Set(item.records.flatMap((record) => record.date ? [record.date] : []))].sort();
  if (dates.length === 0) return "dates to add";
  if (dates.length === 1) return `known date: ${formatAdventureDate(dates[0])}`;
  return `known dates: ${formatAdventureDate(dates[0])} – ${formatAdventureDate(dates[dates.length - 1])}`;
}

function AdventureRows({ items }: { items: readonly VentureAdventureItem[] }) {
  return (
    <div className="border-t border-stone-300 dark:border-stone-700">
      {items.map((item) => {
        const trips = uniqueTrips(item);
        const journalHrefs = [...new Set(item.records.flatMap((record) => record.journalHref ? [record.journalHref] : []))];

        return (
          <article key={item.id} className="border-b border-stone-300 py-5 dark:border-stone-700">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="m-0 font-serif text-base font-normal leading-tight text-stone-900 dark:text-stone-100">
                <Link href={item.href}>{item.title}</Link>
              </h3>
              <span className="text-[0.65rem] lowercase tracking-widest text-[#859900]">
                {item.records.length} {item.records.length === 1 ? "field note" : "field notes"}
              </span>
            </div>
            {item.entry && item.time && item.records[0]?.date ? (
              <p className="mt-1 text-xs leading-6 text-stone-500">
                <time dateTime={`${item.records[0].date}T${item.time}`}>
                  {formatAdventureDate(item.records[0].date)} • {item.time}
                </time>{" "}
                • {item.location} • {item.entry}
              </p>
            ) : (
              <p className="mt-1 text-xs leading-6 text-stone-500">{item.location} · {dateSummary(item)}</p>
            )}
            <p className="mt-0.5 text-xs leading-6 text-stone-500">
              trip: {trips.length > 0 ? trips.join(" · ") : "to add"}
            </p>
            <MusicTagline music={item.music} className="mt-1" />
            {item.excerpt && <p className="mt-2 font-serif text-sm italic leading-6 text-stone-500">{item.excerpt}</p>}
            {journalHrefs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6f8200]">
                {journalHrefs.map((journalHref, index) => (
                  <Link key={journalHref} href={journalHref}>
                    {journalHrefs.length === 1 ? "read the journal entry" : `read journal entry ${index + 1}`} →
                  </Link>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function VentureAdventureList({ items }: { items: readonly VentureAdventureItem[] }) {
  const [organizeBy, setOrganizeBy] = useState<OrganizeBy>("type");

  const groups = useMemo(() => {
    const sortedItems = [...items].sort((first, second) => first.title.localeCompare(second.title, "en"));
    if (organizeBy === "type") {
      return kindOrder
        .map((kind) => ({ label: kindLabels[kind], items: sortedItems.filter((item) => item.kind === kind) }))
        .filter((group) => group.items.length > 0);
    }

    const itemsByTrip = new Map<string, VentureAdventureItem[]>();
    for (const item of sortedItems) {
      const trips = uniqueTrips(item);
      for (const trip of trips.length > 0 ? trips : ["trip to add"]) {
        const tripItems = itemsByTrip.get(trip) ?? [];
        tripItems.push(item);
        itemsByTrip.set(trip, tripItems);
      }
    }

    const labels = [...itemsByTrip.keys()].sort((first, second) => {
      if (first === "trip to add") return 1;
      if (second === "trip to add") return -1;
      return first.localeCompare(second, "en");
    });
    return labels.map((label) => ({ label, items: itemsByTrip.get(label) ?? [] }));
  }, [items, organizeBy]);

  if (items.length === 0) {
    return <p className="font-serif text-sm italic text-stone-500">No adventures recorded yet.</p>;
  }

  return (
    <div>
      <div className="mb-10 grid gap-3 border-y border-stone-300 py-4 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-end dark:border-stone-700">
        <label className="text-[0.65rem] lowercase tracking-widest text-stone-500">
          organize index by
          <select
            value={organizeBy}
            onChange={(event) => setOrganizeBy(event.target.value as OrganizeBy)}
            className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 font-serif text-sm text-stone-700 outline-none focus:border-[#859900] dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300"
          >
            <option value="type">peak / park / travels</option>
            <option value="trip">trip</option>
          </select>
        </label>
        <p className="m-0 text-xs text-stone-500 sm:text-right">
          {items.length} {items.length === 1 ? "place" : "places"} · repeated ascents and visits stay together
        </p>
      </div>

      <div className="space-y-14">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-4 font-serif text-sm font-normal lowercase tracking-widest text-stone-500">{group.label}</h2>
            <AdventureRows items={group.items} />
          </section>
        ))}
      </div>
    </div>
  );
}
