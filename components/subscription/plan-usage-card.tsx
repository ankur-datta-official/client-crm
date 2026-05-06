import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UsageProgressBar } from "./usage-progress-bar";

type PlanUsageCardProps = {
  title: string;
  description: string;
  used: number;
  limit: number | null;
  unit?: string;
  tone?: "emerald" | "sky" | "amber";
};

const toneClasses = {
  emerald: {
    card: "border-teal-100/80 bg-white dark:border-teal-500/20 dark:bg-slate-900/85",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
  },
  sky: {
    card: "border-sky-100/80 bg-white dark:border-sky-500/20 dark:bg-slate-900/85",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  },
  amber: {
    card: "border-amber-100/80 bg-white dark:border-amber-500/20 dark:bg-slate-900/85",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  },
} as const;

export function PlanUsageCard({ title, description, used, limit, unit = "", tone = "emerald" }: PlanUsageCardProps) {
  const suffix = unit ? ` ${unit}` : "";
  const currentTone = toneClasses[tone];

  return (
    <Card className={currentTone.card}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base text-slate-900 dark:text-slate-100">{title}</CardTitle>
            <CardDescription className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</CardDescription>
          </div>
          <div className={`inline-flex max-w-full self-start rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-[11px] ${currentTone.badge}`}>
            {limit === null ? "Unlimited" : "Tracked"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 text-2xl font-semibold text-slate-950 dark:text-slate-100">
            {used.toLocaleString()}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{suffix}</span>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {limit === null ? `Unlimited${suffix}` : `${limit.toLocaleString()}${suffix}`}
          </div>
        </div>
        <UsageProgressBar value={used} max={limit} tone={tone} />
      </CardContent>
    </Card>
  );
}
