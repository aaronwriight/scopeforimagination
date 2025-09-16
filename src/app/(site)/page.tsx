// ./app/page.tsx

import Guides from "@/components/guides/guides";
import { loadQuery } from "@/sanity/lib/store";
import { GUIDE_INDEX_LIST } from "@/sanity/lib/queries/guide";
import { SanityGuide } from "@/sanity/types/guides";
import { draftMode } from "next/headers";
import GuidesPreview from "@/components/guides/guides-preview";
import { Metadata } from "next";
export const metadata: Metadata = {
  title: "scope for imagination",
  description: "an ode to slow living",
  metadataBase: new URL(`https://${process.env.VERCEL_URL}`),
  openGraph: {
    title: "scope for imagination",
    description: "an ode to slow living",
    images: ["/images/sand_dollar.png"],
    authors: ["https://aaronwriight.github.io"],
  },
};
export default async function Page() {
  const { isEnabled: isDraftMode } = await draftMode();

  const initial = await loadQuery<SanityGuide[]>(
    GUIDE_INDEX_LIST,
    {},
    {
      perspective: isDraftMode ? "previewDrafts" : "published",
    },
  );

  return isDraftMode ? (
    <GuidesPreview initial={initial} />
  ) : (
    <Guides guides={initial.data} />
  );
}
