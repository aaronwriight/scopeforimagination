import type { Metadata } from "next";
import { ScienceShell } from "@/components/science/science-content";

export const metadata: Metadata = {
  title: "mentorship",
  description: "Mentorship by Aaron Wright",
};

export default function MentorshipPage() {
  return (
    <ScienceShell title="mentorship" subtitle="coming soon">
      {null}
    </ScienceShell>
  );
}
