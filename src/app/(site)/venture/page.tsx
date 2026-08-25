import type { Metadata } from "next";
import { VentureShell } from "@/components/site/site-content";
import { VentureAtlas } from "@/components/venture/venture-atlas";
import {
  formatNationalParkName,
  getAllNationalParks,
  getNationalParkStates,
  nationalParkBoundaries,
  nationalParkBoundarySourceUrl,
} from "@/lib/venture-parks";
import {
  getAllNortheastRangeAreas,
  getCompletedNortheastPeaks,
} from "@/lib/venture-trails";
import { getAllTravelDestinations } from "@/lib/venture-travels";

export const metadata: Metadata = {
  title: "venture | aaron wright",
  description: "A field journal for peaks, parks, and stories gathered along the way.",
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

  return (
    <VentureShell title="venture">
      <p className="text-stone-500">an atlas of places worth remembering</p>
      <p>A field journal for peaks, parks, and stories gathered along the way.</p>

      <VentureAtlas
        destinations={travelDestinations}
        parks={visitedParks}
        parkBoundaries={nationalParkBoundaries}
        parkBoundarySourceUrl={nationalParkBoundarySourceUrl}
        peaks={completedPeaks}
        rangeAreas={rangeAreas}
      />
    </VentureShell>
  );
}
