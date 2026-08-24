"use client";

import {
  geoAlbersUsa,
  geoMercator,
  geoPath,
  select,
  zoom,
  zoomIdentity,
  type GeoGeometryObjects,
  type ZoomTransform,
} from "d3";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature, mesh } from "topojson-client";
import us from "us-atlas/states-10m.json";
import { CompletionStatus } from "@/components/venture/completion-status";
import type { NationalPark, NationalParkBoundaryFeature } from "@/lib/venture-parks";

const mapWidth = 1200;
const mapHeight = 720;
const markerGreen = "#859900";
const territoryInsets = [
  { npsCode: "NPSA", label: "american samoa", x: 874, y: 548, width: 145, height: 132 },
  { npsCode: "VIIS", label: "u.s. virgin islands", x: 1027, y: 548, width: 145, height: 132 },
] as const;

type SortOrder = "ascending" | "descending";
type MapControl = "zoom-in" | "zoom-out" | "reset";

export type NationalParkIndexItem = NationalPark &
  Readonly<{
    displayName: string;
    states: readonly string[];
  }>;

type ParkMapDatum = Readonly<{
  park: NationalParkIndexItem;
  boundary: NationalParkBoundaryFeature;
  pathData: string;
  position: readonly [number, number];
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
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;

    const svg = select(element);
    svg.selectAll("*").remove();

    const topology = us as unknown as Parameters<typeof feature>[0];
    const nation = feature(topology, topology.objects.nation);
    const states = feature(topology, topology.objects.states);
    const stateFeatures = states.type === "FeatureCollection" ? states.features : [states];
    const stateBorders = mesh(
      topology,
      topology.objects.states as Parameters<typeof mesh>[1],
      (first, second) => first !== second,
    );
    const projection = geoAlbersUsa().fitExtent(
      [
        [35, 30],
        [mapWidth - 35, mapHeight - 34],
      ],
      nation,
    );
    const basePath = geoPath(projection);
    const parksBySlug = new Map(parks.map((park) => [park.slug, park]));
    const boundariesByCode = new Map(boundaries.map((boundary) => [boundary.properties.npsCode, boundary]));
    const insetProjections = new Map<string, ReturnType<typeof geoMercator>>();

    for (const inset of territoryInsets) {
      const boundary = boundariesByCode.get(inset.npsCode);
      if (!boundary) continue;
      insetProjections.set(
        inset.npsCode,
        geoMercator().fitExtent(
          [
            [inset.x + 12, inset.y + 25],
            [inset.x + inset.width - 12, inset.y + inset.height - 12],
          ],
          boundary as unknown as GeoGeometryObjects,
        ),
      );
    }

    const projectionFor = (npsCode: string) => insetProjections.get(npsCode) ?? projection;
    const parkData = boundaries
      .map((boundary): ParkMapDatum | null => {
        const park = parksBySlug.get(boundary.properties.slug);
        if (!park) return null;
        const parkProjection = projectionFor(park.npsCode);
        const position = parkProjection([park.longitude, park.latitude]);
        const pathData = geoPath(parkProjection)(boundary as unknown as GeoGeometryObjects);
        if (!position || !pathData) return null;
        return {
          park,
          boundary,
          pathData,
          position: [position[0], position[1]],
        };
      })
      .filter((datum): datum is ParkMapDatum => datum !== null)
      .sort((first, second) => Number(first.park.visited) - Number(second.park.visited));

    svg.append("title").text("Interactive map of all 63 United States national parks");
    svg
      .append("desc")
      .text(
        "All national park boundaries are shaded. Visited parks are solarized green. Hover or focus a park marker for its name, select it to open its page, and drag or scroll to explore.",
      );

    const viewport = svg.append("g");

    viewport
      .append("g")
      .attr("aria-hidden", "true")
      .selectAll("path")
      .data(stateFeatures)
      .join("path")
      .attr("d", (state) => basePath(state))
      .attr("fill", "#f4f2ec")
      .attr("stroke", "none");

    viewport
      .append("path")
      .datum(stateBorders)
      .attr("d", basePath)
      .attr("fill", "none")
      .attr("stroke", "#c9c5bc")
      .attr("stroke-width", 0.9)
      .attr("vector-effect", "non-scaling-stroke")
      .attr("aria-hidden", "true");

    const insetGroups = viewport
      .append("g")
      .attr("aria-hidden", "true")
      .selectAll("g")
      .data(territoryInsets)
      .join("g");

    insetGroups
      .append("rect")
      .attr("x", (inset) => inset.x)
      .attr("y", (inset) => inset.y)
      .attr("width", (inset) => inset.width)
      .attr("height", (inset) => inset.height)
      .attr("fill", "#faf9f6")
      .attr("stroke", "#d6d3d1")
      .attr("stroke-width", 0.8)
      .attr("vector-effect", "non-scaling-stroke");

    insetGroups
      .append("text")
      .attr("x", (inset) => inset.x + 8)
      .attr("y", (inset) => inset.y + 15)
      .attr("fill", "#78716c")
      .attr("font-size", 9)
      .attr("letter-spacing", "0.08em")
      .text((inset) => inset.label);

    const parkLinks = viewport
      .append("g")
      .attr("aria-label", "National parks")
      .selectAll<SVGAElement, ParkMapDatum>("a")
      .data(parkData, (datum) => datum.park.slug)
      .join("a")
      .attr("href", (datum) => `/venture/parks/${datum.park.slug}`)
      .attr("aria-label", (datum) =>
        `${datum.park.displayName}, ${datum.park.stateOrTerritory}, ${datum.park.visited ? "visited" : "not yet visited"}`,
      )
      .attr("class", "group outline-none");

    parkLinks
      .append("path")
      .attr("d", (datum) => datum.pathData)
      .attr("fill", markerGreen)
      .attr("fill-opacity", (datum) => (datum.park.visited ? 0.58 : 0.14))
      .attr("stroke", markerGreen)
      .attr("stroke-opacity", (datum) => (datum.park.visited ? 1 : 0.4))
      .attr("stroke-width", (datum) => (datum.park.visited ? 1.45 : 0.75))
      .attr("vector-effect", "non-scaling-stroke");

    const markers = parkLinks.append("g").attr("class", "park-marker");

    markers.append("circle").attr("r", 14).attr("fill", "transparent");

    markers
      .append("circle")
      .attr("r", (datum) => (datum.park.visited ? 5.5 : 3.2))
      .attr("fill", (datum) => (datum.park.visited ? markerGreen : "#b8b6ad"))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.8)
      .attr("class", "transition-[r] group-hover:[r:7px] group-focus:[r:7px]");

    markers
      .append("line")
      .attr(
        "class",
        "pointer-events-none stroke-[#859900] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100",
      )
      .attr("stroke-width", 1)
      .attr("y1", -5)
      .attr("y2", -25);

    markers
      .append("text")
      .attr(
        "class",
        "pointer-events-none fill-stone-700 font-serif text-[12px] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100",
      )
      .attr("y", -22)
      .attr("paint-order", "stroke")
      .attr("stroke", "#ffffff")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 5)
      .text((datum) => datum.park.displayName);

    parkLinks.append("title").text((datum) => `${datum.park.displayName} — ${datum.park.stateOrTerritory}`);

    markers.each(function configureLabel(datum) {
      const extendLeft = datum.position[0] > mapWidth * 0.72;
      const direction = extendLeft ? -1 : 1;
      const marker = select(this);
      marker.select("line").attr("x1", 7 * direction).attr("x2", 46 * direction);
      marker
        .select("text")
        .attr("x", 51 * direction)
        .attr("text-anchor", extendLeft ? "end" : "start");
    });

    const updateMarkers = (transform: ZoomTransform) => {
      markers.attr(
        "transform",
        (datum) =>
          `translate(${datum.position[0]},${datum.position[1]}) scale(${1 / transform.k})`,
      );
    };

    updateMarkers(zoomIdentity);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 24])
      .extent([
        [0, 0],
        [mapWidth, mapHeight],
      ])
      .translateExtent([
        [-mapWidth * 0.55, -mapHeight * 0.55],
        [mapWidth * 1.55, mapHeight * 1.55],
      ])
      .on("start", () => svg.style("cursor", "grabbing"))
      .on("zoom", (event) => {
        viewport.attr("transform", event.transform.toString());
        updateMarkers(event.transform);
      })
      .on("end", () => svg.style("cursor", "grab"));

    svg.call(zoomBehavior).style("cursor", "grab");

    const handleControl = (event: Event) => {
      const action = (event as CustomEvent<MapControl>).detail;
      if (action === "zoom-in") svg.call(zoomBehavior.scaleBy, 1.65);
      else if (action === "zoom-out") svg.call(zoomBehavior.scaleBy, 1 / 1.65);
      else if (action === "reset") svg.call(zoomBehavior.transform, zoomIdentity);
    };

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "+" || event.key === "=") svg.call(zoomBehavior.scaleBy, 1.5);
      else if (event.key === "-" || event.key === "_") svg.call(zoomBehavior.scaleBy, 1 / 1.5);
      else if (event.key === "ArrowLeft") svg.call(zoomBehavior.translateBy, 70, 0);
      else if (event.key === "ArrowRight") svg.call(zoomBehavior.translateBy, -70, 0);
      else if (event.key === "ArrowUp") svg.call(zoomBehavior.translateBy, 0, 55);
      else if (event.key === "ArrowDown") svg.call(zoomBehavior.translateBy, 0, -55);
      else if (event.key === "0") svg.call(zoomBehavior.transform, zoomIdentity);
      else return;
      event.preventDefault();
    };

    element.addEventListener("national-parks-map-control", handleControl);
    svg.on("keydown.keyboard", handleKeyboard);

    return () => {
      element.removeEventListener("national-parks-map-control", handleControl);
      svg.on(".zoom", null).on(".keyboard", null);
      svg.selectAll("*").remove();
    };
  }, [boundaries, parks]);

  const controlMap = (action: MapControl) => {
    svgRef.current?.dispatchEvent(new CustomEvent<MapControl>("national-parks-map-control", { detail: action }));
  };

  return (
    <figure className="not-prose m-0 mt-9 w-full">
      <div className="relative overflow-hidden border border-stone-200 bg-white dark:border-stone-700">
        <svg
          ref={svgRef}
          className="block aspect-[5/3] w-full touch-none select-none bg-white outline-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none"
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          tabIndex={0}
          aria-label="Interactive national parks map. Drag to pan, scroll or use plus and minus to zoom, and select a park marker to open its page."
        />
        <div
          className="absolute right-3 top-3 flex overflow-hidden border border-stone-300 bg-white/95 text-stone-600 shadow-sm"
          aria-label="Map controls"
        >
          <button
            type="button"
            className="h-9 w-9 border-r border-stone-300 text-base no-underline hover:bg-stone-100"
            onClick={() => controlMap("zoom-in")}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="h-9 w-9 border-r border-stone-300 text-base no-underline hover:bg-stone-100"
            onClick={() => controlMap("zoom-out")}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="h-9 px-3 text-[0.65rem] lowercase tracking-widest no-underline hover:bg-stone-100"
            onClick={() => controlMap("reset")}
          >
            reset
          </button>
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[0.68rem] text-stone-500">
        <span>drag to pan · scroll or double-click to zoom · hover a marker for its name</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#859900]" aria-hidden="true" />
          visited
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#859900]/20" aria-hidden="true" />
          not yet visited
        </span>
        <a href={boundarySourceUrl} target="_blank" rel="noreferrer" className="text-[#6f8200]">
          park boundaries: NPS ↗
        </a>
        <a
          href="https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html"
          target="_blank"
          rel="noreferrer"
          className="text-[#6f8200]"
        >
          state boundaries: U.S. Census Bureau ↗
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
          <div
            key={park.slug}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-300 py-4 dark:border-stone-700"
          >
            <Link
              href={`/venture/parks/${park.slug}`}
              className="group col-span-2 grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 text-stone-700 no-underline transition-colors hover:text-[#6f8200] dark:text-stone-300"
            >
              <span className="text-xs tabular-nums text-stone-400">
                {String(alphabeticRanks.get(park.slug) ?? 0).padStart(2, "0")}
              </span>
              <span>
                <span className="block font-serif text-sm text-current">{park.displayName}</span>
                <span className="mt-0.5 block text-[0.68rem] text-stone-500">{park.stateOrTerritory}</span>
              </span>
            </Link>
            <span className="no-underline [text-decoration:none]">
              <CompletionStatus complete={park.visited} completeLabel="visited" incompleteLabel="not yet visited" />
            </span>
          </div>
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
