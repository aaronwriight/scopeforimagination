import Link from "next/link";

const scienceLinks = [
  ["overview", "/cognitive-science"],
  ["about", "/cognitive-science/about"],
  ["publications", "/cognitive-science/publications"],
  ["projects", "/cognitive-science/projects"],
  ["readings & resources", "/cognitive-science/readings-resources"],
  ["mentorship", "/cognitive-science/mentorship"],
  ["cv", "/files/cv/WrightAaron_cv_2026_current.pdf"],
  ["home", "/"],
];

export function ScienceShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
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
          <h1 className="m-0 text-base font-medium tracking-widest">{title}</h1>
          {intro && <p className="mt-2 text-stone-500">{intro}</p>}
          <div className="mt-3 space-y-5">{children}</div>
        </article>
      </div>
    </main>
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
        <em className="text-stone-500">|</em>{" "}
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
