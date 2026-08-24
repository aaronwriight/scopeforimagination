import type { Metadata } from "next";
import { VentureShell } from "@/components/site/site-content";
import { NationalParksIndex } from "@/components/venture/national-parks-index";
import {
  formatNationalParkName,
  getAllNationalParks,
  getNationalParkStates,
  nationalParkBoundaries,
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

  return (
    <VentureShell title="national parks">
      <p className="font-serif text-stone-500">A by-park index for visits and their memories</p>
      <NationalParksIndex
        parks={parks}
        boundaries={nationalParkBoundaries}
        boundarySourceUrl={nationalParkBoundarySourceUrl}
      />
    </VentureShell>
  );
}
