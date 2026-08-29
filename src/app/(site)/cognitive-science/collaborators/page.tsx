import type { Metadata } from "next";
import { ScienceShell } from "@/components/science/science-content";

export const metadata: Metadata = {
  title: "collaborators",
  description: "Collaborators in cognitive science",
};

export default function CollaboratorsPage() {
  return (
    <ScienceShell title="collaborators" subtitle="coming soon">
      {null}
    </ScienceShell>
  );
}
