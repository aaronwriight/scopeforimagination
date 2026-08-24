import type { Metadata } from "next";
import Link from "next/link";
import { ScienceShell } from "@/components/science/science-content";

export const metadata: Metadata = {
  title: "projects",
  description: "Research and data visualization projects by Aaron Wright",
};

const projects = [
  {
    section: "research",
    items: [
      {
        title: "extended language network",
        href: "/cognitive-science/projects/extended-language-network",
        description: "Language-selective brain areas whose contributions to language remain to be discovered.",
      },
    ],
  },
  {
    section: "software",
    items: [
      {
        title: "cortex",
        href: "/cognitive-science/projects/cortex",
        description: "The tidyverse for computational neuroscience.",
      },
    ],
  },
  {
    section: "data visualization",
    items: [
      {
        title: "tidy tuesday",
        href: "/cognitive-science/projects/tidy-tuesday",
        description: "A display page for visualizations from the Tidy Tuesday data project.",
      },
    ],
  },
];

export default function CognitiveScienceProjectsPage() {
  return (
    <ScienceShell title="projects">
      {projects.map((group) => (
        <section key={group.section}>
          <p className="m-0 font-medium">{group.section}</p>
          <ul>
            {group.items.map((project) => (
              <li key={project.href}>
                <Link href={project.href}>
                  <strong>{project.title}</strong>
                </Link>
                <br />
                <span className="text-stone-600 dark:text-stone-400">{project.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ScienceShell>
  );
}
