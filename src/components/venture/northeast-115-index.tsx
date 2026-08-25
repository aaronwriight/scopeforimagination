"use client";

import {
  geoBounds,
  geoMercator,
  geoPath,
  pointer,
  select,
  zoom,
  zoomIdentity,
  type GeoPermissibleObjects,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import statesAtlas from "us-atlas/states-10m.json";
import { CompletionStatus } from "@/components/venture/completion-status";
import northeastRangeBoundaries from "@/data/venture-northeast-ranges.json";
import type { NortheastPeak, NortheastRangeArea } from "@/lib/venture-trails";

const mapWidth = 960;
const mapHeight = 600;
const markerGreen = "#859900";
const northeastStateIds = new Set(["23", "33", "36", "50"]);
const hillshadeServiceUrl = "https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer";
const minimumTerrainTileZoom = 7;
const maximumTerrainTileZoom = 11;
const maximumMapScale = 12;
const zoomStep = 1.3;

type SortOption = "alphabetical-ascending" | "alphabetical-descending" | "elevation-descending" | "elevation-ascending";
type MapControl = "zoom-in" | "zoom-out" | "reset";
type TerrainTile = Readonly<{
  id: string;
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;
type RangeCoordinate = readonly [number, number];
type RangePolygonCoordinates = readonly (readonly RangeCoordinate[])[];
type RangeBoundaryFeature = Readonly<{
  type: "Feature";
  properties: Readonly<{ name: string }>;
  geometry:
    | Readonly<{ type: "Polygon"; coordinates: RangePolygonCoordinates }>
    | Readonly<{ type: "MultiPolygon"; coordinates: readonly RangePolygonCoordinates[] }>;
}>;

function ringSignedArea(ring: readonly RangeCoordinate[]): number {
  return ring.reduce((area, coordinate, index) => {
    const nextCoordinate = ring[(index + 1) % ring.length];
    return area + coordinate[0] * nextCoordinate[1] - nextCoordinate[0] * coordinate[1];
  }, 0) / 2;
}

function rewindPolygonForD3(coordinates: RangePolygonCoordinates): RangeCoordinate[][] {
  return coordinates.map((ring, ringIndex) => {
    const isClockwise = ringSignedArea(ring) < 0;
    const shouldBeClockwise = ringIndex === 0;
    return isClockwise === shouldBeClockwise ? [...ring] : [...ring].reverse();
  });
}

function rewindRangeBoundaryForD3(boundary: RangeBoundaryFeature): RangeBoundaryFeature {
  if (boundary.geometry.type === "Polygon") {
    return {
      ...boundary,
      geometry: {
        type: "Polygon",
        coordinates: rewindPolygonForD3(boundary.geometry.coordinates),
      },
    };
  }

  return {
    ...boundary,
    geometry: {
      type: "MultiPolygon",
      coordinates: boundary.geometry.coordinates.map(rewindPolygonForD3),
    },
  };
}

const rangeBoundaryFeatures = (
  northeastRangeBoundaries.features as unknown as readonly RangeBoundaryFeature[]
).map(rewindRangeBoundaryForD3);

function longitudeToTileX(longitude: number, zoomLevel: number): number {
  return ((longitude + 180) / 360) * 2 ** zoomLevel;
}

function latitudeToTileY(latitude: number, zoomLevel: number): number {
  const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = (clampedLatitude * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * 2 ** zoomLevel;
}

function tileXToLongitude(tileX: number, zoomLevel: number): number {
  return (tileX / 2 ** zoomLevel) * 360 - 180;
}

function tileYToLatitude(tileY: number, zoomLevel: number): number {
  const mercatorY = Math.PI * (1 - (2 * tileY) / 2 ** zoomLevel);
  return (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
}

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

  const { northeastStates, path, projection, stateBounds } = useMemo(() => {
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
      stateBounds: geoBounds(selectedStateCollection),
    };
  }, []);

  const terrainTiles = useMemo(() => {
    const zoomLevel = Math.min(
      maximumTerrainTileZoom,
      minimumTerrainTileZoom + Math.max(0, Math.floor(Math.log2(mapTransform.k) + 0.5)),
    );
    const inverseTopLeft: [number, number] = [
      (0 - mapTransform.x) / mapTransform.k,
      (0 - mapTransform.y) / mapTransform.k,
    ];
    const inverseBottomRight: [number, number] = [
      (mapWidth - mapTransform.x) / mapTransform.k,
      (mapHeight - mapTransform.y) / mapTransform.k,
    ];
    const topLeftCoordinates = projection.invert?.(inverseTopLeft);
    const bottomRightCoordinates = projection.invert?.(inverseBottomRight);
    if (!topLeftCoordinates || !bottomRightCoordinates) return [];

    const [[stateWest, stateSouth], [stateEast, stateNorth]] = stateBounds;
    const visibleWest = Math.max(stateWest, Math.min(topLeftCoordinates[0], bottomRightCoordinates[0]));
    const visibleEast = Math.min(stateEast, Math.max(topLeftCoordinates[0], bottomRightCoordinates[0]));
    const visibleSouth = Math.max(stateSouth, Math.min(topLeftCoordinates[1], bottomRightCoordinates[1]));
    const visibleNorth = Math.min(stateNorth, Math.max(topLeftCoordinates[1], bottomRightCoordinates[1]));
    if (visibleWest >= visibleEast || visibleSouth >= visibleNorth) return [];

    const tileLimit = 2 ** zoomLevel - 1;
    const tilePadding = mapTransform.k > 1 ? 1 : 0;
    const minimumTileX = Math.max(0, Math.floor(longitudeToTileX(visibleWest, zoomLevel)) - tilePadding);
    const maximumTileX = Math.min(tileLimit, Math.floor(longitudeToTileX(visibleEast, zoomLevel)) + tilePadding);
    const minimumTileY = Math.max(0, Math.floor(latitudeToTileY(visibleNorth, zoomLevel)) - tilePadding);
    const maximumTileY = Math.min(tileLimit, Math.floor(latitudeToTileY(visibleSouth, zoomLevel)) + tilePadding);
    const tiles: TerrainTile[] = [];

    for (let tileY = minimumTileY; tileY <= maximumTileY; tileY += 1) {
      for (let tileX = minimumTileX; tileX <= maximumTileX; tileX += 1) {
        const topLeft = projection([
          tileXToLongitude(tileX, zoomLevel),
          tileYToLatitude(tileY, zoomLevel),
        ]);
        const bottomRight = projection([
          tileXToLongitude(tileX + 1, zoomLevel),
          tileYToLatitude(tileY + 1, zoomLevel),
        ]);
        if (!topLeft || !bottomRight) continue;

        tiles.push({
          id: `${zoomLevel}:${tileX}:${tileY}`,
          href: `${hillshadeServiceUrl}/tile/${zoomLevel}/${tileY}/${tileX}`,
          x: topLeft[0] - 0.25,
          y: topLeft[1] - 0.25,
          width: bottomRight[0] - topLeft[0] + 0.5,
          height: bottomRight[1] - topLeft[1] + 0.5,
        });
      }
    }

    return tiles;
  }, [mapTransform, projection, stateBounds]);

  const visibleRangeBoundaries = useMemo(() => {
    const activeRanges = new Map(rangeAreas.map((area) => [area.name, area]));

    return rangeBoundaryFeatures.flatMap((boundary) => {
      const area = activeRanges.get(boundary.properties.name);
      return area ? [{ boundary, area }] : [];
    });
  }, [rangeAreas]);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, maximumMapScale])
      .wheelDelta((event: WheelEvent) => {
        const deltaFactor = event.deltaMode === 1 ? 0.015 : event.deltaMode === 2 ? 0.35 : 0.001;
        return -event.deltaY * deltaFactor * (event.ctrlKey ? 2 : 1);
      })
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
    const selection = select(element);
    selection
      .call(zoomBehavior)
      .on("dblclick.zoom", (event: MouseEvent) => {
        event.preventDefault();
        selection.call(
          zoomBehavior.scaleBy,
          event.shiftKey ? 1 / zoomStep : zoomStep,
          pointer(event, element),
        );
      });

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
    if (control === "zoom-in") selection.call(zoomBehavior.scaleBy, zoomStep);
    else if (control === "zoom-out") selection.call(zoomBehavior.scaleBy, 1 / zoomStep);
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
            An interactive map of Maine, New Hampshire, New York, and Vermont with hillshaded terrain relief, Northeast 115 peaks, and recorded mountain ranges highlighted.
          </desc>

          <defs>
            <clipPath id="northeast-states-clip">
              {northeastStates.map((state, index) => (
                <path key={String(state.id ?? index)} d={path(state) ?? undefined} />
              ))}
            </clipPath>
          </defs>

          <g transform={mapTransform.toString()}>
            <g clipPath="url(#northeast-states-clip)" aria-label="Esri World Hillshade terrain relief">
              {terrainTiles.map((tile) => (
                <image
                  key={tile.id}
                  href={tile.href}
                  x={tile.x}
                  y={tile.y}
                  width={tile.width}
                  height={tile.height}
                  opacity={0.52}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                  style={{ mixBlendMode: "multiply" }}
                />
              ))}
            </g>

            <g
              clipPath="url(#northeast-states-clip)"
              aria-label="Mountain ranges containing recorded summits"
            >
              {visibleRangeBoundaries.map(({ boundary, area }) => (
                <path
                  key={area.name}
                  d={path(boundary as unknown as GeoPermissibleObjects) ?? undefined}
                  fill={markerGreen}
                  fillOpacity={0.12}
                  stroke={markerGreen}
                  strokeOpacity={0.58}
                  strokeWidth={1.15}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                >
                  <title>
                    {area.name}: {area.completedPeakCount} recorded {area.completedPeakCount === 1 ? "summit" : "summits"}
                  </title>
                </path>
              ))}
            </g>

            <g aria-label="Northeast state boundaries">
              {northeastStates.map((state, index) => (
                <path
                  key={String(state.id ?? index)}
                  d={path(state) ?? undefined}
                  fill="none"
                  stroke="#d6d3d1"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ))}
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
          <span className="h-2.5 w-4 border border-[#859900]/60 bg-[#859900]/10" aria-hidden="true" />
          ranges with recorded summits
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-4 bg-stone-300" aria-hidden="true" />
          state boundaries
        </span>
        <a href={hillshadeServiceUrl} target="_blank" rel="noreferrer" className="text-[#6f8200]">
          terrain relief: Esri World Hillshade ↗
        </a>
        <a href="https://doi.org/10.48601/earthenv-t9k2-1407" target="_blank" rel="noreferrer" className="text-[#6f8200]">
          range boundaries: GMBA v2 ↗
        </a>
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
  const [sortOption, setSortOption] = useState<SortOption>("alphabetical-ascending");

  const states = useMemo(
    () => [...new Set(peaks.map((peak) => peak.state))].sort(),
    [peaks],
  );
  const ranges = useMemo(
    () => [...new Set(peaks.map((peak) => peak.range))].sort(),
    [peaks],
  );
  const filteredPeaks = useMemo(
    () =>
      peaks
        .filter((peak) => state === "all" || peak.state === state)
        .filter((peak) => range === "all" || peak.range === range),
    [peaks, range, state],
  );
  const filteredRangeAreas = useMemo(
    () =>
      rangeAreas.flatMap((area) => {
        const matchingPeaks = filteredPeaks.filter((peak) => peak.range === area.name);
        const completedPeakCount = matchingPeaks.filter((peak) => peak.completed).length;
        if (matchingPeaks.length === 0 || completedPeakCount === 0) return [];

        return [{
          ...area,
          peakCount: matchingPeaks.length,
          completedPeakCount,
          stateAbbreviations: [...new Set(matchingPeaks.map((peak) => peak.stateAbbreviation))].sort(),
        }];
      }),
    [filteredPeaks, rangeAreas],
  );
  const visiblePeaks = useMemo(
    () =>
      filteredPeaks.toSorted((first, second) => {
          if (sortOption === "elevation-descending") {
            return second.elevationFeet - first.elevationFeet || first.name.localeCompare(second.name);
          }
          if (sortOption === "elevation-ascending") {
            return first.elevationFeet - second.elevationFeet || first.name.localeCompare(second.name);
          }
          const alphabeticalComparison = first.name.localeCompare(second.name);
          return sortOption === "alphabetical-ascending" ? alphabeticalComparison : -alphabeticalComparison;
        }),
    [filteredPeaks, sortOption],
  );

  const controlClassName =
    "mt-1 w-full border border-stone-300 bg-white px-3 py-2 font-serif text-sm text-stone-700 outline-none transition-colors focus:border-[#859900] dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300";

  return (
    <>
      <NortheastMap peaks={filteredPeaks} rangeAreas={filteredRangeAreas} />

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
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as SortOption)}
            className={controlClassName}
          >
            <option value="alphabetical-ascending">A–Z</option>
            <option value="alphabetical-descending">Z–A</option>
            <option value="elevation-descending">elevation: high–low</option>
            <option value="elevation-ascending">elevation: low–high</option>
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
