import Link from "next/link";
import { PageHeader } from "@/components/site/site-content";

const scienceLinks = [
  ["overview", "/cognitive-science"],
  ["about", "/cognitive-science/about"],
  ["publications", "/cognitive-science/publications"],
  ["projects", "/cognitive-science/projects"],
  ["readings & resources", "/cognitive-science/readings-resources"],
  ["mentorship", "/cognitive-science/mentorship"],
  ["collaborators", "/cognitive-science/collaborators"],
  ["cv", "/files/cv/WrightAaron_cv_2026_current.pdf"],
  ["home", "/"],
];

export function ScienceShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="container mx-auto flex-1 px-6 py-11">
      <div className="grid items-start gap-y-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-16">
        <aside className="space-y-5">
          <span className="block lowercase tracking-widest">
            cognitive science
          </span>
          <nav className="flex flex-col items-start gap-1 text-xs lowercase tracking-wider text-stone-500">
            {scienceLinks.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                target={href.endsWith(".pdf") ? "_blank" : undefined}
                rel={href.endsWith(".pdf") ? "noopener noreferrer" : undefined}
                className="whitespace-nowrap"
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <article
          className="prose prose-stone w-full max-w-none self-start text-left text-sm dark:prose-invert prose-headings:font-serif prose-headings:lowercase prose-a:text-[#6f8200] prose-h2:text-sm prose-h2:font-medium prose-h2:tracking-normal prose-h2:normal-case"
          style={{ maxWidth: "56rem" }}
        >
          <PageHeader title={title} subtitle={subtitle} />
          <div className="mt-8 space-y-5">{children}</div>
        </article>
      </div>
    </main>
  );
}

export function ProjectShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ScienceShell title={title} subtitle={subtitle}>
      <p className="not-prose m-0">
        <Link href="/cognitive-science/projects" className="text-xs lowercase tracking-widest text-stone-500">
          ← projects
        </Link>
      </p>
      {children}
    </ScienceShell>
  );
}

export function TopicDetails({
  title,
  question,
  children,
}: {
  title: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <details>
      <summary className="group cursor-pointer list-none">
        <strong>
          <em>{title}</em>
        </strong>{" "}
        <em className="text-stone-400">|</em>{" "}
        <span className="text-[#6f8200] group-hover:underline">
          <em>{question}</em>
        </span>
      </summary>
      <div className="mt-3 pl-5">{children}</div>
    </details>
  );
}

export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </Link>
  );
}
