"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { ReportChartEmptyState } from "./report-visuals";

interface ReportChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  height?: string | number;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  badge?: string;
  headerRight?: ReactNode;
}

export function ReportChartCard({
  title,
  description,
  children,
  className,
  height = 300,
  isEmpty = false,
  emptyTitle,
  emptyDescription,
  badge,
  headerRight,
}: ReportChartCardProps) {
  return (
    <Card className={cn("overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-soft dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)]", className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold text-slate-950 dark:text-slate-100">{title}</CardTitle>
              {badge ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {badge}
                </span>
              ) : null}
            </div>
            {description && <CardDescription className="max-w-[62ch] leading-6">{description}</CardDescription>}
          </div>
          {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height }} className="w-full rounded-[22px] border border-slate-100 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-950/70">
          {isEmpty ? (
            <ReportChartEmptyState title={emptyTitle} description={emptyDescription} />
          ) : (
            children
          )}
        </div>
      </CardContent>
    </Card>
  );
}
