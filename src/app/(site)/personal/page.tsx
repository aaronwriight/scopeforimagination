import type { Metadata } from "next";
import { PersonalShell } from "@/components/site/site-content";
import { PersonalDropdowns } from "@/components/site/personal-dropdowns";

export const metadata: Metadata = {
  title: "personal",
  description: "favorite stories, communities, and inspirations",
  metadataBase: new URL(`https://${process.env.VERCEL_URL}`),
};

export default function PersonalPage() {
  return (
    <PersonalShell title="personal">
      <p>I <em>love</em> a good story.</p>
      <p>
        I hold a variety of things in my heart, many of which have shaped my approach to cognitive science. I am deeply inspired by the great
        outdoors and music, and yet no singular peak, terrestrial or acoustic, reflects my whole story. Everything below has been uniquely impactful,
        whether challenging me to reconcile my understanding of different aspects of humanity, or providing touchpoints to couch my studies in
        creativity.
      </p>
      <PersonalDropdowns />
    </PersonalShell>
  );
}
