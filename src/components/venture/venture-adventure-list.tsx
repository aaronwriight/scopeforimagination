"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { MusicTagline } from "@/components/site/music-tagline";
import {
  ListBatchSizeControl,
  ProgressiveRevealControl,
  type ListBatchSize,
} from "@/components/site/progressive-list-controls";
import { VentureViewSelector, type VentureView } from "@/components/venture/venture-view-selector";
import type { MusicCredit } from "@/lib/music-credit";

export type VentureAdventureKind = "peak" | "park" | "travel";

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

type OrganizeBy = "kind" | "trip";

const kindLabels: Record<VentureAdventureKind, string> = {
  peak: "peaks",
  park: "national parks",
  travel: "travels",
};
const kindForView: Record<VentureView, VentureAdventureKind> = {
  peaks: "peak",
  parks: "park",
  travels: "travel",
};
const organizeOptionLabels: Record<VentureView, string> = {
  peaks: "peak",
  parks: "park",
  travels: "travel",
};
const countLabels: Record<VentureView, readonly [string, string]> = {
  peaks: ["peak", "peaks"],
  parks: ["park", "parks"],
  travels: ["place", "places"],
};

type TripScope = string | null | undefined;

function recordsForTrip(item: VentureAdventureItem, trip: TripScope): readonly VentureAdventureRecord[] {
  if (trip === undefined) return item.records;
  return item.records.filter((record) => record.trip === trip);
}

function latestKnownTimestamp(item: VentureAdventureItem, trip?: string | null): string {
  const latestDate = recordsForTrip(item, trip)
    .flatMap((record) => record.date ? [record.date] : [])
    .sort((first, second) => second.localeCompare(first))[0];

  if (!latestDate) return "";
  const time = item.entry && item.time ? item.time : "00:00";
  return `${latestDate}T${time}`;
}

function compareItemsNewest(
  first: VentureAdventureItem,
  second: VentureAdventureItem,
  trip?: string | null,
): number {
  const chronology = latestKnownTimestamp(second, trip).localeCompare(latestKnownTimestamp(first, trip));
  if (chronology !== 0) return chronology;

  const title = first.title.localeCompare(second.title, "en");
  return title !== 0 ? title : first.id.localeCompare(second.id, "en");
}

function compareRecordsNewest(first: VentureAdventureRecord, second: VentureAdventureRecord): number {
  const chronology = (second.date ?? "").localeCompare(first.date ?? "");
  return chronology !== 0
    ? chronology
    : second.id.localeCompare(first.id, "en", { numeric: true });
}

function formatAdventureDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function uniqueTrips(item: VentureAdventureItem): string[] {
  return [...new Set(item.records.flatMap((record) => record.trip ? [record.trip] : []))].sort(
    (first, second) => {
      const chronology = latestKnownTimestamp(item, second).localeCompare(latestKnownTimestamp(item, first));
      return chronology !== 0 ? chronology : first.localeCompare(second, "en");
    },
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
        const newestRecords = [...item.records].sort(compareRecordsNewest);
        const journalHrefs = [...new Set(newestRecords.flatMap((record) => record.journalHref ? [record.journalHref] : []))];

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
              <p className="mt-1 text-xs leading-6 text-stone-450">
                <time dateTime={`${item.records[0].date}T${item.time}`}>
                  {formatAdventureDate(item.records[0].date)} • {item.time}
                </time>{" "}
                • {item.location} • {item.entry}
              </p>
            ) : (
              <p className="mt-1 text-xs leading-6 text-stone-450">
                <span className="text-stone-500">{item.location}</span> · {dateSummary(item)}
              </p>
            )}
            <p className="mt-0.5 text-xs leading-6 text-stone-450">
              trip: {trips.length > 0 ? trips.join(" · ") : "to add"}
            </p>
            <MusicTagline music={item.music} className="mt-1" />
            {item.excerpt && <p className="mt-2 font-serif text-sm italic leading-6 text-stone-450">{item.excerpt}</p>}
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
  const [view, setView] = useState<VentureView>("travels");
  const [organizeBy, setOrganizeBy] = useState<OrganizeBy>("kind");
  const [batchSize, setBatchSize] = useState<ListBatchSize>(5);
  const [visibleCount, setVisibleCount] = useState(5);
  const listId = useId();

  const groups = useMemo(() => {
    const selectedKind = kindForView[view];
    const selectedItems = items.filter((item) => item.kind === selectedKind);
    const sortedItems = [...selectedItems].sort((first, second) => compareItemsNewest(first, second));
    if (organizeBy === "kind") {
      return [{ label: kindLabels[selectedKind], items: sortedItems }];
    }

    const itemsByTrip = new Map<string, VentureAdventureItem[]>();
    for (const item of selectedItems) {
      const trips = [...new Set(item.records.map((record) => record.trip ?? "trip to add"))];
      for (const tripLabel of trips) {
        const tripItems = itemsByTrip.get(tripLabel) ?? [];
        tripItems.push(item);
        itemsByTrip.set(tripLabel, tripItems);
      }
    }

    const labels = [...itemsByTrip.keys()].sort((first, second) => {
      if (first === "trip to add") return 1;
      if (second === "trip to add") return -1;
      const firstItems = itemsByTrip.get(first) ?? [];
      const secondItems = itemsByTrip.get(second) ?? [];
      const firstLatest = firstItems
        .map((item) => latestKnownTimestamp(item, first))
        .sort((a, b) => b.localeCompare(a))[0] ?? "";
      const secondLatest = secondItems
        .map((item) => latestKnownTimestamp(item, second))
        .sort((a, b) => b.localeCompare(a))[0] ?? "";
      const chronology = secondLatest.localeCompare(firstLatest);
      return chronology !== 0 ? chronology : first.localeCompare(second, "en");
    });
    return labels.map((label) => {
      const trip = label === "trip to add" ? null : label;
      return {
        label,
        items: [...(itemsByTrip.get(label) ?? [])].sort((first, second) =>
          compareItemsNewest(first, second, trip),
        ),
      };
    });
  }, [items, organizeBy, view]);

  if (items.length === 0) {
    return <p className="font-serif text-sm italic text-stone-500">No adventures recorded yet.</p>;
  }

  const displayRows = groups
    .flatMap((group) => {
      const trip = organizeBy === "trip" ? (group.label === "trip to add" ? null : group.label) : undefined;
      return group.items.map((item) => ({
        key: `${group.label}:${item.id}`,
        item,
        timestamp: latestKnownTimestamp(item, trip),
      }));
    })
    .sort((first, second) => {
      const chronology = second.timestamp.localeCompare(first.timestamp);
      if (chronology !== 0) return chronology;
      const title = first.item.title.localeCompare(second.item.title, "en");
      if (title !== 0) return title;
      return first.key.localeCompare(second.key, "en");
    });
  const shownCount = Math.min(visibleCount, displayRows.length);
  const visibleRowKeys = new Set(displayRows.slice(0, shownCount).map((row) => row.key));
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => visibleRowKeys.has(`${group.label}:${item.id}`)),
    }))
    .filter((group) => group.items.length > 0);
  const selectedKind = kindForView[view];
  const selectedItemCount = items.filter((item) => item.kind === selectedKind).length;
  const [singularCountLabel, pluralCountLabel] = countLabels[view];

  const changeView = (nextView: VentureView) => {
    setView(nextView);
    setVisibleCount(batchSize);
  };

  const changeOrganizeBy = (nextOrganizeBy: OrganizeBy) => {
    setOrganizeBy(nextOrganizeBy);
    setVisibleCount(batchSize);
  };

  const changeBatchSize = (nextBatchSize: ListBatchSize) => {
    setBatchSize(nextBatchSize);
    setVisibleCount(nextBatchSize);
  };

  return (
    <div>
      <VentureViewSelector
        value={view}
        onChange={changeView}
        label="Choose an adventure index"
        controlsId={listId}
      />

      <div className="mb-10 mt-8 grid gap-4 sm:grid-cols-[minmax(0,16rem)_auto_1fr] sm:items-end">
        <label className="text-[0.65rem] lowercase tracking-widest text-stone-400">
          organize index by
          <select
            value={organizeBy}
            onChange={(event) => changeOrganizeBy(event.target.value as OrganizeBy)}
            className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 font-serif text-sm text-stone-900 outline-none focus:border-[#859900] dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
          >
            <option value="kind">{organizeOptionLabels[view]}</option>
            <option value="trip">trip</option>
          </select>
        </label>
        <ListBatchSizeControl value={batchSize} onChange={changeBatchSize} label={kindLabels[selectedKind]} />
        <p className="m-0 text-xs text-stone-450 sm:text-right" aria-live="polite">
          {selectedItemCount} {selectedItemCount === 1 ? singularCountLabel : pluralCountLabel} · repeated
          ascents and visits stay together
        </p>
      </div>

      <div id={listId} className="space-y-14">
        {visibleGroups.map((group) => (
          <section key={group.label}>
            {organizeBy === "trip" ? (
              <h2 className="mb-4 font-serif text-sm font-normal lowercase tracking-widest text-stone-500">
                {group.label}
              </h2>
            ) : null}
            <AdventureRows items={group.items} />
          </section>
        ))}
      </div>

      {displayRows.length === 0 ? (
        <p className="font-serif text-sm italic text-stone-500">No {kindLabels[selectedKind]} recorded yet.</p>
      ) : null}

      {displayRows.length > batchSize ? (
        <ProgressiveRevealControl
          visibleCount={shownCount}
          totalCount={displayRows.length}
          batchSize={batchSize}
          regionId={listId}
          singularLabel="adventure"
          pluralLabel="adventures"
          onShowMore={() => setVisibleCount((current) => Math.min(current + batchSize, displayRows.length))}
        />
      ) : null}
    </div>
  );
}
