import type { Metadata } from "next";
import { VentureShell } from "@/components/site/site-content";
import { Northeast115Index } from "@/components/venture/northeast-115-index";
import {
  getAllNortheastPeaks,
  getCompletedNortheastRangeAreas,
} from "@/lib/venture-trails";

export const metadata: Metadata = {
  title: "northeast 115 | venture",
  description: "A summit-by-summit log of the Northeast 115.",
};

export default function VentureTrailsPage() {
  const peaks = getAllNortheastPeaks();
  const rangeAreas = getCompletedNortheastRangeAreas();

  return (
    <VentureShell title="northeast 115">
      <p>
        A summit-by-summit log of the 4000-footers across New Hampshire, New York, Maine, and Vermont.
      </p>
      <Northeast115Index peaks={peaks} rangeAreas={rangeAreas} />
    </VentureShell>
  );
}
