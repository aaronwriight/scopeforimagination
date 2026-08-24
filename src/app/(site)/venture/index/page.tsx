import type { Metadata } from "next";
import { VentureShell } from "@/components/site/site-content";
import {
  VentureAdventureList,
  type VentureAdventureItem,
} from "@/components/venture/venture-adventure-list";
import { getAllVentureEntries } from "@/lib/venture-entries";
import { formatOccurrence } from "@/lib/venture-format";
import { formatNationalParkName, getAllNationalParks } from "@/lib/venture-parks";
import { getCompletedNortheastPeaks } from "@/lib/venture-trails";
import { getAllTravelDestinations } from "@/lib/venture-travels";

export const metadata: Metadata = {
  title: "index | venture",
  description: "A complete index of Venture field notes.",
};

export default async function VentureIndexPage() {
  const entries = await getAllVentureEntries();
  const peaks = getCompletedNortheastPeaks();
  const parks = getAllNationalParks().filter((park) => park.visited);
  const destinations = getAllTravelDestinations();
  const linkedEntrySlugs = new Set<string>();
  const items: VentureAdventureItem[] = [];

  for (const peak of peaks) {
    for (const ascent of peak.ascents) {
      if (ascent.entrySlug) linkedEntrySlugs.add(ascent.entrySlug);
      items.push({
        id: `peak:${peak.slug}:${ascent.ordinal}`,
        title: peak.name,
        href: `/venture/trails/${peak.slug}`,
        date: ascent.date,
        location: `${peak.range}, ${peak.state}`,
        occurrenceLabel: formatOccurrence(ascent.ordinal, "ascent"),
        ...(ascent.entrySlug ? { journalHref: `/venture/${ascent.entrySlug}` } : {}),
      });
    }
  }

  for (const park of parks) {
    park.visits.forEach((visit, index) => {
      if (visit.entrySlug) linkedEntrySlugs.add(visit.entrySlug);
      items.push({
        id: `park:${park.slug}:${index + 1}`,
        title: formatNationalParkName(park.name),
        href: `/venture/parks/${park.slug}`,
        date: visit.date,
        location: park.stateOrTerritory,
        occurrenceLabel: formatOccurrence(index + 1, "visit"),
        ...(visit.entrySlug ? { journalHref: `/venture/${visit.entrySlug}` } : {}),
      });
    });
  }

  for (const destination of destinations) {
    for (const visit of destination.visits) {
      if (visit.entrySlug) linkedEntrySlugs.add(visit.entrySlug);
      items.push({
        id: `travel:${destination.slug}:${visit.ordinal}`,
        title: destination.name,
        href: `/venture/travels/${destination.slug}`,
        date: visit.date,
        location: destination.region,
        occurrenceLabel: formatOccurrence(visit.ordinal, "visit"),
        ...(visit.entrySlug ? { journalHref: `/venture/${visit.entrySlug}` } : {}),
      });
    }
  }

  for (const entry of entries) {
    if (linkedEntrySlugs.has(entry.slug)) continue;
    items.push({
      id: `journal:${entry.slug}`,
      title: entry.title,
      href: `/venture/${entry.slug}`,
      date: entry.date,
      location: entry.location,
      occurrenceLabel: "journal entry",
      excerpt: entry.excerpt,
      music: entry.music,
    });
  }

  return (
    <VentureShell title="index">
      <p className="font-serif text-stone-500">Every recorded adventure, whether or not it becomes a journal entry.</p>
      <div className="not-prose mt-10">
        <VentureAdventureList items={items} />
      </div>
    </VentureShell>
  );
}
