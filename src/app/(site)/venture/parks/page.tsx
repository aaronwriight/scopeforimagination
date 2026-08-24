import type { Metadata } from "next";
import Link from "next/link";
import { VentureShell } from "@/components/site/site-content";
import { getAllNationalParks } from "@/lib/venture-parks";

export const metadata: Metadata = {
  title: "parks | venture",
  description: "Aaron Wright's journal of the 63 U.S. national parks.",
};

export default function VentureParksPage() {
  const parks = getAllNationalParks();
  const recordedVisits = parks.filter((park) => park.visited).length;

  return (
    <VentureShell title="parks">
      <p className="font-serif text-stone-500">
        the 63 U.S. national parks
        {recordedVisits > 0 ? <span className="text-[#859900]"> · {recordedVisits} recorded</span> : " · visit history coming soon"}
      </p>
      <p>
        A place-by-place index for park visits and the memories attached to them. Every park already has a home here, ready for its first entry.
      </p>

      <div className="not-prose mt-10 border-t border-stone-300 dark:border-stone-700">
        {parks.map((park, index) => (
          <Link
            key={park.slug}
            href={`/venture/parks/${park.slug}`}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-stone-300 py-4 text-stone-700 transition-colors hover:text-[#6f8200] dark:border-stone-700 dark:text-stone-300"
          >
            <span className="text-xs tabular-nums text-stone-400">{String(index + 1).padStart(2, "0")}</span>
            <span>
              <span className="block font-serif text-sm text-current">{park.name}</span>
              <span className="mt-0.5 block text-[0.68rem] text-stone-500">{park.stateOrTerritory}</span>
            </span>
            <span className={park.visited ? "text-xs text-[#859900]" : "text-xs text-stone-300 dark:text-stone-700"} aria-hidden="true">
              ●
            </span>
            <span className="sr-only">{park.visited ? "visited" : "visit not yet recorded"}</span>
          </Link>
        ))}
      </div>
    </VentureShell>
  );
}
