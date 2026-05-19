"use client";

import { Pie, PieChart, ResponsiveContainer, Cell } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/crm/utils";
import type {
  TeamDashboardHeatmapRow,
  TeamDashboardMemberRow,
  TeamDashboardPipelineStagePoint,
} from "@/lib/dashboard/team-dashboard";
import { cn } from "@/lib/utils";

export function TeamPipelineStageChart({ data }: { data: TeamDashboardPipelineStagePoint[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (data.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No active pipeline stages found in the selected scope.</p>;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 py-2">
      <div className="relative mx-auto h-[186px] w-[186px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[2rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100">{total}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Total Deals</span>
        </div>
      </div>

      <div className="flex w-full max-w-[260px] flex-col gap-2.5">
        {data.map((item) => {
          const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate text-slate-700 dark:text-slate-200">{item.name}</span>
              </div>
              <span className="shrink-0 text-slate-500 dark:text-slate-400">
                {item.count} ({percent}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankingList({ rows, emptyLabel }: { rows: TeamDashboardMemberRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.userId} className="flex items-center justify-between gap-3 rounded-xl px-1.5 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              index === 0 && "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
              index === 1 && "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
              index > 1 && "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
            )}>
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{row.name}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{formatCurrency(row.dealValueManaged)}</p>
            </div>
          </div>
          <span className={cn(
            "text-sm font-semibold",
            row.achievement >= 80 && "text-emerald-600 dark:text-emerald-300",
            row.achievement >= 50 && row.achievement < 80 && "text-amber-600 dark:text-amber-300",
            row.achievement < 50 && "text-rose-600 dark:text-rose-300",
          )}>
            {row.achievement}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function TeamMemberRankings({
  topPerformers,
  lowPerformers,
}: {
  topPerformers: TeamDashboardMemberRow[];
  lowPerformers: TeamDashboardMemberRow[];
}) {
  return (
    <Tabs defaultValue="top" className="w-full">
      <TabsList className="h-10 rounded-full bg-slate-100 p-1 dark:bg-slate-900">
        <TabsTrigger value="top" className="rounded-full px-4 text-[11px] font-semibold">Top Performer</TabsTrigger>
        <TabsTrigger value="low" className="rounded-full px-4 text-[11px] font-semibold">Low Performer</TabsTrigger>
      </TabsList>
      <TabsContent value="top" className="mt-4">
        <RankingList rows={topPerformers} emptyLabel="No target-backed members yet." />
      </TabsContent>
      <TabsContent value="low" className="mt-4">
        <RankingList rows={lowPerformers} emptyLabel="No low performers in the current scope." />
      </TabsContent>
    </Tabs>
  );
}

export function TeamActivityHeatmap({
  labels,
  rows,
}: {
  labels: string[];
  rows: TeamDashboardHeatmapRow[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No member activity found in the selected range.</p>;
  }

  return (
    <div className="flex h-full flex-col justify-center space-y-4 py-2">
      <div className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 sm:grid-cols-[120px_repeat(7,minmax(0,1fr))]">
        <span />
        {labels.map((label, index) => (
          <span key={`${label}-${index}`} className="text-center">{label}</span>
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.userId} className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] items-center gap-2 sm:grid-cols-[120px_repeat(7,minmax(0,1fr))]">
            <span className="truncate pr-2 text-sm text-slate-700 dark:text-slate-200">{row.name}</span>
            {row.cells.map((cell) => (
              <div
                key={cell.key}
                title={`${cell.label}: ${cell.count}`}
                className="h-8 rounded-xl border border-emerald-100/70 shadow-inner transition-transform hover:scale-[1.03] dark:border-emerald-900/40"
                style={{
                  backgroundColor: cell.count === 0 ? "rgba(226,232,240,0.55)" : `rgba(16,185,129,${0.12 + cell.intensity * 0.7})`,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>Low Activity</span>
        <div className="flex items-center gap-1">
          {[0.2, 0.35, 0.55, 0.8].map((opacity) => (
            <span key={opacity} className="size-3 rounded-sm" style={{ backgroundColor: `rgba(16,185,129,${opacity})` }} />
          ))}
        </div>
        <span>High Activity</span>
      </div>
    </div>
  );
}
