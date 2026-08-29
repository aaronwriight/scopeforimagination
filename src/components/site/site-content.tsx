import Link from "next/link";

const contentMaxWidth = "64rem";

const siteLinks = [
  ["cognitive science", "/cognitive-science"],
  ["photography", "/frame-it-wright-photography"],
  ["journal", "/scope-for-imagination"],
  ["venture", "/venture"],
  ["literature", "/literature"],
  ["personal", "/personal"],
  ["contact", "/contact"],
];

const sectionLinks = {
  photography: [
    ["about", "/frame-it-wright-photography"],
    ["portfolio", "/frame-it-wright-photography/portfolio"],
    ["gallery", "/frame-it-wright-photography/gallery"],
    ["booking", "/frame-it-wright-photography/booking"],
    ["mailing list", "/frame-it-wright-photography/mailing-list"],
    ["home", "/"],
  ],
  literature: [
    ["about", "/literature"],
    ["shared agency", "/literature/shared-agency"],
    ["sand dollar hunting", "/literature/sand-dollar-hunting"],
    ["home", "/"],
  ],
  personal: [
    ["about", "/personal"],
    ["home", "/"],
  ],
  contact: [
    ["home", "/"],
  ],
  venture: [
    ["atlas", "/venture"],
    ["about", "/venture/about"],
    ["index", "/venture/index"],
    ["northeast 115", "/venture/trails"],
    ["national parks", "/venture/parks"],
    ["travels", "/venture/travels"],
    ["home", "/"],
  ],
  wiki: [
    ["home", "/"],
  ],
};

export function SitePageShell({
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
        <SiteMenu />
        <article
          className="prose prose-stone w-full max-w-none self-start text-left text-sm dark:prose-invert prose-headings:font-serif prose-headings:lowercase prose-a:text-[#6f8200] prose-h2:text-sm prose-h2:font-medium prose-h2:tracking-normal prose-h2:normal-case"
          style={{ maxWidth: contentMaxWidth }}
        >
          <PageHeader title={title} subtitle={subtitle} />
          <div className="mt-8 space-y-5">{children}</div>
        </article>
      </div>
    </main>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <header className="not-prose border-b border-stone-300 pb-5 dark:border-stone-700">
      <h1 className="m-0 font-serif text-base font-medium lowercase tracking-widest text-stone-900 dark:text-stone-100">
        {title}
      </h1>
      {subtitle ? (
        <p className="m-0 mt-2 font-serif text-sm leading-6 text-stone-500 first-letter:lowercase">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

export function SiteMenu() {
  return (
    <aside className="space-y-5">
      <span className="block lowercase tracking-widest">
        home
      </span>
      <nav className="flex flex-col items-start gap-1 text-xs lowercase tracking-wider text-stone-500">
        {siteLinks.map(([label, href]) => (
          <Link key={href} href={href} className="whitespace-nowrap">
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function SectionMenu({
  title,
  links,
}: {
  title: string;
  links: string[][];
}) {
  return (
    <aside className="space-y-5">
      <span className="block lowercase tracking-widest">
        {title}
      </span>
      <nav className="flex flex-col items-start gap-1 text-xs lowercase tracking-wider text-stone-500">
        {links.map(([label, linkHref]) => (
          <Link key={linkHref} href={linkHref} className="whitespace-nowrap">
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function SectionPageShell({
  section,
  links,
  title,
  subtitle,
  showTitle = true,
  children,
}: {
  section: string;
  links: string[][];
  title: string;
  subtitle?: React.ReactNode;
  showTitle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="container mx-auto flex-1 px-6 py-11">
      <div className="grid items-start gap-y-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-16">
        <SectionMenu title={section} links={links} />
        <article
          className="prose prose-stone w-full max-w-none self-start text-left text-sm dark:prose-invert prose-headings:font-serif prose-headings:lowercase prose-a:text-[#6f8200] prose-h2:text-sm prose-h2:font-medium prose-h2:tracking-normal prose-h2:normal-case"
          style={{ maxWidth: contentMaxWidth }}
        >
          {showTitle && <PageHeader title={title} subtitle={subtitle} />}
          <div className={showTitle ? "mt-8 space-y-5" : "space-y-5"}>{children}</div>
        </article>
      </div>
    </main>
  );
}

export function PhotographyShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="photography" links={sectionLinks.photography} title={title} subtitle={subtitle}>
      {children}
    </SectionPageShell>
  );
}

export function JournalShell({
  title,
  subtitle,
  showTitle = true,
  years = [],
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  showTitle?: boolean;
  years?: number[];
  children: React.ReactNode;
}) {
  const journalLinks = [
    ["about", "/scope-for-imagination"],
    ["index", "/scope-for-imagination/index"],
    ...years.map((year) => [String(year), `/scope-for-imagination/${year}`]),
    ["home", "/"],
  ];

  return (
    <SectionPageShell section="journal" links={journalLinks} title={title} subtitle={subtitle} showTitle={showTitle}>
      {children}
    </SectionPageShell>
  );
}

export function VentureShell({
  title,
  subtitle,
  showTitle = true,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  showTitle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="venture" links={sectionLinks.venture} title={title} subtitle={subtitle} showTitle={showTitle}>
      {children}
    </SectionPageShell>
  );
}

export function LiteratureShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="literature" links={sectionLinks.literature} title={title} subtitle={subtitle}>
      {children}
    </SectionPageShell>
  );
}

export function PersonalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="personal" links={sectionLinks.personal} title={title} subtitle={subtitle}>
      {children}
    </SectionPageShell>
  );
}

export function ContactShell({
  title,
  subtitle,
  showTitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  showTitle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="contact" links={sectionLinks.contact} title={title} subtitle={subtitle} showTitle={showTitle}>
      {children}
    </SectionPageShell>
  );
}

export function WikiShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="wiki" links={sectionLinks.wiki} title={title} subtitle={subtitle}>
      {children}
    </SectionPageShell>
  );
}

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <SitePageShell title={title} subtitle="coming soon">
      {null}
    </SitePageShell>
  );
}
