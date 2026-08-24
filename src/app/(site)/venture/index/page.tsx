import type { Metadata } from "next";
import { VentureShell } from "@/components/site/site-content";
import { VentureEntryList } from "@/components/venture/venture-entry-list";
import { getAllVentureEntries } from "@/lib/venture-entries";

export const metadata: Metadata = {
  title: "index | venture",
  description: "A complete index of Venture field notes.",
};

export default async function VentureIndexPage() {
  const entries = await getAllVentureEntries();

  return (
    <VentureShell title="index">
      <div className="not-prose mt-10">
        <VentureEntryList entries={entries} />
      </div>
    </VentureShell>
  );
}
