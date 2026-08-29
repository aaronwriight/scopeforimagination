"use client";

export const LIST_BATCH_SIZES = [5, 10, 25] as const;

export type ListBatchSize = (typeof LIST_BATCH_SIZES)[number];

export function ListBatchSizeControl({
  value,
  onChange,
  label,
}: {
  value: ListBatchSize;
  onChange: (value: ListBatchSize) => void;
  label: string;
}) {
  return (
    <fieldset className="m-0 inline-flex min-w-0 items-baseline gap-2 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="text-[0.65rem] lowercase tracking-widest text-stone-400">
        show
      </span>
      <div className="inline-flex items-baseline gap-2">
        {LIST_BATCH_SIZES.map((size, index) => (
          <span key={size} className="inline-flex items-baseline gap-2">
            {index > 0 ? <span className="text-stone-300 dark:text-stone-700">·</span> : null}
            <button
              type="button"
              aria-label={`${label}: ${size}`}
              aria-pressed={value === size}
              onClick={() => onChange(size)}
              className={`cursor-pointer border-b pb-0.5 font-serif text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#859900] ${
                value === size
                  ? "border-[#859900] text-[#6f8200]"
                  : "border-transparent text-stone-400 hover:text-[#6f8200]"
              }`}
            >
              {size}
            </button>
          </span>
        ))}
      </div>
    </fieldset>
  );
}

export function ProgressiveRevealControl({
  visibleCount,
  totalCount,
  batchSize,
  regionId,
  singularLabel,
  pluralLabel,
  contextLabel,
  onShowMore,
}: {
  visibleCount: number;
  totalCount: number;
  batchSize: ListBatchSize;
  regionId: string;
  singularLabel: string;
  pluralLabel: string;
  contextLabel?: string;
  onShowMore: () => void;
}) {
  const remainingCount = Math.max(totalCount - visibleCount, 0);
  const nextCount = Math.min(batchSize, remainingCount);

  return (
    <div className="mt-8 flex flex-col items-center gap-2 text-xs">
      {remainingCount > 0 ? (
        <button
          type="button"
          aria-controls={regionId}
          aria-label={
            contextLabel
              ? `Show ${nextCount} more from ${contextLabel}`
              : `Show ${nextCount} more ${nextCount === 1 ? singularLabel : pluralLabel}`
          }
          onClick={onShowMore}
          className="cursor-pointer border-b border-transparent pb-0.5 lowercase tracking-widest text-[#6f8200] transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#859900]"
        >
          show more
        </button>
      ) : null}
      <span className="text-[0.65rem] lowercase tracking-wide text-stone-400" aria-live="polite">
        showing {visibleCount} of {totalCount}
      </span>
    </div>
  );
}
