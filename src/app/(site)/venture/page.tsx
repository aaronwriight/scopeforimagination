import type { Metadata } from "next";
import Link from "next/link";
import { VentureGlobe, type VentureMapEntry } from "@/components/venture/venture-globe";
import { VentureShell } from "@/components/site/site-content";
import { getAllVentureEntries } from "@/lib/venture-entries";
import { getAllNationalParks } from "@/lib/venture-parks";
import { getAllNortheastPeaks } from "@/lib/venture-trails";

export const metadata: Metadata = {
  title: "venture | aaron wright",
  description: "An atlas and field journal for hikes, trips, peaks, and national parks.",
};

export default async function VenturePage() {
  const entries = await getAllVentureEntries();
  const peaks = getAllNortheastPeaks();
  const parks = getAllNationalParks();
  const completedPeaks = peaks.filter((peak) => peak.completed);
  const visitedParks = parks.filter((park) => park.visited);

  const mapEntries: VentureMapEntry[] = [
    ...entries.map((entry) => ({
      id: `entry:${entry.slug}`,
      title: entry.title,
      href: `/venture/${entry.slug}`,
      location: entry.location,
      latitude: entry.latitude,
      longitude: entry.longitude,
    })),
    ...completedPeaks.map((peak) => ({
      id: `trail:${peak.slug}`,
      title: peak.name,
      href: `/venture/trails/${peak.slug}`,
      location: `${peak.range}, ${peak.state}`,
      latitude: peak.latitude,
      longitude: peak.longitude,
    })),
    ...visitedParks.map((park) => ({
      id: `park:${park.slug}`,
      title: park.name,
      href: `/venture/parks/${park.slug}`,
      location: park.stateOrTerritory,
      latitude: park.latitude,
      longitude: park.longitude,
    })),
  ];

  return (
    <VentureShell title="venture">
      <p className="text-stone-500">an atlas of places worth remembering</p>
      <p>
        Venture is a field journal for hikes, trips, and the stories gathered along the way—including a path toward the Northeast 115
        and all 63 U.S. national parks.
      </p>

      <section>
        <p className="m-0 font-medium">the atlas</p>
        <div className="mt-3">
          <VentureGlobe entries={mapEntries} />
        </div>
      </section>

      <section className="not-prose grid gap-5 sm:grid-cols-2">
        <Link href="/venture/trails" className="border-t border-stone-300 pt-4 dark:border-stone-700">
          <p className="m-0 text-xs lowercase tracking-widest text-[#859900]">northeast 115</p>
          <p className="mt-1 font-serif text-sm text-stone-600 dark:text-stone-400">
            {completedPeaks.length} / {peaks.length} summits recorded
          </p>
          <p className="mt-3 text-xs text-stone-500">browse trails →</p>
        </Link>
        <Link href="/venture/parks" className="border-t border-stone-300 pt-4 dark:border-stone-700">
          <p className="m-0 text-xs lowercase tracking-widest text-[#859900]">63 national parks</p>
          <p className="mt-1 font-serif text-sm text-stone-600 dark:text-stone-400">
            {visitedParks.length > 0 ? `${visitedParks.length} parks recorded` : "the park log is ready"}
          </p>
          <p className="mt-3 text-xs text-stone-500">browse parks →</p>
        </Link>
      </section>

      <p className="text-xs text-stone-500">
        Looking for the stories? <Link href="/venture/index">Open the field-note index →</Link>
      </p>
    </VentureShell>
  );
}
