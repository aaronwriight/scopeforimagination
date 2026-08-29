import type { Metadata } from "next";
import Link from "next/link";
import { VentureShell } from "@/components/site/site-content";
import { InternationalTravelsMap } from "@/components/venture/international-travels-map";
import { getAllTravelDestinations } from "@/lib/venture-travels";

export const metadata: Metadata = {
  title: "travels | venture",
  description: "A country-by-country index of international travels and their memories.",
};

export default function VentureTravelsPage() {
  const destinations = getAllTravelDestinations();

  return (
    <VentureShell title="travels" subtitle="a place-by-place record of journeys farther afield.">
      <InternationalTravelsMap destinations={destinations} />

      <div className="not-prose mt-10 border-t border-stone-300 dark:border-stone-700">
        {destinations.map((destination, index) => (
          <Link
            key={destination.slug}
            href={`/venture/travels/${destination.slug}`}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-stone-300 py-4 text-stone-900 transition-colors hover:text-[#6f8200] dark:border-stone-700 dark:text-stone-100"
          >
            <span className="text-xs tabular-nums text-stone-400">{String(index + 1).padStart(2, "0")}</span>
            <span>
              <span className="block font-serif text-sm text-current">{destination.name}</span>
              <span className="mt-0.5 block text-[0.68rem] text-stone-500">{destination.region}</span>
            </span>
            <span className="text-[0.65rem] lowercase tracking-widest text-[#859900]">
              {destination.visits.length} {destination.visits.length === 1 ? "visit" : "visits"}
            </span>
          </Link>
        ))}
      </div>
    </VentureShell>
  );
}
