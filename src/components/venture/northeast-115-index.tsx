"use client";

import {
  geoCircle,
  geoMercator,
  geoPath,
  select,
  zoom,
  zoomIdentity,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import statesAtlas from "us-atlas/states-10m.json";
import { CompletionStatus } from "@/components/venture/completion-status";
import type { NortheastPeak, NortheastRangeArea } from "@/lib/venture-trails";

const mapWidth = 960;
const mapHeight = 600;
const markerGreen = "#859900";
const northeastStateIds = new Set(["23", "33", "36", "50"]);

type SortOrder = "ascending" | "descending";
type MapControl = "zoom-in" | "zoom-out" | "reset";

function NortheastMap({
  peaks,
  rangeAreas,
}: {
  peaks: readonly NortheastPeak[];
  rangeAreas: readonly NortheastRangeArea[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [mapTransform, setMapTransform] = useState<ZoomTransform>(zoomIdentity);
  const [activePeak, setActivePeak] = useState<string | null>(null);

  const { northeastStates, path, projection } = useMemo(() => {
    const topology = statesAtlas as unknown as Parameters<typeof feature>[0];
    const states = feature(topology, topology.objects.states);
    const allStates = states.type === "FeatureCollection" ? states.features : [states];
    const selectedStates = allStates.filter((state) => northeastStateIds.has(String(state.id)));
    const selectedStateCollection = {
      type: "FeatureCollection" as const,
      features: selectedStates,
    };
    const nextProjection = geoMercator().fitExtent(
      [
        [62, 36],
        [mapWidth - 62, mapHeight - 42],
      ],
      selectedStateCollection,
    );

    return {
      northeastStates: selectedStates,
      path: geoPath(nextProjection),
      projection: nextProjection,
    };
  }, []);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 16])
      .extent([
        [0, 0],
        [mapWidth, mapHeight],
      ])
      .translateExtent([
        [-mapWidth * 0.4, -mapHeight * 0.4],
        [mapWidth * 1.4, mapHeight * 1.4],
      ])
      .on("zoom", (event) => setMapTransform(event.transform));

    zoomBehaviorRef.current = zoomBehavior;
    select(element).call(zoomBehavior);

    return () => {
      select(element).on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  const controlMap = (control: MapControl) => {
    const element = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!element || !zoomBehavior) return;

    const selection = select(element);
    if (control === "zoom-in") selection.call(zoomBehavior.scaleBy, 1.6);
    else if (control === "zoom-out") selection.call(zoomBehavior.scaleBy, 1 / 1.6);
    else selection.call(zoomBehavior.transform, zoomIdentity);
  };

  const moveMap = (horizontal: number, vertical: number) => {
    const element = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!element || !zoomBehavior) return;
    select(element).call(zoomBehavior.translateBy, horizontal, vertical);
  };

  return (
    <figure className="not-prose m-0 mt-9 w-full">
      <div className="relative overflow-hidden border border-stone-200 bg-white dark:border-stone-700">
        <svg
          ref={svgRef}
          className="block h-auto w-full touch-none select-none bg-white outline-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none"
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          role="application"
          tabIndex={0}
          aria-labelledby="northeast-map-title northeast-map-description"
          onKeyDown={(event) => {
            if (event.key === "+" || event.key === "=") controlMap("zoom-in");
            else if (event.key === "-" || event.key === "_") controlMap("zoom-out");
            else if (event.key === "0") controlMap("reset");
            else if (event.key === "ArrowLeft") moveMap(38, 0);
            else if (event.key === "ArrowRight") moveMap(-38, 0);
            else if (event.key === "ArrowUp") moveMap(0, 38);
            else if (event.key === "ArrowDown") moveMap(0, -38);
            else return;
            event.preventDefault();
          }}
        >
          <title id="northeast-map-title">Northeast 115 peak map</title>
          <desc id="northeast-map-description">
            An interactive map of Maine, New Hampshire, New York, and Vermont with Northeast 115 peaks and recorded mountain ranges highlighted.
          </desc>

          <g transform={mapTransform.toString()}>
            <g aria-label="Northeast states">
              {northeastStates.map((state, index) => (
              <path
                  key={String(state.id ?? index)}
                  d={path(state) ?? undefined}
                  fill={markerGreen}
                  fillOpacity={0.09}
                  stroke={markerGreen}
                  strokeOpacity={0.42}
                  strokeWidth={1.3}
                  vectorEffect="non-scaling-stroke"
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
                    fillOpacity={0.16}
                    stroke={markerGreen}
                    strokeOpacity={0.52}
                    strokeWidth={1.1}
                    vectorEffect="non-scaling-stroke"
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
                const labelExtendsLeft = mapTransform.applyX(coordinates[0]) > mapWidth * 0.72;
                const direction = labelExtendsLeft ? -1 : 1;
                const isActive = activePeak === peak.slug;

                return (
                  <Link
                    key={peak.slug}
                    href={`/venture/trails/${peak.slug}`}
                    aria-label={`${peak.name}, ${peak.completed ? "climbed" : "not yet climbed"}`}
                    className="outline-none focus:outline-none"
                    style={{ textDecoration: "none" }}
                    onMouseEnter={() => setActivePeak(peak.slug)}
                    onMouseLeave={() => setActivePeak(null)}
                    onFocus={() => setActivePeak(peak.slug)}
                    onBlur={() => setActivePeak(null)}
                  >
                    <g transform={`translate(${coordinates[0]},${coordinates[1]})`}>
                      <g transform={`scale(${1 / mapTransform.k})`}>
                      <circle r={14} fill="transparent" stroke="none" />
                      <circle
                        r={isActive ? 6.8 : peak.completed ? 5.3 : 2.9}
                        fill={peak.completed ? markerGreen : "#c9c5bc"}
                        fillOpacity={peak.completed ? 1 : 0.78}
                        stroke="#ffffff"
                        strokeWidth={peak.completed ? 1.8 : 1}
                        className="transition-[r,fill-opacity]"
                      />
                      <line
                        x1={7 * direction}
                        y1={-5}
                        x2={50 * direction}
                        y2={-28}
                        stroke={markerGreen}
                        strokeWidth={1.1}
                        opacity={isActive ? 1 : 0}
                        className="pointer-events-none transition-opacity"
                      />
                      <text
                        x={56 * direction}
                        y={-25}
                        textAnchor={labelExtendsLeft ? "end" : "start"}
                        fill="#57534e"
                        stroke="#ffffff"
                        strokeWidth={5}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                        opacity={isActive ? 1 : 0}
                        className="pointer-events-none font-serif text-[12px] transition-opacity"
                      >
                        {peak.name}
                      </text>
                      <title>
                        {peak.name} · {peak.range} · {peak.completed ? "climbed" : "not yet climbed"}
                      </title>
                      </g>
                    </g>
                  </Link>
                );
              })}
            </g>
          </g>
        </svg>
        <div className="absolute right-3 top-3 flex overflow-hidden border border-stone-300 bg-white/95 text-stone-600 shadow-sm" aria-label="Map controls">
          <button type="button" className="h-9 w-9 border-r border-stone-300 text-base hover:bg-stone-100" onClick={() => controlMap("zoom-in")} aria-label="Zoom in">+</button>
          <button type="button" className="h-9 w-9 border-r border-stone-300 text-base hover:bg-stone-100" onClick={() => controlMap("zoom-out")} aria-label="Zoom out">−</button>
          <button type="button" className="h-9 px-3 text-[0.65rem] lowercase tracking-widest hover:bg-stone-100" onClick={() => controlMap("reset")}>reset</button>
        </div>
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
          Northeast states &amp; ranges with recorded summits
        </span>
        <span>drag to pan · scroll to zoom · select a marker to open its page</span>
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
            style={{ textDecoration: "none" }}
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
