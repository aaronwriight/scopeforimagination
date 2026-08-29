import type { Metadata } from "next";
import { LiteratureShell } from "@/components/site/site-content";

export const metadata: Metadata = {
  title: "shared agency",
  description: "Shared agency writing by Aaron Wright",
};

export default function SharedAgencyPage() {
  return (
    <LiteratureShell title="shared agency" subtitle="coming soon">
      {null}
    </LiteratureShell>
  );
}
