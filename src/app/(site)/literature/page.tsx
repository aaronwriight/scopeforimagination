import type { Metadata } from "next";
import { LiteratureShell } from "@/components/site/site-content";

export const metadata: Metadata = {
  title: "literature",
  description: "Literature",
};

export default function LiteraturePage() {
  return (
    <LiteratureShell title="literature" subtitle="coming soon">
      {null}
    </LiteratureShell>
  );
}
