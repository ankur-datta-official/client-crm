import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WorkspaceHero({
  eyebrow,
  title,
  description,
  actions,
  highlights,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  highlights?: string[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
              {eyebrow}
            </p>
          ) : null}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{title}</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {highlights?.length ? (
        <div className="flex flex-wrap gap-2">
          {highlights.map((highlight) => (
            <Badge key={highlight} variant="secondary" className="rounded-full px-3 py-1.5">
              {highlight}
            </Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function WorkspaceKpiGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>{children}</section>;
}

export function WorkspaceKpiCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "slate",
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: "slate" | "teal" | "amber" | "rose" | "blue";
}) {
  const toneMap = {
    slate: "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-100",
    teal: "border-teal-200 bg-teal-50/70 text-slate-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-slate-100",
    amber: "border-amber-200 bg-amber-50/70 text-slate-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-slate-100",
    rose: "border-rose-200 bg-rose-50/70 text-slate-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-slate-100",
    blue: "border-sky-200 bg-sky-50/70 text-slate-900 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-slate-100",
  } as const;

  const iconToneMap = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
    blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  } as const;

  return (
    <Card className={cn("rounded-2xl shadow-sm", toneMap[tone])}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", iconToneMap[tone])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function RecordOverviewPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function RecordContextSidebar({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function CompactEmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm dark:bg-slate-950 dark:text-slate-500">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

export function DetailRowList({
  rows,
}: {
  rows: Array<{ label: string; value: string | null | undefined }>;
}) {
  return (
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{row.label}</p>
          <p className={cn("max-w-[68%] text-right text-sm", row.value ? "text-slate-900 dark:text-slate-100" : "text-slate-400")}>
            {row.value || "-"}
          </p>
        </div>
      ))}
    </div>
  );
}
