"use client";

import { geoAlbersUsa, geoPath, type GeoGeometryObjects } from "d3";
import Link from "next/link";
import { useMemo, useState } from "react";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { CompletionStatus } from "@/components/venture/completion-status";
import type { NationalPark, NationalParkBoundaryFeature } from "@/lib/venture-parks";

const mapWidth = 960;
const mapHeight = 540;
const markerGreen = "#859900";

type SortOrder = "ascending" | "descending";

export type NationalParkIndexItem = NationalPark &
  Readonly<{
    displayName: string;
    states: readonly string[];
  }>;

function NationalParksMap({
  parks,
  boundaries,
  boundarySourceUrl,
}: {
  parks: readonly NationalParkIndexItem[];
  boundaries: readonly NationalParkBoundaryFeature[];
  boundarySourceUrl: string;
}) {
  const topology = world as unknown as Parameters<typeof feature>[0];
  const countries = feature(topology, topology.objects.countries);
  const countryFeatures = countries.type === "FeatureCollection" ? countries.features : [countries];
  const unitedStates = countryFeatures.find((country) => String(country.id) === "840");
  const projection = geoAlbersUsa();

  if (unitedStates) {
    projection.fitExtent(
      [
        [42, 24],
        [mapWidth - 42, mapHeight - 38],
      ],
      unitedStates,
    );
  }

  const path = geoPath(projection);

  return (
    <figure className="not-prose m-0 mt-9 w-full">
      <div className="overflow-hidden border border-stone-200 bg-white dark:border-stone-700">
        <svg
          className="block h-auto w-full bg-white"
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          role="img"
          aria-labelledby="national-parks-map-title national-parks-map-description"
        >
          <title id="national-parks-map-title">United States national parks map</title>
          <desc id="national-parks-map-description">
            A map of the United States with six visited national parks highlighted in solarized green.
          </desc>

          {unitedStates && (
            <path
              d={path(unitedStates) ?? undefined}
              fill="#f4f2ec"
              stroke="#c9c5bc"
              strokeWidth={1.2}
              aria-hidden="true"
            />
          )}

          <g aria-label="Visited national park boundaries">
            {boundaries.map((boundary) => (
              <Link
                key={boundary.id}
                href={boundary.properties.href}
                aria-label={`${boundary.properties.title}, ${boundary.properties.location}`}
              >
                <path
                  d={path(boundary as unknown as GeoGeometryObjects) ?? undefined}
                  fill={markerGreen}
                  fillOpacity={0.32}
                  stroke={markerGreen}
                  strokeOpacity={0.95}
                  strokeWidth={1.5}
                >
                  <title>{boundary.properties.title} · visited</title>
                </path>
              </Link>
            ))}
          </g>

          <g aria-label="National park locations">
            {parks.map((park) => {
              const coordinates = projection([park.longitude, park.latitude]);
              if (!coordinates) return null;

              return (
                <Link
                  key={park.slug}
                  href={`/venture/parks/${park.slug}`}
                  aria-label={`${park.displayName}, ${park.visited ? "visited" : "not yet visited"}`}
                >
                  <circle
                    cx={coordinates[0]}
                    cy={coordinates[1]}
                    r={park.visited ? 5.2 : 2.8}
                    fill={park.visited ? markerGreen : "#c9c5bc"}
                    fillOpacity={park.visited ? 1 : 0.72}
                    stroke="#ffffff"
                    strokeWidth={park.visited ? 1.9 : 1}
                    className="transition-[r,fill-opacity] hover:fill-opacity-80"
                  >
                    <title>{park.displayName} · {park.visited ? "visited" : "not yet visited"}</title>
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
          visited
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-300" aria-hidden="true" />
          not yet visited
        </span>
        <a href={boundarySourceUrl} target="_blank" rel="noreferrer" className="text-[#6f8200]">
          boundaries: NPS Land Resources Division ↗
        </a>
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer" className="text-[#6f8200]">
          base map: Natural Earth ↗
        </a>
      </figcaption>
    </figure>
  );
}

export function NationalParksIndex({
  parks,
  boundaries,
  boundarySourceUrl,
}: {
  parks: readonly NationalParkIndexItem[];
  boundaries: readonly NationalParkBoundaryFeature[];
  boundarySourceUrl: string;
}) {
  const [state, setState] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("ascending");

  const states = useMemo(
    () => [...new Set(parks.flatMap((park) => park.states))].sort((first, second) => first.localeCompare(second)),
    [parks],
  );
  const alphabeticRanks = useMemo(
    () =>
      new Map(
        [...parks]
          .sort((first, second) => first.displayName.localeCompare(second.displayName))
          .map((park, index) => [park.slug, index + 1]),
      ),
    [parks],
  );
  const visibleParks = useMemo(
    () =>
      parks
        .filter((park) => state === "all" || park.states.includes(state))
        .toSorted((first, second) => {
          const comparison = first.displayName.localeCompare(second.displayName);
          return sortOrder === "ascending" ? comparison : -comparison;
        }),
    [parks, sortOrder, state],
  );

  const controlClassName =
    "mt-1 w-full border border-stone-300 bg-white px-3 py-2 font-serif text-sm text-stone-700 outline-none transition-colors focus:border-[#859900] dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300";

  return (
    <>
      <NationalParksMap parks={parks} boundaries={boundaries} boundarySourceUrl={boundarySourceUrl} />

      <div className="not-prose mt-10 grid gap-4 sm:grid-cols-2">
        <label className="text-[0.65rem] lowercase tracking-widest text-stone-500">
          state
          <select value={state} onChange={(event) => setState(event.target.value)} className={controlClassName}>
            <option value="all">all states &amp; territories</option>
            {states.map((stateName) => (
              <option key={stateName} value={stateName}>{stateName}</option>
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
        {visibleParks.length} {visibleParks.length === 1 ? "park" : "parks"}
      </p>

      <div className="not-prose mt-5 border-t border-stone-300 dark:border-stone-700">
        {visibleParks.map((park) => (
          <Link
            key={park.slug}
            href={`/venture/parks/${park.slug}`}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-300 py-4 text-stone-700 transition-colors hover:text-[#6f8200] dark:border-stone-700 dark:text-stone-300"
          >
            <span className="text-xs tabular-nums text-stone-400">
              {String(alphabeticRanks.get(park.slug) ?? 0).padStart(2, "0")}
            </span>
            <span>
              <span className="block font-serif text-sm text-current">{park.displayName}</span>
              <span className="mt-0.5 block text-[0.68rem] text-stone-500">{park.stateOrTerritory}</span>
            </span>
            <CompletionStatus complete={park.visited} completeLabel="visited" incompleteLabel="not yet visited" />
          </Link>
        ))}
        {visibleParks.length === 0 && (
          <p className="border-b border-stone-300 py-8 font-serif text-sm italic text-stone-500 dark:border-stone-700">
            No parks match that filter.
          </p>
        )}
      </div>
    </>
  );
}
