"use client";

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line
} from "recharts";
import { AlertTriangle, CalendarDays, CheckCheck, ListChecks } from "lucide-react";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { ReportChartLegend, ReportChartTooltip, REPORT_CHART_COLORS, ReportMetricCard } from "./report-visuals";
import type { FollowupReportData } from "@/lib/crm/report-queries";
import { FollowupStatusBadge, FollowupPriorityBadge } from "@/components/crm/followup-badges";
import Link from "next/link";

export function FollowupReport({ data }: { data: FollowupReportData }) {
  const topPriority = [...data.followupsByPriority].sort((a, b) => b.count - a.count)[0];
  const topOwner = [...data.followupsByUser].sort((a, b) => b.count - a.count)[0];

  const columns = [
    { 
      header: "Scheduled", 
      accessorKey: "scheduled_at",
      cell: (item: any) => new Date(item.scheduled_at).toLocaleString()
    },
    { 
      header: "Company", 
      accessorKey: "companies.name",
      cell: (item: any) => (
        <Link href={`/companies/${item.companies?.id}`} className="font-medium text-primary hover:underline">
          {item.companies?.name}
        </Link>
      )
    },
    { header: "Title", accessorKey: "title" },
    { header: "Type", accessorKey: "followup_type" },
    { 
      header: "Priority", 
      accessorKey: "priority",
      cell: (item: any) => <FollowupPriorityBadge priority={item.priority} />
    },
    { header: "Assigned To", accessorKey: "assigned_profile.full_name" },
    { 
      header: "Status", 
      accessorKey: "status",
      cell: (item: any) => <FollowupStatusBadge status={item.status} />
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard title="Today's Follow-ups" value={String(data.todaysFollowups.length)} detail="Items scheduled for today" tone="slate" icon={CalendarDays} badge="today" />
        <ReportMetricCard title="Completion Rate" value={`${data.completionRate.toFixed(1)}%`} detail="Completed vs. total follow-ups" tone="teal" icon={CheckCheck} badge="discipline" />
        <ReportMetricCard title="Overdue Follow-ups" value={String(data.overdueFollowups.length)} detail="Pending actions that missed their date" tone="rose" icon={AlertTriangle} badge="risk" />
        <ReportMetricCard title="Upcoming Follow-ups" value={String(data.upcomingFollowups.length)} detail="Future follow-ups already planned" tone="sky" icon={ListChecks} badge="queue" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Follow-up Status Distribution" description="See the current balance of pending, completed, and overdue work." badge="Status mix" headerRight={<MiniStat label="Top priority" value={topPriority?.priority || "N/A"} />} isEmpty={data.followupStatusDistribution.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.followupStatusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={92}
                paddingAngle={5}
                dataKey="count"
                nameKey="status"
                stroke="#ffffff"
                strokeWidth={4}
              >
                {data.followupStatusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ReportChartTooltip />} />
              <Legend content={<ReportChartLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Follow-up Completion Trend" description="Track how consistently follow-ups are being completed over time." badge="Trend" headerRight={<MiniStat label="Top owner" value={topOwner?.user || "N/A"} />} isEmpty={data.followupCompletionTrend.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.followupCompletionTrend}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="date" 
                fontSize={12}
                tick={{ fill: "#64748b" }}
                tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#0f766e" 
                strokeWidth={3}
                dot={{ fill: "#0f766e", r: 4, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ReportChartCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Follow-ups by Priority" description="Understand where team urgency is concentrated." height={250} badge="Priority" isEmpty={data.followupsByPriority.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.followupsByPriority}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="priority" fontSize={12} tick={{ fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={34}>
                {data.followupsByPriority.map((entry, index) => (
                  <Cell key={`priority-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Follow-ups by Assigned User" description="See who currently carries the most scheduled follow-up load." height={250} badge="Workload" isEmpty={data.followupsByUser.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.followupsByUser}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="user" fontSize={10} interval={0} tick={{ width: 60, fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" fill="#0284c7" radius={[10, 10, 0, 0]} barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>
      </div>

      <ReportDataTable 
        title="Overdue Follow-ups" 
        columns={columns} 
        data={data.overdueFollowups} 
        exportFileName="overdue-followups"
      />

      <ReportDataTable 
        title="Today&apos;s Pending Follow-ups" 
        columns={columns} 
        data={data.todaysFollowups} 
        exportFileName="todays-followups"
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right ring-1 ring-slate-200 dark:bg-slate-900/85 dark:ring-slate-700">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
