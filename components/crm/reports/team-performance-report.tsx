"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, BadgeDollarSign, CheckCheck, Users } from "lucide-react";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { REPORT_CHART_COLORS, ReportChartTooltip, ReportMetricCard } from "./report-visuals";
import type { TeamPerformanceReportData } from "@/lib/crm/report-queries";
import { formatCurrency } from "@/lib/crm/utils";

export function TeamPerformanceReport({ data }: { data: TeamPerformanceReportData }) {
  const topValueUser = [...data.teamStats].sort((a, b) => b.pipelineValueManaged - a.pipelineValueManaged)[0];
  const topMeetingUser = [...data.teamStats].sort((a, b) => b.meetingsCreated - a.meetingsCreated)[0];
  const topFollowupRateUser = [...data.teamStats].sort((a, b) => (b.followupsCompleted / (b.followupsCreated || 1)) - (a.followupsCompleted / (a.followupsCreated || 1)))[0];

  const columns = [
    { 
      header: "User", 
      accessorKey: "userName",
      cell: (item: any) => (
        <div>
          <p className="font-medium">{item.userName}</p>
          <p className="text-xs text-muted-foreground">{item.userEmail}</p>
        </div>
      )
    },
    { header: "Companies", accessorKey: "assignedCompanies" },
    { header: "Meetings", accessorKey: "meetingsCreated" },
    { header: "Follow-ups Comp.", accessorKey: "followupsCompleted" },
    { 
      header: "Overdue", 
      accessorKey: "overdueFollowups",
      cell: (item: any) => (
        <span className={item.overdueFollowups > 0 ? "text-rose-600 font-bold" : ""}>
          {item.overdueFollowups}
        </span>
      )
    },
    { header: "Documents", accessorKey: "documentsUploaded" },
    { header: "Help Requests", accessorKey: "helpRequestsCreated" },
    { header: "Help Resolved", accessorKey: "helpRequestsResolved" },
    { header: "Hot Leads", accessorKey: "hotLeadsManaged" },
    { 
      header: "Pipeline Value", 
      accessorKey: "pipelineValueManaged",
      cell: (item: any) => formatCurrency(item.pipelineValueManaged)
    },
  ];
  const getGradientId = (prefix: string, index: number) => `${prefix}-gradient-${index}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard title="Total Team Members" value={String(data.teamStats.length)} detail="Active users included in this report" tone="slate" icon={Users} badge="team" />
        <ReportMetricCard
          title="Top Performer (Value)"
          value={topValueUser?.userName || "N/A"}
          detail="Highest owned pipeline value"
          tone="teal"
          icon={BadgeDollarSign}
          badge="bdt"
        />
        <ReportMetricCard
          title="Top Performer (Meetings)"
          value={topMeetingUser?.userName || "N/A"}
          detail="Most meetings logged"
          tone="sky"
          icon={Activity}
          badge="activity"
        />
        <ReportMetricCard
          title="Highest Follow-up Rate"
          value={topFollowupRateUser?.userName || "N/A"}
          detail="Best completion ratio"
          tone="amber"
          icon={CheckCheck}
          badge="discipline"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Pipeline Value by Team Member" description="Compare who currently owns the largest share of active pipeline value." badge="Value ownership" isEmpty={data.teamStats.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.teamStats}>
              <defs>
                {data.teamStats.map((_, index) => {
                  const colorStart = REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length];
                  const colorEnd = REPORT_CHART_COLORS[(index + 3) % REPORT_CHART_COLORS.length];
                  return (
                    <linearGradient key={getGradientId("team-value", index)} id={getGradientId("team-value", index)} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorStart} stopOpacity={1} />
                      <stop offset="100%" stopColor={colorEnd} stopOpacity={0.84} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="userName" fontSize={10} interval={0} tick={{ width: 60, fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} tickFormatter={(val) => `৳${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`} />
              <Tooltip content={<ReportChartTooltip />} formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="pipelineValueManaged" radius={[10, 10, 0, 0]} barSize={34}>
                {data.teamStats.map((_, index) => (
                  <Cell key={`team-value-cell-${index}`} fill={`url(#${getGradientId("team-value", index)})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Team Activity Mix" description="See how meetings, completed follow-ups, and uploads are distributed by user." badge="Productivity" isEmpty={data.teamStats.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.teamStats}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="userName" fontSize={10} interval={0} tick={{ width: 60, fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="meetingsCreated" stackId="activity" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="followupsCompleted" stackId="activity" fill="#14b8a6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="documentsUploaded" stackId="activity" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>
      </div>

      <ReportDataTable 
        title="Team Performance Matrix" 
        columns={columns} 
        data={data.teamStats} 
        exportFileName="team-performance"
      />
    </div>
  );
}
