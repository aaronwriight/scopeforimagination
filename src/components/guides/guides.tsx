// ./components/Posts.tsx

import { SanityGuide } from "@/sanity/types/guides";
import { GuideThumbnail } from "./thumbnail";
import { SiteMenu } from "@/components/site/site-content";

function sortableGuideDate(guide: SanityGuide): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(guide.date_of_guide ?? "") ? guide.date_of_guide : "";
}

export default function Guides({ guides }: { guides: SanityGuide[] }) {
  const sortedGuides = [...guides].sort((first, second) => {
    const chronology = sortableGuideDate(second).localeCompare(sortableGuideDate(first));
    return chronology !== 0 ? chronology : second._id.localeCompare(first._id);
  });
  const dates = sortedGuides.map((item) => sortableGuideDate(item).slice(0, 4) || "undated");
  const uniqeYears = [...new Set(dates)];
  const groupedGuidesByYear: Array<{ year: string; items: SanityGuide[] }> =
    uniqeYears.map((el) => {
      return {
        year: el,
        items: sortedGuides.filter((item) => (sortableGuideDate(item).slice(0, 4) || "undated") === el),
      };
    });

  return (
    <main className="container relative mx-auto flex-1 px-6 py-11">
      <div className="grid items-start gap-y-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-16">
        <SiteMenu />
        <section className="w-full self-start space-y-8 text-left">
          {groupedGuidesByYear.map((year) => {
        return (
          <div
            key={`year-${year.year}`}
            className="flex flex-col gap-4 sm:flex-row sm:gap-8"
          >
            <h2 className="font-mono text-sm text-stone-500">
              {year.year}
            </h2>

            <div className="grid-cols grid flex-1 snap-center gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
              {year.items.map((guide) => {
                return (
                  <GuideThumbnail
                    key={guide._id}
                    title={guide.title}
                    slug={guide.slug}
                    hero_image={guide.hero_image}
                    lqip={guide.lqip}
                    bg={guide.palette?.vibrant?.background || "inherit"}
                    bgDark={guide.palette?.darkVibrant?.background || "inherit"}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
        </section>
      </div>
      <p className="absolute -bottom-16 right-6 max-w-3xl italic font-serif leading-relaxed text-sm text-right">
        Well, that is one of the things to find out sometime.
        <br />
        Isn&apos;t it splendid to think of all the things there are to find out about?
        <br />
        It just makes me feel glad to be alive - it&apos;s such an interesting world.
        <br />
        It wouldn&apos;t be half so interesting if we know all about everything, would it?
        <br />
        There&apos;d be no <b>scope for imagination</b> then, would there?
        <br />
        <br />
        <span className="block text-right font-serif text-xs italic leading-relaxed text-stone-450">
          - Anne of Green Gables, L. M. Montgomery
        </span>
      </p>
    </main>
  );
}
