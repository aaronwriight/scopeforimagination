import type { MusicCredit } from "@/lib/music-credit";

export function MusicTagline({
  music,
  className = "",
  inline = false,
}: {
  music?: MusicCredit | null;
  className?: string;
  inline?: boolean;
}) {
  if (!music) return null;

  const credit = (
    <>
      <span className="italic">{music.title}</span>, {music.artist}
    </>
  );

  const Tag = inline ? "span" : "p";

  return (
    <Tag className={`text-xs leading-6 text-stone-500 ${className}`}>
      {music.url ? (
        <a
          href={music.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-stone-500 transition-colors hover:text-[#6f8200]"
          aria-label={`${music.title} by ${music.artist} (opens in a new tab)`}
        >
          {credit}
        </a>
      ) : (
        credit
      )}
    </Tag>
  );
}
