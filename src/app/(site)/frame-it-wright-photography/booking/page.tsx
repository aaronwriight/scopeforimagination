import type { Metadata } from "next";
import { PhotographyShell } from "@/components/site/site-content";

export const metadata: Metadata = {
  title: "photography booking",
  description: "Book Frame It Wright Photography",
};

export default function PhotographyBookingPage() {
  return <PhotographyShell title="booking" subtitle="coming soon">{null}</PhotographyShell>;
}
