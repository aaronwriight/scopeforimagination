"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { TravelMapDestination } from "@/components/venture/international-travels-map";
import type { NationalParkIndexItem } from "@/components/venture/national-parks-index";
import type { NationalParkBoundaryFeature } from "@/lib/venture-parks";
import type { NortheastPeak, NortheastRangeArea } from "@/lib/venture-trails";

type AtlasView = "peaks" | "parks" | "travels";

const atlasViews: readonly Readonly<{
  id: AtlasView;
  label: string;
  description: string;
}>[] = [
  { id: "peaks", label: "northeast 115", description: "peaks and ranges across the northeast" },
  { id: "parks", label: "national parks", description: "parks across the united states" },
  { id: "travels", label: "travels", description: "countries & journeys" },
];

function AtlasMapLoading() {
  return (
    <div className="flex aspect-[56/33] items-center justify-center border border-stone-200 bg-white font-serif text-xs italic text-stone-400 dark:border-stone-700">
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
  const [view, setView] = useState<AtlasView>("peaks");

  return (
    <section className="not-prose w-full" aria-label="Venture atlas">
      <div className="grid grid-cols-3 gap-4" aria-label="Choose an atlas view">
        {atlasViews.map((atlasView) => {
          const active = atlasView.id === view;

          return (
            <button
              key={atlasView.id}
              type="button"
              aria-pressed={active}
              onClick={() => setView(atlasView.id)}
              className={`cursor-pointer border-t-2 pt-3 text-left transition-[color,border-color,opacity] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#859900] ${
                active
                  ? "border-[#859900] text-[#6f8200] opacity-100"
                  : "border-stone-300 text-stone-500 opacity-80 hover:border-stone-400 hover:text-stone-700 hover:opacity-100 dark:border-stone-700 dark:text-stone-400 dark:hover:text-stone-300"
              }`}
            >
              <span className="block text-[0.68rem] lowercase tracking-widest">
                {atlasView.label}
              </span>
              <span className={`mt-2 hidden font-serif text-xs sm:block ${active ? "text-stone-600 dark:text-stone-400" : "text-stone-500"}`}>
                {atlasView.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
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
