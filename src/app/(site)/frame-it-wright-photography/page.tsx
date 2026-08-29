import type { Metadata } from "next";
import { PhotographyShell } from "@/components/site/site-content";

export const metadata: Metadata = {
  title: "frame it wright photography",
  description: "Frame It Wright Photography",
};

export default function FrameItWrightPhotographyPage() {
  return (
    <PhotographyShell title="frame it wright photography" subtitle="coming soon">
      {null}
    </PhotographyShell>
  );
}
