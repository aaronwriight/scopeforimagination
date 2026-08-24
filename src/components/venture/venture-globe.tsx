"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type VentureMapEntry = {
  title: string;
  slug: string;
  location: string;
  latitude: number;
  longitude: number;
};

type Rotation = { longitude: number; latitude: number };
type MarkerHit = VentureMapEntry & { x: number; y: number; radius: number };

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function VentureGlobe({ entries }: { entries: VentureMapEntry[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerHitsRef = useRef<MarkerHit[]>([]);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    longitude: number;
    latitude: number;
    moved: boolean;
  } | null>(null);
  const [rotation, setRotation] = useState<Rotation>({ longitude: -75, latitude: 20 });
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [resizeVersion, setResizeVersion] = useState(0);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setDarkMode(media.matches);
    updateTheme();
    media.addEventListener("change", updateTheme);
    return () => media.removeEventListener("change", updateTheme);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => setResizeVersion((version) => version + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * pixelRatio);
    canvas.height = Math.round(bounds.height * pixelRatio);

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    const radius = Math.min(bounds.width, bounds.height) * 0.38;
    const centerLongitude = toRadians(rotation.longitude);
    const centerLatitude = toRadians(rotation.latitude);

    const project = (latitude: number, longitude: number) => {
      const phi = toRadians(latitude);
      const lambda = toRadians(longitude);
      const delta = lambda - centerLongitude;
      const front =
        Math.sin(centerLatitude) * Math.sin(phi) +
        Math.cos(centerLatitude) * Math.cos(phi) * Math.cos(delta);

      return {
        x: centerX + radius * Math.cos(phi) * Math.sin(delta),
        y:
          centerY -
          radius *
            (Math.cos(centerLatitude) * Math.sin(phi) - Math.sin(centerLatitude) * Math.cos(phi) * Math.cos(delta)),
        front,
      };
    };

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.clip();

    const sphere = context.createRadialGradient(
      centerX - radius * 0.32,
      centerY - radius * 0.38,
      radius * 0.08,
      centerX,
      centerY,
      radius,
    );
    if (darkMode) {
      sphere.addColorStop(0, "#3c4031");
      sphere.addColorStop(0.72, "#24271f");
      sphere.addColorStop(1, "#171914");
    } else {
      sphere.addColorStop(0, "#f5f3e8");
      sphere.addColorStop(0.72, "#dedfc8");
      sphere.addColorStop(1, "#c5c9a6");
    }
    context.fillStyle = sphere;
    context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    context.lineWidth = 0.7;
    context.strokeStyle = darkMode ? "rgba(214, 217, 190, 0.18)" : "rgba(86, 99, 49, 0.22)";

    const drawProjectedLine = (points: Array<[number, number]>) => {
      context.beginPath();
      let drawing = false;
      for (const [latitude, longitude] of points) {
        const point = project(latitude, longitude);
        if (point.front > 0) {
          if (drawing) context.lineTo(point.x, point.y);
          else context.moveTo(point.x, point.y);
          drawing = true;
        } else {
          drawing = false;
        }
      }
      context.stroke();
    };

    for (let latitude = -60; latitude <= 60; latitude += 20) {
      const points: Array<[number, number]> = [];
      for (let longitude = -180; longitude <= 180; longitude += 3) points.push([latitude, longitude]);
      drawProjectedLine(points);
    }

    for (let longitude = -180; longitude < 180; longitude += 20) {
      const points: Array<[number, number]> = [];
      for (let latitude = -90; latitude <= 90; latitude += 3) points.push([latitude, longitude]);
      drawProjectedLine(points);
    }

    context.restore();

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.lineWidth = 1;
    context.strokeStyle = darkMode ? "rgba(214, 217, 190, 0.42)" : "rgba(86, 99, 49, 0.4)";
    context.stroke();

    const hits: MarkerHit[] = [];
    for (const entry of entries) {
      const point = project(entry.latitude, entry.longitude);
      if (point.front <= 0) continue;

      const isHovered = entry.slug === hoveredSlug;
      const markerRadius = isHovered ? 6 : 4.5;
      context.beginPath();
      context.arc(point.x, point.y, markerRadius + 3, 0, Math.PI * 2);
      context.fillStyle = "rgba(111, 130, 0, 0.18)";
      context.fill();
      context.beginPath();
      context.arc(point.x, point.y, markerRadius, 0, Math.PI * 2);
      context.fillStyle = darkMode ? "#c7d35c" : "#6f8200";
      context.fill();

      hits.push({ ...entry, x: point.x, y: point.y, radius: 12 });

      if (isHovered) {
        context.font = "12px Georgia, serif";
        const labelWidth = context.measureText(entry.title).width + 16;
        const labelX = clamp(point.x + 10, 8, bounds.width - labelWidth - 8);
        const labelY = clamp(point.y - 29, 8, bounds.height - 30);
        context.fillStyle = darkMode ? "rgba(28, 28, 24, 0.94)" : "rgba(255, 255, 250, 0.94)";
        context.fillRect(labelX, labelY, labelWidth, 24);
        context.fillStyle = darkMode ? "#e7e5df" : "#292a24";
        context.fillText(entry.title, labelX + 8, labelY + 16);
      }
    }
    markerHitsRef.current = hits;
  }, [darkMode, entries, hoveredSlug, resizeVersion, rotation]);

  const findMarker = (x: number, y: number) =>
    markerHitsRef.current.find((marker) => Math.hypot(marker.x - x, marker.y - y) <= marker.radius);

  const getPointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const rotate = (longitudeDelta: number, latitudeDelta: number) => {
    setRotation((current) => ({
      longitude: current.longitude + longitudeDelta,
      latitude: clamp(current.latitude + latitudeDelta, -70, 70),
    }));
  };

  return (
    <div className="not-prose">
      <div className="relative aspect-[16/10] min-h-72 overflow-hidden rounded-sm border border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          role="application"
          tabIndex={0}
          aria-label="Interactive globe of Venture entries. Drag to rotate, use the arrow keys, or choose an entry below."
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") rotate(-8, 0);
            else if (event.key === "ArrowRight") rotate(8, 0);
            else if (event.key === "ArrowUp") rotate(0, 6);
            else if (event.key === "ArrowDown") rotate(0, -6);
            else return;
            event.preventDefault();
          }}
          onPointerDown={(event) => {
            const point = getPointerPosition(event);
            dragRef.current = {
              pointerId: event.pointerId,
              x: point.x,
              y: point.y,
              longitude: rotation.longitude,
              latitude: rotation.latitude,
              moved: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const point = getPointerPosition(event);
            const drag = dragRef.current;
            if (drag && drag.pointerId === event.pointerId) {
              const deltaX = point.x - drag.x;
              const deltaY = point.y - drag.y;
              if (Math.abs(deltaX) + Math.abs(deltaY) > 3) drag.moved = true;
              setRotation({
                longitude: drag.longitude - deltaX * 0.45,
                latitude: clamp(drag.latitude + deltaY * 0.35, -70, 70),
              });
              setHoveredSlug(null);
              event.currentTarget.style.cursor = "grabbing";
              return;
            }

            const marker = findMarker(point.x, point.y);
            setHoveredSlug(marker?.slug || null);
            event.currentTarget.style.cursor = marker ? "pointer" : "grab";
          }}
          onPointerUp={(event) => {
            const point = getPointerPosition(event);
            const drag = dragRef.current;
            if (drag && !drag.moved) {
              const marker = findMarker(point.x, point.y);
              if (marker) router.push(`/venture/${marker.slug}`);
            }
            dragRef.current = null;
            event.currentTarget.style.cursor = "grab";
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            dragRef.current = null;
            event.currentTarget.style.cursor = "grab";
          }}
          onPointerLeave={(event) => {
            if (!dragRef.current) {
              setHoveredSlug(null);
              event.currentTarget.style.cursor = "grab";
            }
          }}
        />

        {entries.length === 0 && (
          <p className="pointer-events-none absolute inset-x-6 bottom-6 m-0 text-center font-serif text-xs italic text-stone-500">
            adventures will surface here as entries are added
          </p>
        )}

        <div className="absolute bottom-3 right-3 flex gap-1" aria-label="Globe rotation controls">
          <button type="button" onClick={() => rotate(-12, 0)} aria-label="Rotate globe west" className="h-7 w-7 border border-stone-300 bg-stone-50/90 text-stone-500 hover:text-[#6f8200] dark:border-stone-700 dark:bg-stone-900/90">
            ←
          </button>
          <button type="button" onClick={() => rotate(12, 0)} aria-label="Rotate globe east" className="h-7 w-7 border border-stone-300 bg-stone-50/90 text-stone-500 hover:text-[#6f8200] dark:border-stone-700 dark:bg-stone-900/90">
            →
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-stone-500">Drag to rotate. Select a marker to open its field note.</p>

      {entries.length > 0 && (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.slug}>
              <Link href={`/venture/${entry.slug}`} className="block border-l border-stone-300 pl-3 dark:border-stone-700">
                <span className="block font-serif text-sm text-stone-800 dark:text-stone-200">{entry.title}</span>
                <span className="block text-xs text-stone-500">{entry.location}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
