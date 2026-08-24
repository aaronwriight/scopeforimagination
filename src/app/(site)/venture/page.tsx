import type { Metadata } from "next";
import Link from "next/link";
import {
  VentureGlobe,
  type VentureMapCountry,
  type VentureMapEntry,
} from "@/components/venture/venture-globe";
import { VentureShell } from "@/components/site/site-content";
import { getAllVentureEntries } from "@/lib/venture-entries";
import {
  formatNationalParkName,
  getAllNationalParks,
} from "@/lib/venture-parks";
import { getAllNortheastPeaks } from "@/lib/venture-trails";
import { getAllTravelDestinations } from "@/lib/venture-travels";

export const metadata: Metadata = {
  title: "venture | aaron wright",
  description: "A field journal for peaks, parks, and stories gathered along the way.",
};

export default async function VenturePage() {
  const entries = await getAllVentureEntries();
  const peaks = getAllNortheastPeaks();
  const parks = getAllNationalParks();
  const travelDestinations = getAllTravelDestinations();
  const completedPeaks = peaks.filter((peak) => peak.completed);
  const visitedParks = parks.filter((park) => park.visited);
  const mapCountries: VentureMapCountry[] = [
    { id: "840", title: "United States" },
    { id: "352", title: "Iceland" },
    { id: "792", title: "Türkiye" },
    { id: "116", title: "Cambodia" },
  ];

  const mapEntries: VentureMapEntry[] = [
    ...entries.map((entry) => ({
      id: `entry:${entry.slug}`,
      title: entry.title,
      href: `/venture/${entry.slug}`,
      location: entry.location,
      latitude: entry.latitude,
      longitude: entry.longitude,
      kind: "entry" as const,
    })),
    ...completedPeaks.map((peak) => ({
      id: `trail:${peak.slug}`,
      title: peak.name,
      href: `/venture/trails/${peak.slug}`,
      location: `${peak.range}, ${peak.state}`,
      latitude: peak.latitude,
      longitude: peak.longitude,
      kind: "peak" as const,
      group: peak.range,
    })),
    ...visitedParks.map((park) => ({
      id: `park:${park.slug}`,
      title: formatNationalParkName(park.name),
      href: `/venture/parks/${park.slug}`,
      location: park.stateOrTerritory,
      latitude: park.latitude,
      longitude: park.longitude,
      kind: "park" as const,
    })),
    ...travelDestinations.map((destination) => ({
      id: `travel:${destination.slug}`,
      title: destination.name,
      href: `/venture/travels/${destination.slug}`,
      location: destination.region,
      latitude: destination.latitude,
      longitude: destination.longitude,
      kind: "travel" as const,
    })),
  ];
  return (
    <VentureShell title="venture">
      <p className="text-stone-500">an atlas of places worth remembering</p>
      <p>A field journal for peaks, parks, and stories gathered along the way.</p>

      <VentureGlobe entries={mapEntries} countries={mapCountries} />

      <section className="not-prose grid gap-5 sm:grid-cols-3">
        <Link href="/venture/trails" className="border-t border-stone-300 pt-4 dark:border-stone-700">
          <p className="m-0 text-xs lowercase tracking-widest text-[#859900]">northeast 115</p>
          <p className="mt-3 text-xs text-stone-500">browse peaks →</p>
        </Link>
        <Link href="/venture/parks" className="border-t border-stone-300 pt-4 dark:border-stone-700">
          <p className="m-0 text-xs lowercase tracking-widest text-[#859900]">63 national parks</p>
          <p className="mt-3 text-xs text-stone-500">browse parks →</p>
        </Link>
        <Link href="/venture/travels" className="border-t border-stone-300 pt-4 dark:border-stone-700">
          <p className="m-0 text-xs lowercase tracking-widest text-[#859900]">international travels</p>
          <p className="mt-3 text-xs text-stone-500">browse travels →</p>
        </Link>
      </section>

      <p className="text-xs text-stone-500">
        Looking for the stories? <Link href="/venture/index">Open the adventure index →</Link>
      </p>
    </VentureShell>
  );
}
