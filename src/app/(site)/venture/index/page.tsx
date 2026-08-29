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
    peak.ascents.forEach((ascent) => {
      if (ascent.entrySlug) linkedEntrySlugs.add(ascent.entrySlug);
    });
    items.push({
      id: `peak:${peak.slug}`,
      title: peak.name,
      href: `/venture/trails/${peak.slug}`,
      kind: "peak",
      location: `${peak.range}, ${peak.state}`,
      records: peak.ascents.map((ascent) => ({
        id: `ascent:${ascent.ordinal}`,
        label: formatOccurrence(ascent.ordinal, "ascent"),
        date: ascent.date,
        trip: ascent.trip,
        ...(ascent.entrySlug ? { journalHref: `/venture/${ascent.entrySlug}` } : {}),
      })),
    });
  }

  for (const park of parks) {
    park.visits.forEach((visit) => {
      if (visit.entrySlug) linkedEntrySlugs.add(visit.entrySlug);
    });
    items.push({
      id: `park:${park.slug}`,
      title: formatNationalParkName(park.name),
      href: `/venture/parks/${park.slug}`,
      kind: "park",
      location: park.stateOrTerritory,
      records: park.visits.map((visit, index) => ({
        id: `visit:${index + 1}`,
        label: formatOccurrence(index + 1, "visit"),
        date: visit.date,
        trip: visit.trip,
        ...(visit.entrySlug ? { journalHref: `/venture/${visit.entrySlug}` } : {}),
      })),
    });
  }

  for (const destination of destinations) {
    destination.visits.forEach((visit) => {
      if (visit.entrySlug) linkedEntrySlugs.add(visit.entrySlug);
    });
    items.push({
      id: `travel:${destination.slug}`,
      title: destination.name,
      href: `/venture/travels/${destination.slug}`,
      kind: "travel",
      location: destination.region,
      records: destination.visits.map((visit) => ({
        id: `visit:${visit.ordinal}`,
        label: formatOccurrence(visit.ordinal, "visit"),
        date: visit.date,
        trip: visit.trip,
        ...(visit.entrySlug ? { journalHref: `/venture/${visit.entrySlug}` } : {}),
      })),
    });
  }

  for (const entry of entries) {
    if (linkedEntrySlugs.has(entry.slug)) continue;
    items.push({
      id: `journal:${entry.slug}`,
      title: entry.subtitle,
      href: `/venture/${entry.slug}`,
      kind: "journal",
      location: entry.location,
      entry: entry.entry,
      time: entry.time,
      records: [{
        id: "journal-entry",
        label: "journal entry",
        date: entry.date,
        trip: entry.trip,
      }],
      excerpt: entry.excerpt,
      music: entry.music,
    });
  }

  return (
    <VentureShell title="index" subtitle="every adventure recorded">
      <div className="not-prose">
        <VentureAdventureList items={items} />
      </div>
    </VentureShell>
  );
}
