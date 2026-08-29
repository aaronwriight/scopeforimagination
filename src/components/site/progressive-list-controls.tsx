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
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="text-[0.65rem] lowercase tracking-widest text-stone-400">{label}</legend>
      <div className="mt-1 inline-flex border border-stone-300 dark:border-stone-700">
        {LIST_BATCH_SIZES.map((size, index) => (
          <button
            key={size}
            type="button"
            aria-pressed={value === size}
            onClick={() => onChange(size)}
            className={`min-w-10 px-3 py-2 font-serif text-sm transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[#859900] ${
              index > 0 ? "border-l border-stone-300 dark:border-stone-700" : ""
            } ${
              value === size
                ? "bg-stone-100 text-[#6f8200] dark:bg-stone-800"
                : "bg-white text-stone-900 hover:text-[#6f8200] dark:bg-stone-950 dark:text-stone-100 dark:hover:text-[#6f8200]"
            }`}
          >
            {size}
          </button>
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
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
      <span className="text-stone-450" aria-live="polite">
        showing {visibleCount} of {totalCount}
      </span>
      <button
        type="button"
        aria-controls={regionId}
        aria-label={
          remainingCount > 0 && contextLabel
            ? `Show ${nextCount} more from ${contextLabel}`
            : undefined
        }
        disabled={remainingCount === 0}
        onClick={onShowMore}
        className="lowercase tracking-wider text-[#6f8200] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#859900] disabled:cursor-default disabled:text-stone-400 disabled:no-underline"
      >
        {remainingCount > 0
          ? `show ${nextCount} more ${nextCount === 1 ? singularLabel : pluralLabel}`
          : `all ${totalCount} shown`}
      </button>
    </div>
  );
}
