import type { Metadata } from "next";
import { ProjectShell } from "@/components/science/science-content";
import { PublicationLinks } from "@/components/science/publication-links";

export const metadata: Metadata = {
  title: "extended language network",
  description: "Extended language network project",
};

export default function ExtendedLanguageNetworkProjectPage() {
  return (
    <ProjectShell title="extended language network">
      <p>
        Language neuroscience has largely focused on core left frontal and temporal areas, but many other cortical, subcortical, and cerebellar areas
        have been implicated in linguistic processing. This project asks which of those areas respond reliably and selectively to language, and what
        their contributions may be.
      </p>
      <PublicationLinks
        links={[
          { label: "DOI", href: "https://doi.org/10.1523/JNEUROSCI.0638-25.2026" },
          { label: "PDF", href: "https://www.jneurosci.org/content/jneuro/early/2026/06/24/JNEUROSCI.0638-25.2026.full.pdf" },
          { label: "OSF", href: "https://osf.io/7594t/" },
          {
            label: "Press",
            href: "https://mcgovern.mit.edu/2026/07/01/the-brains-language-network-is-more-extensive-than-previously-thought/",
          },
        ]}
      >
        <p>
          Using fMRI data from 772 participants performing an extensively validated language localizer, this work delineates areas that respond
          reliably to language across written and auditory modalities and evaluates their selectivity relative to a demanding non-linguistic task.
          The newly identified extended language-selective network includes areas around the temporal poles, medial frontal cortex, hippocampus, and
          cerebellum.
        </p>
      </PublicationLinks>
    </ProjectShell>
  );
}
