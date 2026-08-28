import type { MusicCredit } from "@/lib/music-credit";

export function MusicTagline({
  music,
  className = "",
}: {
  music?: MusicCredit | null;
  className?: string;
}) {
  if (!music) return null;

  const credit = (
    <>
      <span className="italic">{music.title}</span>, {music.artist}
    </>
  );

  return (
    <p className={`text-xs leading-6 text-stone-500 ${className}`}>
      <span aria-hidden="true" className="mr-1.5 text-[0.7rem] text-stone-400">
        ♪
      </span>
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
    </p>
  );
}
