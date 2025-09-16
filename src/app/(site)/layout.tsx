import type { Metadata } from "next";

import LiveVisualEditing from "@/components/live-visual-editing";
import { draftMode } from "next/headers";

import SiteChrome from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "scope for imagination",
  description: "an ode to slow living",
  metadataBase: new URL(`https://${process.env.VERCEL_URL}`),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <SiteChrome>
            {children}
            {isDraftMode && <LiveVisualEditing />}
    </SiteChrome>
  );
}
