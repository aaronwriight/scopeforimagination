import type { Metadata } from "next";
import { VentureShell } from "@/components/site/site-content";

export const metadata: Metadata = {
  title: "about | venture",
  description: "An author's note about Venture, coming soon.",
};

export default function VentureAboutPage() {
  return (
    <VentureShell title="about" subtitle="an author's note is coming soon">
      {null}
    </VentureShell>
  );
}
