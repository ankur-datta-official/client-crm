"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportChartCard } from "@/components/crm/reports/report-chart-card";
import { ReportChartLegend, ReportChartTooltip } from "@/components/crm/reports/report-visuals";
import { motion } from "framer-motion";

export type DashboardLeadTrendPoint = {
  date: string;
  label: string;
  target: number;
  achievement: number;
};

export type DashboardStageChartPoint = {
  name: string;
  value: number;
  color: string;
};

type DashboardVisualsProps = {
  leadTrend: DashboardLeadTrendPoint[];
  stageDistribution: DashboardStageChartPoint[];
};

const CHART_ANIMATION_DURATION = 1.5;

export function DashboardLeadTargetChart({ leadTrend }: { leadTrend: DashboardLeadTrendPoint[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <ReportChartCard
        title="Productivity Trend"
        description="Target vs achievement across your recent workdays."
        height={240}
        headerRight={
          <Button asChild variant="ghost" size="sm" className="rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200">
            <Link href="/reports">
              View report
              <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        }
        isEmpty={leadTrend.length === 0}
        emptyTitle="No lead activity yet"
        emptyDescription="Lead data will appear here."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={leadTrend} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: "currentColor", fontSize: 10, fontWeight: 500 }}
              className="text-slate-500 dark:text-slate-400"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={35}
              tick={{ fill: "currentColor", fontSize: 10, fontWeight: 500 }}
              className="text-slate-500 dark:text-slate-400"
            />
            <Tooltip content={<ReportChartTooltip />} />
            <Line
              type="monotone"
              dataKey="target"
              name="Target"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: "#94a3b8", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#94a3b8", stroke: "#fff", strokeWidth: 2 }}
              animationDuration={CHART_ANIMATION_DURATION * 1000}
            />
            <Line
              type="monotone"
              dataKey="achievement"
              name="Achievement"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
              animationDuration={CHART_ANIMATION_DURATION * 1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </ReportChartCard>
    </motion.div>
  );
}

const DONUT_COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
];

// Donut Legend
function DonutLegend({ data }: { data: DashboardStageChartPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col gap-2.5 py-1">
      {data.map((item, index) => {
        const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <motion.div 
            key={item.name} 
            className="flex items-center justify-between gap-4"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
              />
              <p className="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">{item.name}</p>
            </div>
            <p className="whitespace-nowrap text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {item.value} <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">({percentage}%)</span>
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

// Center label for donut chart
function DonutCenterLabel({ total }: { total: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
      <motion.span 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
      >
        {total}
      </motion.span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">deals</span>
    </div>
  );
}

export function DashboardDealsStageChart({ stageDistribution }: { stageDistribution: DashboardStageChartPoint[] }) {
  const totalDeals = stageDistribution.reduce((sum, item) => sum + item.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <ReportChartCard
        title="Deals by Stage"
        description="Current pipeline distribution."
        height={240}
        headerRight={
          <Button asChild variant="ghost" size="sm" className="rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200">
            <Link href="/pipeline">
              View all
              <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        }
        isEmpty={stageDistribution.length === 0}
        emptyTitle="No deals yet"
        emptyDescription="Active deals will appear here."
      >
        <div className="grid grid-cols-[1.2fr_1fr] items-center gap-2 h-[180px]">
          <div className="relative h-full w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie
                  data={stageDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="90%"
                  paddingAngle={4}
                  stroke="none"
                  animationDuration={CHART_ANIMATION_DURATION * 1000}
                >
                  {stageDistribution.map((entry, index) => (
                    <Cell 
                      key={entry.name} 
                      fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                      className="hover:opacity-80 transition-opacity outline-none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 40 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0]?.payload as DashboardStageChartPoint;
                    const index = stageDistribution.findIndex(s => s.name === data.name);
                    const percentage = totalDeals > 0 ? Math.round((data.value / totalDeals) * 100) : 0;
                    return (
                      <div className="relative z-50 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-950 dark:ring-white/5">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                          />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{data.name}</span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {data.value} deals ({percentage}%)
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <DonutCenterLabel total={totalDeals} />
          </div>

          <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
            <DonutLegend data={stageDistribution} />
          </div>
        </div>
      </ReportChartCard>
    </motion.div>
  );
}
