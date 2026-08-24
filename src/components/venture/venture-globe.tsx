"use client";

import {
  drag,
  geoCircle,
  geoDistance,
  geoGraticule10,
  geoOrthographic,
  geoPath,
  select,
  timer,
  type D3DragEvent,
  type GeoGeometryObjects,
} from "d3";
import { useEffect, useRef } from "react";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";

export type VentureMapEntry = {
  id: string;
  title: string;
  href: string;
  location: string;
  latitude: number;
  longitude: number;
  kind?: "entry" | "peak" | "park" | "travel";
  group?: string;
};

export type VentureMapRegion = {
  id: string;
  title: string;
  href: string;
  geometry: GeoGeometryObjects;
};

export type VentureMapRange = {
  id: string;
  latitude: number;
  longitude: number;
  radiusDegrees: number;
};

const width = 960;
const height = 540;
const restingScale = 224;
const minimumScale = 190;
const maximumScale = 2800;
const markerGreen = "#859900";
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function VentureGlobe({
  entries,
  regions = [],
  ranges = [],
}: {
  entries: VentureMapEntry[];
  regions?: VentureMapRegion[];
  ranges?: VentureMapRange[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;

    const svg = select(element);
    svg.selectAll("*").remove();

    const projection = geoOrthographic()
      .translate([width / 2, height / 2])
      .scale(restingScale)
      .clipAngle(90)
      .precision(0.2)
      .rotate([75, -35, 0]);
    const path = geoPath(projection);
    const topology = world as unknown as Parameters<typeof feature>[0];
    const countries = feature(topology, topology.objects.countries);
    const countryFeatures = countries.type === "FeatureCollection" ? countries.features : [countries];

    svg
      .append("title")
      .text("Interactive globe of Venture places");
    svg
      .append("desc")
      .text(
        "The globe spins slowly. Drag it or use the arrow keys to rotate, scroll or double-click to zoom, then select a green marker to open that place's entry.",
      );

    const sphere = { type: "Sphere" } as GeoGeometryObjects;
    const graticule = geoGraticule10();
    const peakGroups = new Map<string, VentureMapEntry[]>();
    for (const entry of entries) {
      if (entry.kind !== "peak" || !entry.group) continue;
      peakGroups.set(entry.group, [...(peakGroups.get(entry.group) ?? []), entry]);
    }
    const inferredRangeRegions = [...peakGroups.entries()].map(([name, rangeEntries]) => {
      const center: [number, number] = [
        rangeEntries.reduce((total, entry) => total + entry.longitude, 0) / rangeEntries.length,
        rangeEntries.reduce((total, entry) => total + entry.latitude, 0) / rangeEntries.length,
      ];
      const radius = clamp(
        Math.max(
          0.25,
          ...rangeEntries.map(
            (entry) => geoDistance(center, [entry.longitude, entry.latitude]) * (180 / Math.PI) + 0.18,
          ),
        ),
        0.25,
        2.5,
      );

      return {
        id: `range:${name}`,
        geometry: geoCircle().center(center).radius(radius)() as GeoGeometryObjects,
      };
    });
    const rangeRegions = ranges.length > 0
      ? ranges.map((range) => ({
          id: range.id,
          geometry: geoCircle()
            .center([range.longitude, range.latitude])
            .radius(range.radiusDegrees)() as GeoGeometryObjects,
        }))
      : inferredRangeRegions;

    const spherePath = svg
      .append("path")
      .datum(sphere)
      .attr("fill", "#ffffff")
      .attr("stroke", "#d6d3d1")
      .attr("stroke-width", 1.25);

    const graticulePath = svg
      .append("path")
      .datum(graticule)
      .attr("fill", "none")
      .attr("stroke", "#e7e5e4")
      .attr("stroke-width", 0.7);

    const countryPaths = svg
      .append("g")
      .attr("aria-hidden", "true")
      .selectAll("path")
      .data(countryFeatures)
      .join("path")
      .attr("fill", "#f4f2ec")
      .attr("stroke", "#d6d3d1")
      .attr("stroke-width", 0.65);

    const rangePaths = svg
      .append("g")
      .attr("aria-hidden", "true")
      .selectAll<SVGPathElement, (typeof rangeRegions)[number]>("path")
      .data(rangeRegions, (region) => region.id)
      .join("path")
      .attr("fill", markerGreen)
      .attr("fill-opacity", 0.1)
      .attr("stroke", markerGreen)
      .attr("stroke-opacity", 0.32)
      .attr("stroke-width", 1);

    const regionLinks = svg
      .append("g")
      .attr("aria-label", "Visited park regions")
      .selectAll<SVGAElement, VentureMapRegion>("a")
      .data(regions, (region) => region.id)
      .join("a")
      .attr("href", (region) => region.href)
      .attr("aria-label", (region) => region.title)
      .attr("class", "outline-none");

    regionLinks
      .append("path")
      .attr("fill", markerGreen)
      .attr("fill-opacity", 0.42)
      .attr("stroke", markerGreen)
      .attr("stroke-width", 1.35)
      .attr("vector-effect", "non-scaling-stroke");

    regionLinks.append("title").text((region) => region.title);

    const markerLinks = svg
      .append("g")
      .attr("aria-label", "Venture places")
      .selectAll<SVGAElement, VentureMapEntry>("a")
      .data(entries, (entry) => entry.id)
      .join("a")
      .attr("class", "group outline-none")
      .attr("href", (entry) => entry.href)
      .attr("aria-label", (entry) => `${entry.title}, ${entry.location}`);

    markerLinks
      .append("circle")
      .attr("r", 14)
      .attr("fill", "transparent")
      .attr("stroke", "none");

    markerLinks
      .append("circle")
      .attr("class", "transition-[r] group-hover:[r:7px] group-focus:[r:7px]")
      .attr("r", 5)
      .attr("fill", markerGreen)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2.25);

    markerLinks
      .append("line")
      .attr("class", "pointer-events-none stroke-[#859900] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100")
      .attr("stroke-width", 1)
      .attr("x1", 7)
      .attr("y1", -5)
      .attr("x2", 46)
      .attr("y2", -25);

    markerLinks
      .append("text")
      .attr(
        "class",
        "pointer-events-none fill-stone-700 font-serif text-[12px] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100",
      )
      .attr("x", 51)
      .attr("y", -22)
      .attr("paint-order", "stroke")
      .attr("stroke", "#ffffff")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 5)
      .text((entry) => entry.title);

    markerLinks.append("title").text((entry) => `${entry.title} — ${entry.location}`);

    const draw = () => {
      spherePath.attr("d", () => path(sphere));
      graticulePath.attr("d", () => path(graticule));
      countryPaths.attr("d", (country) => path(country));
      rangePaths.attr("d", (region) => path(region.geometry));
      regionLinks.each(function updateRegion(region) {
        const regionPath = path(region.geometry);
        select(this)
          .attr("display", regionPath ? null : "none")
          .attr("tabindex", regionPath ? 0 : -1)
          .select("path")
          .attr("d", regionPath);
      });

      const rotation = projection.rotate();
      const visibleCenter: [number, number] = [-rotation[0], -rotation[1]];

      markerLinks.each(function updateMarker(entry) {
        const coordinates: [number, number] = [entry.longitude, entry.latitude];
        const projected = projection(coordinates);
        const visible =
          projected !== null &&
          geoDistance(coordinates, visibleCenter) <= Math.PI / 2;

        const marker = select(this);
        const extendLeft = Boolean(projected && projected[0] > width * 0.7);
        const direction = extendLeft ? -1 : 1;

        marker
          .attr("display", visible ? null : "none")
          .attr("tabindex", visible ? 0 : -1)
          .attr(
            "transform",
            projected ? `translate(${projected[0]},${projected[1]})` : null,
          );
        marker
          .select("line")
          .attr("x1", 7 * direction)
          .attr("x2", 46 * direction);
        marker
          .select("text")
          .attr("x", 51 * direction)
          .attr("text-anchor", extendLeft ? "end" : "start");
      });
    };

    draw();

    let paused = false;
    let dragging = false;
    let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
    };
    reducedMotionQuery.addEventListener("change", updateMotionPreference);

    const rotateFromKeyboard = (longitude: number, latitude: number) => {
      const current = projection.rotate();
      projection.rotate([
        current[0] + longitude,
        clamp(current[1] + latitude, -75, 75),
        current[2],
      ]);
      draw();
    };

    const zoomBy = (factor: number) => {
      projection.scale(clamp(projection.scale() * factor, minimumScale, maximumScale));
      draw();
    };

    svg
      .on("focusin.pause", () => {
        paused = true;
      })
      .on("focusout.pause", () => {
        paused = false;
      })
      .on(
        "wheel.zoom",
        (event: WheelEvent) => {
          event.preventDefault();
          zoomBy(Math.exp(-event.deltaY * 0.0015));
        },
        { passive: false },
      )
      .on("dblclick.zoom", (event: MouseEvent) => {
        event.preventDefault();
        zoomBy(projection.scale() < restingScale * 2 ? 4 : restingScale / projection.scale());
      })
      .on("keydown.rotate", (event: KeyboardEvent) => {
        if (event.key === "ArrowLeft") rotateFromKeyboard(-8, 0);
        else if (event.key === "ArrowRight") rotateFromKeyboard(8, 0);
        else if (event.key === "ArrowUp") rotateFromKeyboard(0, -6);
        else if (event.key === "ArrowDown") rotateFromKeyboard(0, 6);
        else if (event.key === "+" || event.key === "=") zoomBy(1.35);
        else if (event.key === "-" || event.key === "_") zoomBy(1 / 1.35);
        else if (event.key === "0") {
          projection.scale(restingScale);
          draw();
        }
        else return;
        event.preventDefault();
      });

    const dragBehavior = drag<SVGSVGElement, unknown>()
      .on("start", () => {
        dragging = true;
        paused = true;
        svg.style("cursor", "grabbing");
      })
      .on(
        "drag",
        (event: D3DragEvent<SVGSVGElement, unknown, unknown>) => {
          const current = projection.rotate();
          projection.rotate([
            current[0] + event.dx * 0.28,
            clamp(current[1] - event.dy * 0.24, -75, 75),
            current[2],
          ]);
          draw();
        },
      )
      .on("end", () => {
        dragging = false;
        paused = false;
        svg.style("cursor", "grab");
      });

    svg.call(dragBehavior).style("cursor", "grab");

    let previousElapsed = 0;
    const spinTimer = timer((elapsed) => {
      const delta = elapsed - previousElapsed;
      previousElapsed = elapsed;
      if (paused || dragging || reduceMotion) return;

      const current = projection.rotate();
      projection.rotate([current[0] + delta * 0.0045, current[1], current[2]]);
      draw();
    });

    return () => {
      spinTimer.stop();
      reducedMotionQuery.removeEventListener("change", updateMotionPreference);
      svg.on(".pause", null).on(".rotate", null).on(".zoom", null).on(".drag", null);
      svg.selectAll("*").remove();
    };
  }, [entries, ranges, regions]);

  return (
    <div className="not-prose w-full">
      <div className="relative w-full overflow-hidden border border-stone-200 bg-white dark:border-stone-700">
        <svg
          ref={svgRef}
          className="block aspect-[16/9] w-full touch-none select-none bg-white outline-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          tabIndex={0}
          aria-label="Interactive globe of Venture places. Drag or use arrow keys to rotate, scroll or use plus and minus to zoom, then select a marker to open its entry."
        />
        {entries.length === 0 && (
          <p className="pointer-events-none absolute inset-x-6 bottom-5 m-0 text-center font-serif text-xs italic text-stone-500">
            adventures will surface here as entries are added
          </p>
        )}
      </div>
      <p className="m-0 mt-2 text-center text-xs text-stone-500">
        drag to rotate · scroll or double-click to zoom · select a green marker to open its page
      </p>
    </div>
  );
}
