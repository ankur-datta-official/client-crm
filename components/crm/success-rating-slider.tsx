"use client";

type SuccessRatingSliderProps = {
  value: unknown;
  onChange: (nextValue: number) => void;
  onClear: () => void;
  helperText?: string;
};

export function SuccessRatingSlider({
  value,
  onChange,
  onClear,
  helperText = "Drag to estimate how likely this lead is to close.",
}: SuccessRatingSliderProps) {
  const hasValue = value !== "" && value !== null && value !== undefined;
  const numericValue = hasValue ? Number(value) : 5;
  const clampedValue = Number.isFinite(numericValue) ? Math.min(10, Math.max(1, numericValue)) : 5;
  const progress = ((clampedValue - 1) / 9) * 100;

  return (
    <div className="space-y-3 rounded-2xl border border-input/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] p-3.5 shadow-sm dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {hasValue ? `${clampedValue}/10` : "Not rated yet"}
          </p>
          <p className="max-w-xs text-xs leading-5 text-muted-foreground">
            {helperText}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
        >
          Clear
        </button>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={clampedValue}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-transparent accent-primary"
          style={{
            background: `linear-gradient(90deg, rgba(20,184,166,0.95) 0%, rgba(34,197,94,0.9) ${progress}%, rgba(226,232,240,0.95) ${progress}%, rgba(226,232,240,0.95) 100%)`,
          }}
          aria-label="Success rating from 1 to 10"
        />
        <div className="grid grid-cols-10 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
          {Array.from({ length: 10 }, (_, index) => {
            const tickValue = index + 1;
            const isActive = tickValue === clampedValue && hasValue;

            return (
              <button
                key={tickValue}
                type="button"
                onClick={() => onChange(tickValue)}
                className={`rounded-full border px-1 py-1 transition ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-transparent bg-background/90 hover:border-primary/20 hover:bg-primary/10 hover:text-foreground"
                }`}
              >
                {tickValue}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
