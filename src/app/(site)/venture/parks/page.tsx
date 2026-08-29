import type { Metadata } from "next";
import { VentureShell } from "@/components/site/site-content";
import { NationalParksIndex } from "@/components/venture/national-parks-index";
import {
  formatNationalParkName,
  getAllNationalParks,
  getNationalParkBoundaries,
  getNationalParkStates,
  nationalParkBoundarySourceUrl,
} from "@/lib/venture-parks";

export const metadata: Metadata = {
  title: "national parks | venture",
  description: "A by-park index for visits and their memories.",
};

export default function VentureParksPage() {
  const parks = getAllNationalParks().map((park) => ({
    ...park,
    displayName: formatNationalParkName(park.name),
    states: getNationalParkStates(park),
  }));
  const boundaries = getNationalParkBoundaries();

  return (
    <VentureShell title="national parks" subtitle="a by-park index for visits and their memories">
      <NationalParksIndex
        parks={parks}
        boundaries={boundaries}
        boundarySourceUrl={nationalParkBoundarySourceUrl}
      />
    </VentureShell>
  );
}
