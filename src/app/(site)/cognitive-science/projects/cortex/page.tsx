import type { Metadata } from "next";
import { ProjectShell } from "@/components/science/science-content";

export const metadata: Metadata = {
  title: "cortex",
  description: "The tidyverse for computational neuroscience.",
};

export default function CortexProjectPage() {
  return (
    <ProjectShell title="cortex" subtitle="the tidyverse for computational neuroscience.">
      <p>coming soon</p>
    </ProjectShell>
  );
}
