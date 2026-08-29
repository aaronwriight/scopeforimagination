import type { Metadata } from "next";
import { VentureShell } from "@/components/site/site-content";
import { VentureAtlas } from "@/components/venture/venture-atlas";
import {
  formatNationalParkName,
  getAllNationalParks,
  getNationalParkBoundaries,
  getNationalParkStates,
  nationalParkBoundarySourceUrl,
} from "@/lib/venture-parks";
import {
  getAllNortheastRangeAreas,
  getCompletedNortheastPeaks,
} from "@/lib/venture-trails";
import { getAllTravelDestinations } from "@/lib/venture-travels";

export const metadata: Metadata = {
  title: "venture | aaron wright",
  description: "A field journal for peaks, parks, and places worth remembering.",
};

export default function VenturePage() {
  const completedPeaks = getCompletedNortheastPeaks();
  const rangeAreas = getAllNortheastRangeAreas();
  const visitedParks = getAllNationalParks()
    .filter((park) => park.visited)
    .map((park) => ({
      ...park,
      displayName: formatNationalParkName(park.name),
      states: getNationalParkStates(park),
    }));
  const travelDestinations = getAllTravelDestinations();
  const parkBoundaries = getNationalParkBoundaries();

  return (
    <VentureShell title="venture" subtitle="a field journal for peaks, parks, and places worth remembering">
      <VentureAtlas
        destinations={travelDestinations}
        parks={visitedParks}
        parkBoundaries={parkBoundaries}
        parkBoundarySourceUrl={nationalParkBoundarySourceUrl}
        peaks={completedPeaks}
        rangeAreas={rangeAreas}
      />
    </VentureShell>
  );
}
