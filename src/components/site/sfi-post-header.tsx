import Link from "next/link";
import { MusicTagline } from "@/components/site/music-tagline";
import type { SfiPost } from "@/lib/sfi-posts";
import { formatSfiHeaderDate, getSfiTagColor } from "@/lib/sfi-posts";

export function SfiPostHeader({
  post,
  href,
  large = false,
  className = "",
}: {
  post: SfiPost;
  href?: string;
  large?: boolean;
  className?: string;
}) {
  return (
    <header className={className}>
      {href ? (
        <Link href={href} className="group block">
          <h3 className="font-serif text-lg font-normal leading-snug text-stone-900 transition-colors group-hover:text-[#6f8200] group-focus-visible:text-[#6f8200] dark:text-stone-100 dark:group-hover:text-[#6f8200] dark:group-focus-visible:text-[#6f8200]">
            {post.title}
          </h3>
          <p className="mt-2 font-serif text-sm italic leading-6 text-stone-500 transition-colors group-hover:text-[#6f8200] group-focus-visible:text-[#6f8200]">
            {post.subtitle}
          </p>
        </Link>
      ) : (
        <>
          {large ? (
            <h1 className="font-serif text-2xl font-normal leading-tight text-stone-900 dark:text-stone-100 sm:text-3xl">{post.title}</h1>
          ) : (
            <h3 className="font-serif text-lg font-normal leading-snug text-stone-900 dark:text-stone-100">{post.title}</h3>
          )}
          <p className={`mt-2 font-serif italic leading-6 text-stone-500 ${large ? "text-base sm:text-lg" : "text-sm"}`}>
            {post.subtitle}
          </p>
        </>
      )}

      <div className="mt-2 space-y-2">
        <p className="text-xs leading-6 text-stone-450">
          <time dateTime={`${post.date}T${post.time}`}>
            {formatSfiHeaderDate(post.date)} • {post.time}
          </time>{" "}
          • {post.location} • {post.entry}
        </p>

        <MusicTagline music={post.music} />

        {post.tags.length > 0 && (
          <ul aria-label="post tags" className="flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] lowercase tracking-widest">
            {post.tags.map((tag) => (
              <li key={tag} style={{ color: getSfiTagColor(tag) }}>
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
