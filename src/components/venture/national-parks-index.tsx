"use client";

import {
  geoBounds,
  geoMercator,
  geoPath,
  type GeoGeometryObjects,
  type GeoProjection,
} from "d3-geo";
import { polygonContains } from "d3-polygon";
import { select } from "d3-selection";
import {
  zoom,
  zoomIdentity,
  type ZoomTransform,
} from "d3-zoom";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature, mesh } from "topojson-client";
import us from "us-atlas/states-10m.json";
import { CompletionStatus } from "@/components/venture/completion-status";
import type {
  NationalPark,
  NationalParkBoundaryFeature,
  NationalParkBoundaryGeometry,
} from "@/lib/venture-parks";

const mapWidth = 1200;
const mapHeight = 720;
const markerGreen = "#859900";
const hillshadeServiceUrl = "https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer";
const insetRegions = [
  { id: "alaska", label: "alaska", x: 35, y: 548, width: 320, height: 140 },
  { id: "hawaii", label: "hawaii", x: 365, y: 568, width: 185, height: 120 },
  { id: "american-samoa", label: "american samoa", x: 744, y: 568, width: 190, height: 120 },
  { id: "virgin-islands", label: "u.s. virgin islands", x: 946, y: 568, width: 218, height: 120 },
] as const;

const excludedConusStateIds = new Set(["02", "15", "60", "66", "69", "72", "78"]);

type SortOrder = "ascending" | "descending";
type CompletionFilter = "all" | "completed" | "not-completed";
type MapControl = "zoom-in" | "zoom-out" | "reset";
type MapRegionId = "conus" | "alaska" | "hawaii" | "american-samoa" | "virgin-islands";
type TerrainTile = Readonly<{
  id: string;
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type MapRegion = Readonly<{
  id: MapRegionId;
  label: string | null;
  stateIds: ReadonlySet<string>;
  stateFeatures: readonly GeoGeometryObjects[];
  projection: GeoProjection;
  minimumTileZoom: number;
  maximumTileZoom: number;
  longitudeRanges: readonly (readonly [number, number])[];
  latitudeRange: readonly [number, number];
  projectedExtent: readonly [readonly [number, number], readonly [number, number]];
}>;

export type NationalParkIndexItem = NationalPark &
  Readonly<{
    displayName: string;
    states: readonly string[];
  }>;

type ParkMapDatum = Readonly<{
  park: NationalParkIndexItem;
  position: readonly [number, number];
}>;

type ParkBoundaryMapDatum = Readonly<{
  boundary: NationalParkBoundaryFeature;
  pathData: string;
}>;

type BoundaryPosition = [number, number];
type BoundaryRing = BoundaryPosition[];
type BoundaryPolygon = BoundaryRing[];

function normalizedStateId(value: string | number | undefined): string {
  return String(value ?? "").padStart(2, "0");
}

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

function signedRingArea(ring: readonly BoundaryPosition[]): number {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function orientRing(ring: readonly BoundaryPosition[], clockwise: boolean): BoundaryRing {
  const isClockwise = signedRingArea(ring) < 0;
  const positions = ring.map(([longitude, latitude]): BoundaryPosition => [longitude, latitude]);
  return isClockwise === clockwise ? positions : positions.reverse();
}

/**
 * The NPS ArcGIS GeoJSON occasionally emits interior rings as standalone
 * MultiPolygon members. D3 treats those counter-clockwise rings as the
 * complement of the park, which fills the projection instead of the hole.
 * Reattach each orphan ring to its smallest containing footprint before
 * generating SVG paths.
 */
function normalizeBoundaryGeometry(geometry: NationalParkBoundaryGeometry): NationalParkBoundaryGeometry {
  if (geometry.type === "Polygon") {
    const [outerRing, ...holeRings] = geometry.coordinates;
    return {
      type: "Polygon",
      coordinates: [
        orientRing(outerRing, true),
        ...holeRings.map((ring) => orientRing(ring, false)),
      ],
    };
  }

  const polygons: BoundaryPolygon[] = [];
  const orphanRings: BoundaryRing[] = [];

  for (const polygon of geometry.coordinates) {
    const [outerRing, ...holeRings] = polygon;
    if (signedRingArea(outerRing) < 0) {
      polygons.push([
        orientRing(outerRing, true),
        ...holeRings.map((ring) => orientRing(ring, false)),
      ]);
    } else {
      orphanRings.push(outerRing, ...holeRings);
    }
  }

  for (const orphanRing of orphanRings) {
    const hole = orientRing(orphanRing, false);
    const containingPolygon = polygons
      .map((polygon, index) => ({
        index,
        area: Math.abs(signedRingArea(polygon[0])),
      }))
      .filter(({ index }) => polygonContains(polygons[index][0], hole[0]))
      .sort((first, second) => first.area - second.area)[0];

    if (containingPolygon) {
      polygons[containingPolygon.index].push(hole);
    } else {
      // Defensive fallback: an uncontained ring is a footprint, not a hole.
      polygons.push([orientRing(orphanRing, true)]);
    }
  }

  return { type: "MultiPolygon", coordinates: polygons };
}

function terrainTilesForRegion(region: MapRegion, transform: ZoomTransform): TerrainTile[] {
  const zoomLevel = Math.min(
    region.maximumTileZoom,
    region.minimumTileZoom + Math.max(0, Math.floor(Math.log2(transform.k))),
  );
  const visibleLeft = (0 - transform.x) / transform.k;
  const visibleTop = (0 - transform.y) / transform.k;
  const visibleRight = (mapWidth - transform.x) / transform.k;
  const visibleBottom = (mapHeight - transform.y) / transform.k;
  const regionLeft = Math.max(region.projectedExtent[0][0], visibleLeft);
  const regionTop = Math.max(region.projectedExtent[0][1], visibleTop);
  const regionRight = Math.min(region.projectedExtent[1][0], visibleRight);
  const regionBottom = Math.min(region.projectedExtent[1][1], visibleBottom);
  if (regionLeft >= regionRight || regionTop >= regionBottom) return [];

  const tileLimit = 2 ** zoomLevel - 1;
  const tilePadding = transform.k > 1 ? 1 : 0;
  const minimumTileY = Math.max(
    0,
    Math.floor(latitudeToTileY(region.latitudeRange[1], zoomLevel)) - tilePadding,
  );
  const maximumTileY = Math.min(
    tileLimit,
    Math.floor(latitudeToTileY(region.latitudeRange[0], zoomLevel)) + tilePadding,
  );
  const tiles = new Map<string, TerrainTile>();

  for (const [west, east] of region.longitudeRanges) {
    const minimumTileX = Math.max(0, Math.floor(longitudeToTileX(west, zoomLevel)) - tilePadding);
    const maximumTileX = Math.min(tileLimit, Math.floor(longitudeToTileX(east, zoomLevel)) + tilePadding);

    for (let tileY = minimumTileY; tileY <= maximumTileY; tileY += 1) {
      for (let tileX = minimumTileX; tileX <= maximumTileX; tileX += 1) {
        const longitudeLeft = tileXToLongitude(tileX, zoomLevel);
        const longitudeRight = tileXToLongitude(tileX + 1, zoomLevel);
        const latitudeTop = tileYToLatitude(tileY, zoomLevel);
        const latitudeBottom = tileYToLatitude(tileY + 1, zoomLevel);
        const corners = [
          region.projection([longitudeLeft, latitudeTop]),
          region.projection([longitudeRight, latitudeTop]),
          region.projection([longitudeLeft, latitudeBottom]),
          region.projection([longitudeRight, latitudeBottom]),
        ].filter((corner): corner is [number, number] => corner !== null);
        if (corners.length !== 4) continue;

        const tileLeft = Math.min(...corners.map((corner) => corner[0]));
        const tileTop = Math.min(...corners.map((corner) => corner[1]));
        const tileRight = Math.max(...corners.map((corner) => corner[0]));
        const tileBottom = Math.max(...corners.map((corner) => corner[1]));
        if (
          tileRight < regionLeft ||
          tileLeft > regionRight ||
          tileBottom < regionTop ||
          tileTop > regionBottom ||
          tileRight - tileLeft > (region.projectedExtent[1][0] - region.projectedExtent[0][0]) * 1.5
        ) {
          continue;
        }

        const id = `${region.id}:${zoomLevel}:${tileX}:${tileY}`;
        tiles.set(id, {
          id,
          href: `${hillshadeServiceUrl}/tile/${zoomLevel}/${tileY}/${tileX}`,
          x: tileLeft - 0.35,
          y: tileTop - 0.35,
          width: tileRight - tileLeft + 0.7,
          height: tileBottom - tileTop + 0.7,
        });
      }
    }
  }

  return [...tiles.values()];
}

export function NationalParksMap({
  parks,
  boundaries,
  boundarySourceUrl,
  variant = "index",
}: {
  parks: readonly NationalParkIndexItem[];
  boundaries: readonly NationalParkBoundaryFeature[];
  boundarySourceUrl: string;
  variant?: "index" | "atlas";
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;

    const svg = select(element);
    svg.selectAll("*").remove();

    const topology = us as unknown as Parameters<typeof feature>[0];
    const statesObject = topology.objects.states;
    const states = feature(topology, statesObject);
    const stateFeatures = states.type === "FeatureCollection" ? states.features : [states];
    const conusStateIds = new Set(
      stateFeatures
        .map((state) => normalizedStateId(state.id as string | number | undefined))
        .filter((stateId) => !excludedConusStateIds.has(stateId)),
    );

    const createRegion = ({
      id,
      label,
      stateIds,
      projectedExtent,
      minimumTileZoom,
      maximumTileZoom,
      longitudeRanges,
      rotate,
    }: {
      id: MapRegionId;
      label: string | null;
      stateIds: ReadonlySet<string>;
      projectedExtent: readonly [readonly [number, number], readonly [number, number]];
      minimumTileZoom: number;
      maximumTileZoom: number;
      longitudeRanges: readonly (readonly [number, number])[];
      rotate?: readonly [number, number, number];
    }): MapRegion => {
      const selectedStates = stateFeatures.filter((state) =>
        stateIds.has(normalizedStateId(state.id as string | number | undefined)),
      );
      const stateCollection = {
        type: "FeatureCollection" as const,
        features: selectedStates,
      };
      const projection = geoMercator();
      if (rotate) projection.rotate([...rotate]);
      projection.fitExtent(
        [
          [projectedExtent[0][0], projectedExtent[0][1]],
          [projectedExtent[1][0], projectedExtent[1][1]],
        ],
        stateCollection,
      );
      const bounds = geoBounds(stateCollection);

      return {
        id,
        label,
        stateIds,
        stateFeatures: selectedStates as unknown as readonly GeoGeometryObjects[],
        projection,
        minimumTileZoom,
        maximumTileZoom,
        longitudeRanges,
        latitudeRange: [bounds[0][1], bounds[1][1]],
        projectedExtent,
      };
    };

    const regions: readonly MapRegion[] = [
      createRegion({
        id: "conus",
        label: null,
        stateIds: conusStateIds,
        projectedExtent: [[35, 30], [1165, 535]],
        minimumTileZoom: 4,
        maximumTileZoom: 8,
        longitudeRanges: [[-125, -66]],
      }),
      createRegion({
        id: "alaska",
        label: "alaska",
        stateIds: new Set(["02"]),
        projectedExtent: [[48, 572], [342, 678]],
        minimumTileZoom: 3,
        maximumTileZoom: 8,
        longitudeRanges: [[-180, -129], [172, 180]],
        rotate: [152, 0, 0],
      }),
      createRegion({
        id: "hawaii",
        label: "hawaii",
        stateIds: new Set(["15"]),
        projectedExtent: [[378, 592], [537, 675]],
        minimumTileZoom: 6,
        maximumTileZoom: 10,
        longitudeRanges: [[-161, -154]],
      }),
      createRegion({
        id: "american-samoa",
        label: "american samoa",
        stateIds: new Set(["60"]),
        projectedExtent: [[757, 592], [921, 675]],
        minimumTileZoom: 8,
        maximumTileZoom: 12,
        longitudeRanges: [[-171, -169]],
      }),
      createRegion({
        id: "virgin-islands",
        label: "u.s. virgin islands",
        stateIds: new Set(["78"]),
        projectedExtent: [[959, 592], [1151, 675]],
        minimumTileZoom: 8,
        maximumTileZoom: 12,
        longitudeRanges: [[-66, -64]],
      }),
    ];
    const regionsById = new Map(regions.map((region) => [region.id, region]));
    const regionForPark = (park: NationalParkIndexItem): MapRegion => {
      if (park.npsCode === "NPSA") return regionsById.get("american-samoa")!;
      if (park.npsCode === "VIIS") return regionsById.get("virgin-islands")!;
      if (park.states.includes("Alaska")) return regionsById.get("alaska")!;
      if (park.states.includes("Hawaii")) return regionsById.get("hawaii")!;
      return regionsById.get("conus")!;
    };
    const regionForBoundary = (boundary: NationalParkBoundaryFeature): MapRegion => {
      if (boundary.properties.npsCode === "NPSA") return regionsById.get("american-samoa")!;
      if (boundary.properties.npsCode === "VIIS") return regionsById.get("virgin-islands")!;
      if (boundary.properties.location.includes("Alaska")) return regionsById.get("alaska")!;
      if (boundary.properties.location.includes("Hawaii")) return regionsById.get("hawaii")!;
      return regionsById.get("conus")!;
    };
    const boundaryData = boundaries
      .map((boundary): ParkBoundaryMapDatum | null => {
        const region = regionForBoundary(boundary);
        const geometry = normalizeBoundaryGeometry(boundary.geometry);
        const pathData = geoPath(region.projection)(geometry as GeoGeometryObjects);
        if (!pathData) return null;
        return { boundary, pathData };
      })
      .filter((datum): datum is ParkBoundaryMapDatum => datum !== null)
      .sort(
        (first, second) =>
          Number(first.boundary.properties.visited) - Number(second.boundary.properties.visited),
      );
    const parkData = parks
      .map((park): ParkMapDatum | null => {
        const region = regionForPark(park);
        const position = region.projection([park.longitude, park.latitude]);
        if (!position) return null;
        return {
          park,
          position: [position[0], position[1]],
        };
      })
      .filter((datum): datum is ParkMapDatum => datum !== null)
      .sort((first, second) => Number(first.park.visited) - Number(second.park.visited));

    svg.append("title").text("Interactive map of United States national parks");
    svg
      .append("desc")
      .text(
        "A hillshaded terrain map with state borders and national park boundaries shaded in solarized green. Visited parks are more prominent. Hover or focus a park marker for its name, select it to open its page, and drag or scroll to explore.",
      );

    const viewport = svg.append("g");
    const defs = svg.append("defs");

    const insetGroups = viewport
      .append("g")
      .attr("aria-hidden", "true")
      .selectAll("g")
      .data(insetRegions)
      .join("g");

    insetGroups
      .append("rect")
      .attr("x", (inset) => inset.x)
      .attr("y", (inset) => inset.y)
      .attr("width", (inset) => inset.width)
      .attr("height", (inset) => inset.height)
      .attr("fill", "var(--venture-map-surface)")
      .attr("stroke", "var(--venture-map-border)")
      .attr("stroke-width", 0.8)
      .attr("vector-effect", "non-scaling-stroke");

    insetGroups
      .append("text")
      .attr("x", (inset) => inset.x + 8)
      .attr("y", (inset) => inset.y + 15)
      .attr("fill", "var(--venture-map-label)")
      .attr("font-size", 9)
      .attr("letter-spacing", "0.08em")
      .text((inset) => inset.label);

    for (const region of regions) {
      defs
        .append("clipPath")
        .attr("id", `national-parks-terrain-${region.id}`)
        .selectAll("path")
        .data(region.stateFeatures)
        .join("path")
        .attr("d", (state) => geoPath(region.projection)(state));
    }

    viewport
      .append("g")
      .attr("aria-hidden", "true")
      .selectAll("path")
      .data(regions.flatMap((region) =>
        region.stateFeatures.map((state) => ({ region, state })),
      ))
      .join("path")
      .attr("d", ({ region, state }) => geoPath(region.projection)(state))
      .attr("fill", "var(--venture-map-surface)")
      .attr("stroke", "none");

    const terrainLayers = viewport
      .append("g")
      .attr("aria-label", "Esri World Hillshade terrain relief")
      .selectAll("g")
      .data(regions)
      .join("g")
      .attr("class", "venture-terrain-layer")
      .attr("data-region", (region) => region.id)
      .attr("clip-path", (region) => `url(#national-parks-terrain-${region.id})`);

    const updateTerrain = (transform: ZoomTransform) => {
      terrainLayers.each(function updateRegionTerrain(region) {
        select(this)
          .selectAll<SVGImageElement, TerrainTile>("image")
          .data(terrainTilesForRegion(region, transform), (tile) => tile.id)
          .join("image")
          .attr("href", (tile) => tile.href)
          .attr("x", (tile) => tile.x)
          .attr("y", (tile) => tile.y)
          .attr("width", (tile) => tile.width)
          .attr("height", (tile) => tile.height)
          .attr("preserveAspectRatio", "none")
          .attr("pointer-events", "none");
      });
    };

    updateTerrain(zoomIdentity);

    const stateBorderLayer = viewport.append("g").attr("aria-label", "State borders and coastlines");
    for (const region of regions) {
      const internalBorders = mesh(
        topology,
        statesObject as Parameters<typeof mesh>[1],
        (first, second) =>
          first !== second &&
          region.stateIds.has(normalizedStateId(first.id as string | number | undefined)) &&
          region.stateIds.has(normalizedStateId(second.id as string | number | undefined)),
      );
      const outerBorders = mesh(
        topology,
        statesObject as Parameters<typeof mesh>[1],
        (first, second) =>
          first === second &&
          region.stateIds.has(normalizedStateId(first.id as string | number | undefined)),
      );

      stateBorderLayer
        .append("path")
        .datum(internalBorders)
        .attr("d", geoPath(region.projection))
        .attr("fill", "none")
        .attr("stroke", "var(--venture-map-state-border)")
        .attr("stroke-width", 0.78)
        .attr("vector-effect", "non-scaling-stroke");

      stateBorderLayer
        .append("path")
        .datum(outerBorders)
        .attr("d", geoPath(region.projection))
        .attr("fill", "none")
        .attr("stroke", "var(--venture-map-state-border)")
        .attr("stroke-width", 0.78)
        .attr("vector-effect", "non-scaling-stroke");
    }

    const boundaryLinks = viewport
      .append("g")
      .attr("aria-label", "National park boundaries")
      .selectAll<SVGAElement, ParkBoundaryMapDatum>("a")
      .data(boundaryData, (datum) => datum.boundary.properties.slug)
      .join("a")
      .attr("href", (datum) => datum.boundary.properties.href)
      .attr("aria-label", (datum) =>
        `${datum.boundary.properties.title}, ${datum.boundary.properties.location}, ${datum.boundary.properties.visited ? "visited" : "not yet visited"}`,
      )
      .attr("class", "group outline-none");

    boundaryLinks
      .append("path")
      .attr("d", (datum) => datum.pathData)
      .attr("fill", markerGreen)
      .attr("fill-opacity", (datum) => (datum.boundary.properties.visited ? 0.68 : 0.28))
      .attr("stroke", markerGreen)
      .attr("stroke-opacity", (datum) => (datum.boundary.properties.visited ? 1 : 0.62))
      .attr("stroke-width", (datum) => (datum.boundary.properties.visited ? 1.45 : 0.9))
      .attr("vector-effect", "non-scaling-stroke");

    boundaryLinks
      .append("title")
      .text((datum) => `${datum.boundary.properties.title} — ${datum.boundary.properties.location}`);

    const parkLinks = viewport
      .append("g")
      .attr("aria-label", "National park markers")
      .selectAll<SVGAElement, ParkMapDatum>("a")
      .data(parkData, (datum) => datum.park.slug)
      .join("a")
      .attr("href", (datum) => `/venture/parks/${datum.park.slug}`)
      .attr("aria-label", (datum) =>
        `${datum.park.displayName}, ${datum.park.stateOrTerritory}, ${datum.park.visited ? "visited" : "not yet visited"}`,
      )
      .attr("class", "group outline-none");

    const markers = parkLinks.append("g").attr("class", "park-marker");

    markers.append("circle").attr("r", 14).attr("fill", "transparent");

    markers
      .append("circle")
      .attr("r", (datum) => (datum.park.visited ? 5.5 : 3.2))
      .attr("fill", (datum) => (datum.park.visited ? markerGreen : "var(--venture-map-muted-marker)"))
      .attr("stroke", "var(--venture-map-marker-outline)")
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
        "pointer-events-none font-serif text-[12px] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100",
      )
      .attr("fill", "var(--venture-map-label)")
      .attr("y", -22)
      .attr("paint-order", "stroke")
      .attr("stroke", "var(--venture-map-halo)")
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
      .scaleExtent([1, 12])
      .wheelDelta((event) => {
        if (event.deltaMode === 1) return -event.deltaY * 0.025;
        if (event.deltaMode === 2) return -event.deltaY * 0.45;
        return -event.deltaY * 0.0011;
      })
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
        updateTerrain(event.transform);
      })
      .on("end", () => svg.style("cursor", "grab"));

    svg
      .call(zoomBehavior)
      .style("cursor", "grab")
      .on("dblclick.zoom", null)
      .on("dblclick.friendly", (event: MouseEvent) => {
        event.preventDefault();
        const bounds = element.getBoundingClientRect();
        const point: [number, number] = [
          ((event.clientX - bounds.left) / bounds.width) * mapWidth,
          ((event.clientY - bounds.top) / bounds.height) * mapHeight,
        ];
        svg.call(zoomBehavior.scaleBy, event.shiftKey ? 1 / 1.35 : 1.35, point);
      });

    const handleControl = (event: Event) => {
      const action = (event as CustomEvent<MapControl>).detail;
      if (action === "zoom-in") svg.call(zoomBehavior.scaleBy, 1.3);
      else if (action === "zoom-out") svg.call(zoomBehavior.scaleBy, 1 / 1.3);
      else if (action === "reset") svg.call(zoomBehavior.transform, zoomIdentity);
    };

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "+" || event.key === "=") svg.call(zoomBehavior.scaleBy, 1.25);
      else if (event.key === "-" || event.key === "_") svg.call(zoomBehavior.scaleBy, 1 / 1.25);
      else if (event.key === "ArrowLeft") svg.call(zoomBehavior.translateBy, 45, 0);
      else if (event.key === "ArrowRight") svg.call(zoomBehavior.translateBy, -45, 0);
      else if (event.key === "ArrowUp") svg.call(zoomBehavior.translateBy, 0, 40);
      else if (event.key === "ArrowDown") svg.call(zoomBehavior.translateBy, 0, -40);
      else if (event.key === "0") svg.call(zoomBehavior.transform, zoomIdentity);
      else return;
      event.preventDefault();
    };

    element.addEventListener("national-parks-map-control", handleControl);
    svg.on("keydown.keyboard", handleKeyboard);

    return () => {
      element.removeEventListener("national-parks-map-control", handleControl);
      svg.on(".zoom", null).on(".friendly", null).on(".keyboard", null);
      svg.selectAll("*").remove();
    };
  }, [boundaries, parks, variant]);

  const controlMap = (action: MapControl) => {
    svgRef.current?.dispatchEvent(new CustomEvent<MapControl>("national-parks-map-control", { detail: action }));
  };

  return (
    <figure className={`not-prose m-0 w-full ${variant === "index" ? "mt-9" : ""}`}>
      <div className="relative isolate overflow-hidden border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-950">
        <svg
          ref={svgRef}
          className={`block w-full touch-none select-none bg-white outline-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none dark:bg-stone-950 ${variant === "atlas" ? "aspect-[56/33]" : "aspect-[5/3]"}`}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          tabIndex={0}
          aria-label="Interactive national parks map. Drag to pan, scroll or use plus and minus to zoom, and select a park marker to open its page."
        />
        <div
          className="absolute right-3 top-3 flex overflow-hidden border border-stone-300 bg-white/95 text-stone-900 shadow-sm dark:border-stone-600 dark:bg-stone-900/95 dark:text-stone-100"
          aria-label="Map controls"
        >
          <button
            type="button"
            className="h-9 w-9 border-r border-stone-300 text-base no-underline hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            onClick={() => controlMap("zoom-in")}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="h-9 w-9 border-r border-stone-300 text-base no-underline hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            onClick={() => controlMap("zoom-out")}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="h-9 px-3 text-[0.65rem] lowercase tracking-widest no-underline hover:bg-stone-100 dark:hover:bg-stone-800"
            onClick={() => controlMap("reset")}
          >
            reset
          </button>
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[0.68rem] text-stone-400">
        <span>drag to pan · scroll or double-click to zoom · hover a marker for its name</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#859900]" aria-hidden="true" />
          visited
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#859900]/30" aria-hidden="true" />
          not yet visited
        </span>
        <a href={hillshadeServiceUrl} target="_blank" rel="noreferrer" className="text-[#6f8200]">
          terrain relief: Esri World Hillshade ↗
        </a>
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
  const [completion, setCompletion] = useState<CompletionFilter>("all");
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
  const visitedParkCount = useMemo(() => parks.filter((park) => park.visited).length, [parks]);
  const mapParks = useMemo(
    () =>
      parks
        .filter((park) => state === "all" || park.states.includes(state))
        .filter((park) => completion === "all" || park.visited === (completion === "completed")),
    [completion, parks, state],
  );
  const mapBoundaries = useMemo(() => {
    const visibleParkSlugs = new Set(mapParks.map((park) => park.slug));
    return boundaries.filter((boundary) => visibleParkSlugs.has(boundary.properties.slug));
  }, [boundaries, mapParks]);
  const visibleParks = useMemo(
    () =>
      parks
        .filter((park) => state === "all" || park.states.includes(state))
        .filter((park) => completion === "all" || park.visited === (completion === "completed"))
        .toSorted((first, second) => {
          const comparison = first.displayName.localeCompare(second.displayName);
          return sortOrder === "ascending" ? comparison : -comparison;
        }),
    [completion, parks, sortOrder, state],
  );

  const controlClassName =
    "mt-1 w-full border border-stone-300 bg-white px-3 py-2 font-serif text-sm text-stone-900 outline-none transition-colors focus:border-[#859900] dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100";
  const controlsAreDefault = state === "all" && completion === "all" && sortOrder === "ascending";

  const resetControls = () => {
    setState("all");
    setCompletion("all");
    setSortOrder("ascending");
  };

  return (
    <>
      <NationalParksMap parks={mapParks} boundaries={mapBoundaries} boundarySourceUrl={boundarySourceUrl} />

      <div className="not-prose mt-10 grid gap-4 sm:grid-cols-3">
        <label className="text-[0.65rem] lowercase tracking-widest text-stone-400">
          state
          <select value={state} onChange={(event) => setState(event.target.value)} className={controlClassName}>
            <option value="all">all states &amp; territories</option>
            {states.map((stateName) => (
              <option key={stateName} value={stateName}>{stateName}</option>
            ))}
          </select>
        </label>
        <label className="text-[0.65rem] lowercase tracking-widest text-stone-400">
          completion
          <select
            value={completion}
            onChange={(event) => setCompletion(event.target.value as CompletionFilter)}
            className={controlClassName}
          >
            <option value="all">all parks</option>
            <option value="completed">completed</option>
            <option value="not-completed">not completed</option>
          </select>
        </label>
        <label className="text-[0.65rem] lowercase tracking-widest text-stone-400">
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

      <div className="not-prose mt-3 flex justify-end">
        <button
          type="button"
          onClick={resetControls}
          disabled={controlsAreDefault}
          className="cursor-pointer font-serif text-xs text-stone-500 underline decoration-stone-300 underline-offset-4 transition-colors hover:text-[#6f8200] disabled:cursor-default disabled:opacity-40 disabled:hover:text-stone-500"
        >
          reset filters &amp; sort
        </button>
      </div>

      <p
        className="not-prose mt-4 flex items-center justify-between gap-4 text-xs tabular-nums text-stone-450"
        aria-live="polite"
      >
        <span>{visibleParks.length} {visibleParks.length === 1 ? "park" : "parks"}</span>
        <span>{visitedParkCount} visited</span>
      </p>

      <div className="not-prose mt-5 border-t border-stone-300 dark:border-stone-700">
        {visibleParks.map((park) => (
          <div
            key={park.slug}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-300 py-4 dark:border-stone-700"
          >
            <Link
              href={`/venture/parks/${park.slug}`}
              className="group col-span-2 grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 text-stone-900 no-underline transition-colors hover:text-[#6f8200] dark:text-stone-100"
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
