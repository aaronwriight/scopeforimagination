"use client";

export type VentureView = "peaks" | "parks" | "travels";

const ventureViews: readonly Readonly<{
  id: VentureView;
  label: string;
  description: string;
}>[] = [
  { id: "peaks", label: "northeast 115", description: "peaks and ranges across the northeast" },
  { id: "parks", label: "national parks", description: "parks across the united states" },
  { id: "travels", label: "travels", description: "countries & journeys" },
];

export function VentureViewSelector({
  value,
  onChange,
  label,
  controlsId,
}: {
  value: VentureView;
  onChange: (view: VentureView) => void;
  label: string;
  controlsId: string;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      <div className="grid grid-cols-3 gap-4">
        {ventureViews.map((view) => {
          const active = view.id === value;

          return (
            <button
              key={view.id}
              type="button"
              aria-controls={controlsId}
              aria-pressed={active}
              onClick={() => onChange(view.id)}
              className={`cursor-pointer border-t-2 pt-3 text-left transition-[color,border-color,opacity] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#859900] ${
                active
                  ? "border-[#859900] text-[#6f8200] opacity-100"
                  : "border-stone-300 text-stone-500 opacity-80 hover:border-stone-400 hover:text-stone-900 hover:opacity-100 dark:border-stone-700 dark:text-stone-400 dark:hover:text-stone-100"
              }`}
            >
              <span className="block text-[0.68rem] lowercase tracking-widest">{view.label}</span>
              <span className="mt-2 hidden font-serif text-xs text-stone-500 sm:block">{view.description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
