import type { Metadata } from "next";
import Link from "next/link";
import { VentureShell } from "@/components/site/site-content";
import { getAllNortheastPeaks } from "@/lib/venture-trails";

export const metadata: Metadata = {
  title: "trails | venture",
  description: "Aaron Wright's Northeast 115 peak log.",
};

export default function VentureTrailsPage() {
  const peaks = getAllNortheastPeaks();
  const completed = peaks.filter((peak) => peak.completed).length;

  return (
    <VentureShell title="trails">
      <p className="font-serif text-stone-500">
        the Northeast 115 · <span className="text-[#859900]">{completed} of {peaks.length} recorded</span>
      </p>
      <p>
        A summit-by-summit log of the 4,000-footers across New Hampshire, New York, Maine, and Vermont. Green marks a
        mountain already climbed; every row opens its field-note page.
      </p>

      <div className="not-prose mt-10 border-t border-stone-300 dark:border-stone-700">
        {peaks.map((peak) => (
          <Link
            key={peak.slug}
            href={`/venture/trails/${peak.slug}`}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-stone-300 py-4 text-stone-700 transition-colors hover:text-[#6f8200] dark:border-stone-700 dark:text-stone-300"
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
              <span className={peak.completed ? "text-[#859900]" : "text-stone-300 dark:text-stone-700"} aria-hidden="true">
                ●
              </span>
              <span className="sr-only">{peak.completed ? "climbed" : "not yet climbed"}</span>
            </span>
          </Link>
        ))}
      </div>
    </VentureShell>
  );
}
