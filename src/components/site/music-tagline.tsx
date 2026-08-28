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
    <p
      className={`flex flex-wrap items-baseline gap-x-1 text-xs leading-6 text-stone-450 ${className}`}
    >
      <span aria-hidden="true" className="text-[0.7rem]">
        ♪
      </span>
      <span aria-hidden="true" className="text-[0.7rem]">
        •
      </span>
      {music.url ? (
        <a
          href={music.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-inherit transition-colors hover:text-[#6f8200]"
          aria-label={`${music.title} by ${music.artist} (opens in a new tab)`}
        >
          {credit}
        </a>
      ) : (
        <span>{credit}</span>
      )}
    </p>
  );
}
