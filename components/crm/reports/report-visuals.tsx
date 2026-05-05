"use client";

import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { ArrowUpRight, BarChart3, Inbox, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const REPORT_CHART_COLORS = [
  "#0f766e",
  "#0284c7",
  "#f59e0b",
  "#e11d48",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#ec4899",
  "#2563eb",
  "#84cc16",
  "#ef4444",
  "#06b6d4",
];

type ReportSectionIntroProps = {
  text: string;
  dismissible?: boolean;
  storageKey?: string;
};

export function ReportSectionIntro({ text, dismissible = false, storageKey }: ReportSectionIntroProps) {
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const dismissedFromStorage = useSyncExternalStore(
    () => () => undefined,
    () => {
      if (!dismissible || !storageKey || typeof window === "undefined") {
        return false;
      }

      return window.localStorage.getItem(storageKey) === "dismissed";
    },
    () => false,
  );

  function handleDismiss() {
    setDismissedLocally(true);

    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "dismissed");
    }
  }

  if (dismissedLocally || dismissedFromStorage) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.09),_transparent_35%),linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] px-5 py-4 text-sm leading-6 text-slate-600 shadow-soft dark:border-slate-800/80 dark:bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_35%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)] dark:text-slate-300">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 size-2.5 rounded-full bg-teal-500 shadow-[0_0_0_5px_rgba(20,184,166,0.14)]" />
        <p className="min-w-0 flex-1">{text}</p>
        {dismissible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 dark:hover:bg-slate-950 dark:hover:text-slate-200"
            onClick={handleDismiss}
            aria-label="Dismiss report tip"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type ReportMetricCardProps = {
  title: string;
  value: string;
  detail?: string;
  tone?: "teal" | "sky" | "amber" | "rose" | "slate";
  align?: "left" | "center";
  compact?: boolean;
  icon?: LucideIcon;
  badge?: string;
  footer?: ReactNode;
};

const toneClasses = {
  teal: {
    card: "border-teal-100 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)] dark:border-teal-500/20 dark:bg-[linear-gradient(180deg,#0f172a_0%,#042f2e_100%)]",
    icon: "bg-teal-500/12 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/20",
    glow: "from-teal-500/12 via-teal-500/0",
  },
  sky: {
    card: "border-sky-100 bg-[linear-gradient(180deg,#ffffff_0%,#f0f9ff_100%)] dark:border-sky-500/20 dark:bg-[linear-gradient(180deg,#0f172a_0%,#082f49_100%)]",
    icon: "bg-sky-500/12 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20",
    glow: "from-sky-500/12 via-sky-500/0",
  },
  amber: {
    card: "border-amber-100 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)] dark:border-amber-500/20 dark:bg-[linear-gradient(180deg,#0f172a_0%,#451a03_100%)]",
    icon: "bg-amber-500/12 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20",
    glow: "from-amber-500/12 via-amber-500/0",
  },
  rose: {
    card: "border-rose-100 bg-[linear-gradient(180deg,#ffffff_0%,#fff1f2_100%)] dark:border-rose-500/20 dark:bg-[linear-gradient(180deg,#0f172a_0%,#4c0519_100%)]",
    icon: "bg-rose-500/12 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20",
    glow: "from-rose-500/12 via-rose-500/0",
  },
  slate: {
    card: "border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)]",
    icon: "bg-slate-500/10 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    glow: "from-slate-500/10 via-slate-500/0",
  },
};

export function ReportMetricCard({
  title,
  value,
  detail,
  tone = "slate",
  align = "left",
  compact = false,
  icon: Icon = ArrowUpRight,
  badge,
  footer,
}: ReportMetricCardProps) {
  const toneConfig = toneClasses[tone];

  return (
    <Card className={cn("group relative overflow-hidden shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg", toneConfig.card)}>
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-br opacity-70", toneConfig.glow)} />
      <CardContent className={cn("relative p-4", compact && "p-3", align === "center" && "text-center")}>
        <div className={cn("flex items-start justify-between gap-3", align === "center" && "justify-center")}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">{title}</p>
              {badge ? (
                <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900/85 dark:text-slate-400 dark:ring-slate-700">
                  {badge}
                </span>
              ) : null}
            </div>
            <p className={cn("mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100", compact && "mt-2 text-2xl")}>{value}</p>
            {detail ? (
              <p className={cn("mt-2 max-w-[28ch] text-sm leading-5 text-slate-600 dark:text-slate-400", compact && "max-w-none text-xs leading-4")}>
                {detail}
              </p>
            ) : null}
          </div>
          {align === "left" ? (
            <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl backdrop-blur-sm", toneConfig.icon)}>
              <Icon className="size-4.5" />
            </div>
          ) : null}
        </div>
        {footer ? <div className="mt-4 border-t border-white/70 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

type ReportChartEmptyStateProps = {
  title?: string;
  description?: string;
  className?: string;
};

export function ReportChartEmptyState({
  title = "No report data yet",
  description = "Add companies, meetings, and follow-ups to generate analytics.",
  className,
}: ReportChartEmptyStateProps) {
  return (
    <div className={cn("flex h-full items-center justify-center", className)}>
      <div className="mx-auto max-w-sm rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-8 text-center dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:ring-slate-800">
          <Inbox className="size-5" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}

export function ReportChartTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
      {label !== undefined && label !== null ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{String(label)}</p>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((item, index) => (
          <div key={`${item.dataKey}-${index}`} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: item.color ?? "#0f766e" }}
              />
              <span>{String(item.name ?? item.dataKey ?? "Value")}</span>
            </div>
            <span className="font-medium text-slate-900 dark:text-slate-100">{String(item.value ?? "-")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type LegendPayloadItem = {
  color?: string;
  value?: string;
};

export function ReportChartLegend({ payload }: { payload?: LegendPayloadItem[] }) {
  if (!payload?.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-2">
      {payload.map((entry, index) => (
        <div key={`${entry.value}-${index}`} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color ?? "#0f766e" }} />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ReportLoadingFallback() {
  return (
    <div className="flex h-[360px] items-center justify-center rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] text-sm text-slate-500 shadow-soft dark:border-slate-800 dark:bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)] dark:text-slate-400">
      <div className="flex items-center gap-3">
        <BarChart3 className="size-4 text-primary" />
        <span>Loading report...</span>
      </div>
    </div>
  );
}
