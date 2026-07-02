import Link from "next/link";

const contentMaxWidth = "64rem";

const siteLinks = [
  ["cognitive science", "/cognitive-science"],
  ["photography", "/frame-it-wright-photography"],
  ["journal", "/scope-for-imagination"],
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
  wiki: [
    ["home", "/"],
  ],
};

export function SitePageShell({
  title,
  children,
}: {
  title: string;
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
          <h1 className="m-0 text-base font-medium lowercase tracking-widest">{title}</h1>
          <div className="mt-3 space-y-5">{children}</div>
        </article>
      </div>
    </main>
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
  showTitle = true,
  children,
}: {
  section: string;
  links: string[][];
  title: string;
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
          {showTitle && <h1 className="m-0 text-base font-medium lowercase tracking-widest">{title}</h1>}
          <div className={showTitle ? "mt-3 space-y-5" : "space-y-5"}>{children}</div>
        </article>
      </div>
    </main>
  );
}

export function PhotographyShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="photography" links={sectionLinks.photography} title={title}>
      {children}
    </SectionPageShell>
  );
}

export function JournalShell({
  title,
  showTitle = true,
  years = [],
  children,
}: {
  title: string;
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
    <SectionPageShell section="journal" links={journalLinks} title={title} showTitle={showTitle}>
      {children}
    </SectionPageShell>
  );
}

export function LiteratureShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="literature" links={sectionLinks.literature} title={title}>
      {children}
    </SectionPageShell>
  );
}

export function PersonalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="personal" links={sectionLinks.personal} title={title}>
      {children}
    </SectionPageShell>
  );
}

export function ContactShell({
  title,
  showTitle,
  children,
}: {
  title: string;
  showTitle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="contact" links={sectionLinks.contact} title={title} showTitle={showTitle}>
      {children}
    </SectionPageShell>
  );
}

export function WikiShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <SectionPageShell section="wiki" links={sectionLinks.wiki} title={title}>
      {children}
    </SectionPageShell>
  );
}

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <SitePageShell title={title}>
      <p className="text-stone-500">coming soon</p>
    </SitePageShell>
  );
}
