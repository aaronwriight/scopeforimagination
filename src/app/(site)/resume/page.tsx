import type { Metadata } from "next";
import { ContactShell } from "@/components/site/site-content";

export const metadata: Metadata = {
  title: "resume",
  description: "Resume for Aaron Wright",
};

export default function ResumePage() {
  return <ContactShell title="resume" subtitle="coming soon">{null}</ContactShell>;
}
