import { cn } from "@/lib/utils";

type UsageProgressBarProps = {
  value: number;
  max: number | null;
  className?: string;
  tone?: "emerald" | "sky" | "amber";
};

const toneClasses = {
  emerald: "from-teal-500 to-emerald-500",
  sky: "from-sky-500 to-cyan-500",
  amber: "from-amber-500 to-orange-500",
} as const;

export function UsageProgressBar({ value, max, className, tone = "emerald" }: UsageProgressBarProps) {
  const percentage = max === null || max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const fillClassName =
    percentage >= 90
      ? "from-rose-500 to-pink-500"
      : percentage >= 75
        ? "from-amber-500 to-orange-500"
        : toneClasses[tone];

  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full bg-gradient-to-r transition-all", fillClassName)} style={{ width: `${percentage}%` }} />
    </div>
  );
}
