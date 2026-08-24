"use client";

import {
  geoCircle,
  geoMercator,
  geoPath,
  type GeoGeometryObjects,
} from "d3";
import Link from "next/link";
import { useMemo, useState } from "react";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { CompletionStatus } from "@/components/venture/completion-status";
import type { NortheastPeak, NortheastRangeArea } from "@/lib/venture-trails";

const mapWidth = 960;
const mapHeight = 440;
const markerGreen = "#859900";
const northeastBounds = {
  type: "Polygon",
  coordinates: [
    [
      [-75.8, 40.35],
      [-66.6, 40.35],
      [-66.6, 47.5],
      [-75.8, 47.5],
      [-75.8, 40.35],
    ],
  ],
} as GeoGeometryObjects;

type SortOrder = "ascending" | "descending";

function NortheastMap({
  peaks,
  rangeAreas,
}: {
  peaks: readonly NortheastPeak[];
  rangeAreas: readonly NortheastRangeArea[];
}) {
  const projection = geoMercator().fitExtent(
    [
      [54, 28],
      [mapWidth - 54, mapHeight - 34],
    ],
    northeastBounds,
  );
  const path = geoPath(projection);
  const topology = world as unknown as Parameters<typeof feature>[0];
  const countries = feature(topology, topology.objects.countries);
  const countryFeatures = countries.type === "FeatureCollection" ? countries.features : [countries];

  return (
    <figure className="not-prose m-0 mt-9 w-full">
      <div className="overflow-hidden border border-stone-200 bg-white dark:border-stone-700">
        <svg
          className="block h-auto w-full bg-white"
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          role="img"
          aria-labelledby="northeast-map-title northeast-map-description"
        >
          <title id="northeast-map-title">Northeast 115 peak map</title>
          <desc id="northeast-map-description">
            A map of the Northeast with recorded summits in green and their mountain ranges softly highlighted.
          </desc>

          <g aria-hidden="true">
            {countryFeatures.map((country, index) => (
              <path
                key={String(country.id ?? index)}
                d={path(country) ?? undefined}
                fill="#f4f2ec"
                stroke="#d6d3d1"
                strokeWidth={1.1}
              />
            ))}
          </g>

          <g aria-label="Ranges containing recorded summits">
            {rangeAreas.map((area) => {
              const circle = geoCircle()
                .center([area.longitude, area.latitude])
                .radius(area.radiusDegrees)();

              return (
                <path
                  key={area.name}
                  d={path(circle) ?? undefined}
                  fill={markerGreen}
                  fillOpacity={0.1}
                  stroke={markerGreen}
                  strokeOpacity={0.32}
                  strokeWidth={1.25}
                >
                  <title>
                    {area.name}: {area.completedPeakCount} recorded {area.completedPeakCount === 1 ? "summit" : "summits"}
                  </title>
                </path>
              );
            })}
          </g>

          <g aria-label="Northeast 115 peaks">
            {peaks.map((peak) => {
              const coordinates = projection([peak.longitude, peak.latitude]);
              if (!coordinates) return null;

              return (
                <Link
                  key={peak.slug}
                  href={`/venture/trails/${peak.slug}`}
                  aria-label={`${peak.name}, ${peak.completed ? "climbed" : "not yet climbed"}`}
                >
                  <circle
                    cx={coordinates[0]}
                    cy={coordinates[1]}
                    r={peak.completed ? 5.3 : 2.7}
                    fill={peak.completed ? markerGreen : "#c9c5bc"}
                    fillOpacity={peak.completed ? 1 : 0.72}
                    stroke="#ffffff"
                    strokeWidth={peak.completed ? 1.8 : 1}
                    className="transition-[r,fill-opacity] hover:fill-opacity-80"
                  >
                    <title>
                      {peak.name} · {peak.range} · {peak.completed ? "climbed" : "not yet climbed"}
                    </title>
                  </circle>
                </Link>
              );
            })}
          </g>
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[0.68rem] text-stone-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#859900]" aria-hidden="true" />
          climbed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-300" aria-hidden="true" />
          not yet climbed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 border border-[#859900]/40 bg-[#859900]/10" aria-hidden="true" />
          ranges with recorded summits
        </span>
      </figcaption>
    </figure>
  );
}

export function Northeast115Index({
  peaks,
  rangeAreas,
}: {
  peaks: readonly NortheastPeak[];
  rangeAreas: readonly NortheastRangeArea[];
}) {
  const [state, setState] = useState("all");
  const [range, setRange] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("ascending");

  const states = useMemo(
    () => [...new Set(peaks.map((peak) => peak.state))].sort(),
    [peaks],
  );
  const ranges = useMemo(
    () => [...new Set(peaks.map((peak) => peak.range))].sort(),
    [peaks],
  );
  const visiblePeaks = useMemo(
    () =>
      peaks
        .filter((peak) => state === "all" || peak.state === state)
        .filter((peak) => range === "all" || peak.range === range)
        .toSorted((first, second) => {
          const comparison = first.name.localeCompare(second.name);
          return sortOrder === "ascending" ? comparison : -comparison;
        }),
    [peaks, range, sortOrder, state],
  );

  const controlClassName =
    "mt-1 w-full border border-stone-300 bg-white px-3 py-2 font-serif text-sm text-stone-700 outline-none transition-colors focus:border-[#859900] dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300";

  return (
    <>
      <NortheastMap peaks={peaks} rangeAreas={rangeAreas} />

      <div className="not-prose mt-10 grid gap-4 sm:grid-cols-3">
        <label className="text-[0.65rem] lowercase tracking-widest text-stone-500">
          state
          <select value={state} onChange={(event) => setState(event.target.value)} className={controlClassName}>
            <option value="all">all states</option>
            {states.map((stateName) => (
              <option key={stateName} value={stateName}>{stateName}</option>
            ))}
          </select>
        </label>
        <label className="text-[0.65rem] lowercase tracking-widest text-stone-500">
          range
          <select value={range} onChange={(event) => setRange(event.target.value)} className={controlClassName}>
            <option value="all">all ranges</option>
            {ranges.map((rangeName) => (
              <option key={rangeName} value={rangeName}>{rangeName}</option>
            ))}
          </select>
        </label>
        <label className="text-[0.65rem] lowercase tracking-widest text-stone-500">
          sort
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className={controlClassName}
          >
            <option value="ascending">A–Z</option>
            <option value="descending">Z–A</option>
          </select>
        </label>
      </div>

      <p className="not-prose mt-4 text-xs tabular-nums text-stone-500" aria-live="polite">
        {visiblePeaks.length} {visiblePeaks.length === 1 ? "peak" : "peaks"}
      </p>

      <div className="not-prose mt-5 border-t border-stone-300 dark:border-stone-700">
        {visiblePeaks.map((peak) => (
          <Link
            key={peak.slug}
            href={`/venture/trails/${peak.slug}`}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-300 py-4 text-stone-700 transition-colors hover:text-[#6f8200] dark:border-stone-700 dark:text-stone-300"
          >
            <span className="text-xs tabular-nums text-stone-400">{String(peak.rank).padStart(3, "0")}</span>
            <span>
              <span className="block font-serif text-sm text-current">{peak.name}</span>
              <span className="mt-0.5 block text-[0.68rem] text-stone-500">
                {peak.range} · {peak.stateAbbreviation}
              </span>
            </span>
            <span className="flex items-center gap-3 text-xs tabular-nums text-stone-500">
              <span>{peak.elevationFeet.toLocaleString()} ft</span>
              <CompletionStatus
                complete={peak.completed}
                completeLabel="climbed"
                incompleteLabel="not yet climbed"
              />
            </span>
          </Link>
        ))}
        {visiblePeaks.length === 0 && (
          <p className="border-b border-stone-300 py-8 font-serif text-sm italic text-stone-500 dark:border-stone-700">
            No peaks match those filters.
          </p>
        )}
      </div>
    </>
  );
}
