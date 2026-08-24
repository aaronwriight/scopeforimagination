export function CompletionStatus({
  complete,
  completeLabel,
  incompleteLabel,
}: {
  complete: boolean;
  completeLabel: string;
  incompleteLabel: string;
}) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold leading-none text-white ${
        complete ? "bg-[#859900]" : "bg-stone-300/80 dark:bg-stone-600/80"
      }`}
      title={complete ? completeLabel : incompleteLabel}
    >
      <span aria-hidden="true">✓</span>
      <span className="sr-only">{complete ? completeLabel : incompleteLabel}</span>
    </span>
  );
}
