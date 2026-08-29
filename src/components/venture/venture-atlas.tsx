"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";
import type { TravelMapDestination } from "@/components/venture/international-travels-map";
import type { NationalParkIndexItem } from "@/components/venture/national-parks-index";
import { VentureViewSelector, type VentureView } from "@/components/venture/venture-view-selector";
import type { NationalParkBoundaryFeature } from "@/lib/venture-parks";
import type { NortheastPeak, NortheastRangeArea } from "@/lib/venture-trails";

function AtlasMapLoading() {
  return (
    <div className="flex aspect-[56/33] items-center justify-center border border-stone-200 bg-white font-serif text-xs italic text-stone-400 dark:border-stone-700 dark:bg-stone-950">
      loading map…
    </div>
  );
}

const InternationalTravelsMap = dynamic(
  () => import("@/components/venture/international-travels-map").then((module) => module.InternationalTravelsMap),
  { loading: AtlasMapLoading },
);
const NationalParksMap = dynamic(
  () => import("@/components/venture/national-parks-index").then((module) => module.NationalParksMap),
  { loading: AtlasMapLoading },
);
const Northeast115Map = dynamic(
  () => import("@/components/venture/northeast-115-index").then((module) => module.Northeast115Map),
  { loading: AtlasMapLoading },
);

export function VentureAtlas({
  destinations,
  parks,
  parkBoundaries,
  parkBoundarySourceUrl,
  peaks,
  rangeAreas,
}: {
  destinations: readonly TravelMapDestination[];
  parks: readonly NationalParkIndexItem[];
  parkBoundaries: readonly NationalParkBoundaryFeature[];
  parkBoundarySourceUrl: string;
  peaks: readonly NortheastPeak[];
  rangeAreas: readonly NortheastRangeArea[];
}) {
  const [view, setView] = useState<VentureView>("travels");
  const mapPanelId = useId();

  return (
    <section className="not-prose w-full" aria-label="Venture atlas">
      <VentureViewSelector
        value={view}
        onChange={setView}
        label="Choose an atlas view"
        controlsId={mapPanelId}
      />

      <div id={mapPanelId} className="mt-6">
        {view === "peaks" && (
          <Northeast115Map peaks={peaks} rangeAreas={rangeAreas} variant="atlas" />
        )}
        {view === "parks" && (
          <NationalParksMap
            parks={parks}
            boundaries={parkBoundaries}
            boundarySourceUrl={parkBoundarySourceUrl}
            variant="atlas"
          />
        )}
        {view === "travels" && (
          <InternationalTravelsMap destinations={destinations} variant="atlas" />
        )}
      </div>
    </section>
  );
}
