import type { Metadata } from "next";
import { ProjectShell } from "@/components/science/science-content";

export const metadata: Metadata = {
  title: "cortex",
  description: "The tidyverse for computational neuroscience.",
};

export default function CortexProjectPage() {
  return (
    <ProjectShell title="cortex">
      <p className="text-stone-500">The tidyverse for computational neuroscience.</p>
      <p>coming soon</p>
    </ProjectShell>
  );
}
