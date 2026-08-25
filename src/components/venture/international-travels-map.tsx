"use client";

import {
  drag,
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
import { createGlobeReliefRenderer } from "@/components/venture/globe-relief";

export type TravelMapDestination = Readonly<{
  slug: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}>;

type RenderDestination = TravelMapDestination &
  Readonly<{
    geometry: GeoGeometryObjects;
  }>;

type MapControls = Readonly<{
  zoomBy: (factor: number) => void;
  reset: () => void;
}>;

const mapWidth = 960;
const indexMapHeight = 600;
const atlasMapHeight = 566;
const restingScale = 252;
const minimumScale = 185;
const maximumScale = 3600;
const initialRotation: [number, number, number] = [-43, -35, 0];
const markerGreen = "#859900";
const countryIdsBySlug: Readonly<Record<string, string>> = Object.freeze({
  iceland: "352",
  turkiye: "792",
  cambodia: "116",
});

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function InternationalTravelsMap({
  destinations,
  variant = "index",
}: {
  destinations: readonly TravelMapDestination[];
  variant?: "index" | "atlas";
}) {
  const mapHeight = variant === "atlas" ? atlasMapHeight : indexMapHeight;
  const svgRef = useRef<SVGSVGElement>(null);
  const reliefCanvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<MapControls>({
    zoomBy: () => undefined,
    reset: () => undefined,
  });

  useEffect(() => {
    const element = svgRef.current;
    const reliefCanvas = reliefCanvasRef.current;
    if (!element || !reliefCanvas) return;

    const svg = select(element);
    svg.selectAll("*").remove();

    const projection = geoOrthographic()
      .translate([mapWidth / 2, mapHeight / 2])
      .scale(restingScale)
      .clipAngle(90)
      .precision(0.2)
      .rotate(initialRotation);
    const path = geoPath(projection);
    const topology = world as unknown as Parameters<typeof feature>[0];
    const countries = feature(topology, topology.objects.countries);
    const countryFeatures = countries.type === "FeatureCollection" ? countries.features : [countries];
    const countriesById = new Map(countryFeatures.map((country) => [String(country.id), country]));
    const renderDestinations = destinations.flatMap((destination): RenderDestination[] => {
      const countryId = countryIdsBySlug[destination.slug];
      const country = countryId ? countriesById.get(countryId) : undefined;
      if (!country) return [];

      return [
        {
          ...destination,
          geometry: country.geometry as unknown as GeoGeometryObjects,
        },
      ];
    });

    svg.append("title").text("Interactive globe of international travels");
    svg
      .append("desc")
      .text(
        "A globe with subtle shaded terrain relief. Iceland, Türkiye, and Cambodia are shaded in green. Drag or use the arrow keys to rotate, scroll or use the map controls to zoom, and select a country or marker to open its page.",
      );

    const sphere = { type: "Sphere" } as GeoGeometryObjects;
    const graticule = geoGraticule10();

    const spherePath = svg
      .append("path")
      .datum(sphere)
      .attr("fill", "transparent")
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
      .attr("fill-opacity", 0.34)
      .attr("stroke", "#d6d3d1")
      .attr("stroke-width", 0.65)
      .attr("vector-effect", "non-scaling-stroke");

    const destinationLinks = svg
      .append("g")
      .attr("aria-label", "International travel destinations")
      .selectAll<SVGAElement, RenderDestination>("a")
      .data(renderDestinations, (destination) => destination.slug)
      .join("a")
      .attr("href", (destination) => `/venture/travels/${destination.slug}`)
      .attr("aria-label", (destination) => `${destination.name}, ${destination.region}`)
      .attr("class", "group outline-none");

    destinationLinks
      .append("path")
      .attr("fill", markerGreen)
      .attr("fill-opacity", 0.38)
      .attr("stroke", markerGreen)
      .attr("stroke-opacity", 0.95)
      .attr("stroke-width", 1.35)
      .attr("vector-effect", "non-scaling-stroke")
      .attr("class", "transition-[fill-opacity] group-hover:fill-opacity-60 group-focus:fill-opacity-60");

    const markerGroups = destinationLinks
      .append("g")
      .attr("class", "pointer-events-none");

    markerGroups
      .append("circle")
      .attr("r", 14)
      .attr("fill", "transparent")
      .attr("stroke", "none");

    markerGroups
      .append("circle")
      .attr("r", 5)
      .attr("fill", markerGreen)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2.25)
      .attr("class", "transition-[r] group-hover:[r:7px] group-focus:[r:7px]");

    markerGroups
      .append("line")
      .attr("x1", 7)
      .attr("y1", -5)
      .attr("x2", 51)
      .attr("y2", -27)
      .attr("stroke", markerGreen)
      .attr("stroke-width", 1)
      .attr(
        "class",
        "opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100",
      );

    markerGroups
      .append("text")
      .attr("x", 57)
      .attr("y", -24)
      .attr("fill", "#44403c")
      .attr("font-family", "serif")
      .attr("font-size", 13)
      .attr("paint-order", "stroke")
      .attr("stroke", "#ffffff")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 5)
      .attr(
        "class",
        "opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100",
      )
      .text((destination) => destination.name);

    destinationLinks.append("title").text((destination) => destination.name);

    const drawVectorFrame = () => {
      spherePath.attr("d", () => path(sphere));
      graticulePath.attr("d", () => path(graticule));
      countryPaths.attr("d", (country) => path(country));

      const rotation = projection.rotate();
      const visibleCenter: [number, number] = [-rotation[0], -rotation[1]];

      destinationLinks.each(function updateDestination(destination) {
        const destinationPath = path(destination.geometry);
        const coordinates: [number, number] = [destination.longitude, destination.latitude];
        const projected = projection(coordinates);
        const markerVisible =
          projected !== null && geoDistance(coordinates, visibleCenter) <= Math.PI / 2;
        const link = select(this);

        link
          .attr("display", destinationPath ? null : "none")
          .attr("tabindex", destinationPath ? 0 : -1)
          .select("path")
          .attr("d", destinationPath);

        const marker = link.select<SVGGElement>("g");
        marker
          .attr("display", markerVisible ? null : "none")
          .attr("transform", projected ? `translate(${projected[0]},${projected[1]})` : null);

        const extendLeft = Boolean(projected && projected[0] > mapWidth * 0.68);
        const direction = extendLeft ? -1 : 1;
        marker.select("line").attr("x1", 7 * direction).attr("x2", 51 * direction);
        marker
          .select("text")
          .attr("x", 57 * direction)
          .attr("text-anchor", extendLeft ? "end" : "start");
      });
    };

    const reliefRenderer = createGlobeReliefRenderer({
      canvas: reliefCanvas,
      width: mapWidth,
      height: mapHeight,
      renderScale: 0.5,
      opacity: 0.72,
      fadeStartScale: restingScale * 4,
      fadeEndScale: restingScale * 10,
      // Keep the SVG boundaries and the prefiltered terrain moving at the
      // display cadence during the gentle automatic spin.
      minimumFrameInterval: 16,
      onFrame: drawVectorFrame,
    });

    const draw = (immediate = false) => {
      // Once the texture is available, its renderer owns the vector redraw so
      // every visible layer advances on one projection frame. Before then, keep
      // the lightweight vector globe animated as a graceful loading fallback.
      const terrainWillDraw = reliefRenderer.requestDraw(projection, immediate);
      if (!terrainWillDraw) drawVectorFrame();
    };

    const rotateFromKeyboard = (longitude: number, latitude: number) => {
      const current = projection.rotate();
      projection.rotate([
        current[0] + longitude,
        clamp(current[1] + latitude, -82, 82),
        current[2],
      ]);
      draw(true);
    };

    const zoomBy = (factor: number) => {
      projection.scale(clamp(projection.scale() * factor, minimumScale, maximumScale));
      draw(true);
    };

    const reset = () => {
      projection.rotate(initialRotation).scale(restingScale);
      draw(true);
    };

    controlsRef.current = { zoomBy, reset };
    draw();

    let paused = false;
    let dragging = false;
    let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
    };
    reducedMotionQuery.addEventListener("change", updateMotionPreference);

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
          zoomBy(Math.exp(-event.deltaY * 0.0017));
        },
        { passive: false },
      )
      .on("dblclick.zoom", (event: MouseEvent) => {
        event.preventDefault();
        zoomBy(2.4);
      })
      .on("keydown.rotate", (event: KeyboardEvent) => {
        if (event.key === "ArrowLeft") rotateFromKeyboard(-8, 0);
        else if (event.key === "ArrowRight") rotateFromKeyboard(8, 0);
        else if (event.key === "ArrowUp") rotateFromKeyboard(0, -6);
        else if (event.key === "ArrowDown") rotateFromKeyboard(0, 6);
        else if (event.key === "+" || event.key === "=") zoomBy(1.4);
        else if (event.key === "-" || event.key === "_") zoomBy(1 / 1.4);
        else if (event.key === "0") reset();
        else return;
        event.preventDefault();
      });

    const dragBehavior = drag<SVGSVGElement, unknown>()
      .on("start", () => {
        dragging = true;
        paused = true;
        svg.style("cursor", "grabbing");
      })
      .on("drag", (event: D3DragEvent<SVGSVGElement, unknown, unknown>) => {
        const current = projection.rotate();
        const sensitivity = clamp((restingScale / projection.scale()) * 0.3, 0.025, 0.34);
        projection.rotate([
          current[0] + event.dx * sensitivity,
          clamp(current[1] - event.dy * sensitivity, -82, 82),
          current[2],
        ]);
        draw(true);
      })
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
      projection.rotate([current[0] + delta * 0.0028, current[1], current[2]]);
      draw();
    });

    return () => {
      spinTimer.stop();
      reliefRenderer.destroy();
      reducedMotionQuery.removeEventListener("change", updateMotionPreference);
      controlsRef.current = { zoomBy: () => undefined, reset: () => undefined };
      svg.on(".pause", null).on(".rotate", null).on(".zoom", null).on(".drag", null);
      svg.selectAll("*").remove();
    };
  }, [destinations, mapHeight]);

  return (
    <figure className={`not-prose m-0 w-full ${variant === "atlas" ? "mt-0" : "mt-9"}`}>
      <div className="relative overflow-hidden border border-stone-200 bg-white dark:border-stone-700">
        <canvas
          ref={reliefCanvasRef}
          width={Math.round(mapWidth * 0.5)}
          height={Math.round(mapHeight * 0.5)}
          className="pointer-events-none absolute inset-0 block h-full w-full"
          aria-hidden="true"
        />
        <svg
          ref={svgRef}
          className={`relative block w-full touch-none select-none outline-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none ${variant === "atlas" ? "aspect-[56/33]" : "aspect-[8/5]"}`}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          tabIndex={0}
          aria-label="Interactive terrain-relief globe of international travels. Drag or use arrow keys to rotate, scroll or use plus and minus to zoom, and select a shaded country or green marker to open its page."
        />

        <div className="absolute right-3 top-3 flex gap-1" aria-label="map zoom controls">
          <button
            type="button"
            onClick={() => controlsRef.current.zoomBy(1.45)}
            className="flex h-8 w-8 items-center justify-center border border-stone-300 bg-white/95 font-serif text-base text-stone-600 transition-colors hover:border-[#859900] hover:text-[#6f8200] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#859900]"
            aria-label="zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => controlsRef.current.zoomBy(1 / 1.45)}
            className="flex h-8 w-8 items-center justify-center border border-stone-300 bg-white/95 font-serif text-base text-stone-600 transition-colors hover:border-[#859900] hover:text-[#6f8200] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#859900]"
            aria-label="zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => controlsRef.current.reset()}
            className="h-8 border border-stone-300 bg-white/95 px-2.5 text-[0.62rem] lowercase tracking-wider text-stone-600 transition-colors hover:border-[#859900] hover:text-[#6f8200] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#859900]"
          >
            reset
          </button>
        </div>
      </div>

      <figcaption className={`${variant === "atlas" ? "mt-1.5" : "mt-2"} flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[0.68rem] text-stone-500`}>
        <span>drag to rotate · scroll or use controls to zoom</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#859900]" aria-hidden="true" />
          visited country
        </span>
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer" className="text-[#6f8200]">
          boundaries &amp; terrain: Natural Earth ↗
        </a>
      </figcaption>
    </figure>
  );
}
