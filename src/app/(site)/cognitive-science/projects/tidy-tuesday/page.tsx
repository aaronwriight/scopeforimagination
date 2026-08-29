import type { Metadata } from "next";
import { ProjectShell } from "@/components/science/science-content";

export const metadata: Metadata = {
  title: "tidy tuesday",
  description: "Tidy Tuesday visualizations by Aaron Wright",
};

export default function TidyTuesdayProjectPage() {
  return (
    <ProjectShell title="tidy tuesday" subtitle="coming soon">
      {null}
    </ProjectShell>
  );
}
