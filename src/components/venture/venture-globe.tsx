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

export type VentureMapEntry = {
  id: string;
  title: string;
  href: string;
  location: string;
  latitude: number;
  longitude: number;
};

const width = 720;
const height = 720;
const restingScale = 306;
const minimumScale = 260;
const maximumScale = 3600;
const markerGreen = "#859900";
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function VentureGlobe({ entries }: { entries: VentureMapEntry[] }) {
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
      .append("text")
      .attr(
        "class",
        "pointer-events-none fill-stone-700 font-serif text-[12px] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100",
      )
      .attr("x", 11)
      .attr("y", -10)
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

      const rotation = projection.rotate();
      const visibleCenter: [number, number] = [-rotation[0], -rotation[1]];

      markerLinks.each(function updateMarker(entry) {
        const coordinates: [number, number] = [entry.longitude, entry.latitude];
        const projected = projection(coordinates);
        const visible =
          projected !== null &&
          geoDistance(coordinates, visibleCenter) <= Math.PI / 2;

        select(this)
          .attr("display", visible ? null : "none")
          .attr("tabindex", visible ? 0 : -1)
          .attr(
            "transform",
            projected ? `translate(${projected[0]},${projected[1]})` : null,
          );
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
      .on("pointerenter.pause", () => {
        paused = true;
      })
      .on("pointerleave.pause", () => {
        if (!dragging) paused = false;
      })
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
  }, [entries]);

  return (
    <div className="not-prose mx-auto w-full max-w-[42rem] bg-white">
      <svg
        ref={svgRef}
        className="block aspect-square w-full touch-none bg-white"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        tabIndex={0}
        aria-label="Interactive globe of Venture places. Drag or use arrow keys to rotate, scroll or use plus and minus to zoom, then select a marker to open its entry."
      />
      {entries.length === 0 && (
        <p className="m-0 -mt-7 pb-2 text-center font-serif text-xs italic text-stone-500">
          adventures will surface here as entries are added
        </p>
      )}
      <p className="m-0 mt-2 text-center text-xs text-stone-500">
        drag to rotate · scroll or double-click to zoom · select a green marker to read its field note
      </p>
    </div>
  );
}
