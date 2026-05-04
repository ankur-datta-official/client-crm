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
  Legend
} from "recharts";
import { AlertCircle, BadgeCheck, Siren, UserCog } from "lucide-react";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { ReportChartLegend, ReportChartTooltip, REPORT_CHART_COLORS, ReportMetricCard } from "./report-visuals";
import type { HelpRequestReportData } from "@/lib/crm/report-queries";
import { HelpRequestStatusBadge, HelpRequestPriorityBadge, HelpRequestTypeBadge } from "@/components/crm/help-request-badges";
import Link from "next/link";

export function HelpRequestReport({ data }: { data: HelpRequestReportData }) {
  const topType = [...data.helpRequestsByType].sort((a, b) => b.count - a.count)[0];
  const topAssignee = [...data.helpRequestsByAssignedUser].sort((a, b) => b.count - a.count)[0];

  const columns = [
    { 
      header: "Title", 
      accessorKey: "title",
      cell: (item: any) => (
        <Link href={`/need-help/${item.id}`} className="font-medium text-primary hover:underline">
          {item.title}
        </Link>
      )
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
    { 
      header: "Type", 
      accessorKey: "help_type",
      cell: (item: any) => <HelpRequestTypeBadge type={item.help_type} />
    },
    { 
      header: "Priority", 
      accessorKey: "priority",
      cell: (item: any) => <HelpRequestPriorityBadge priority={item.priority} />
    },
    { header: "Requested By", accessorKey: "requested_profile.full_name" },
    { header: "Assigned To", accessorKey: "assigned_profile.full_name" },
    { 
      header: "Status", 
      accessorKey: "status",
      cell: (item: any) => <HelpRequestStatusBadge status={item.status} />
    },
    { 
      header: "Date", 
      accessorKey: "created_at",
      cell: (item: any) => new Date(item.created_at).toLocaleDateString()
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard title="Open Requests" value={String(data.openHelpRequests)} detail="Requests still waiting for resolution" tone="amber" icon={AlertCircle} badge="queue" />
        <ReportMetricCard title="Urgent Requests" value={String(data.urgentHelpRequests)} detail="Highest-priority blockers right now" tone="rose" icon={Siren} badge="urgent" />
        <ReportMetricCard title="Resolved Requests" value={String(data.resolvedRequests)} detail="Requests closed successfully" tone="teal" icon={BadgeCheck} badge="done" />
        <ReportMetricCard title="Top Assignee" value={topAssignee?.user || "N/A"} detail={topAssignee ? `${topAssignee.count} requests currently routed here` : "No assignee data yet"} tone="sky" icon={UserCog} badge="owner" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Help Requests by Type" description="See which blocker types are appearing most often." badge="Type mix" headerRight={<MiniStat label="Top type" value={topType?.type || "N/A"} />} isEmpty={data.helpRequestsByType.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.helpRequestsByType}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={92}
                paddingAngle={5}
                dataKey="count"
                nameKey="type"
                stroke="#ffffff"
                strokeWidth={4}
              >
                {data.helpRequestsByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ReportChartTooltip />} />
              <Legend content={<ReportChartLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Help Requests by Priority" description="Review urgency mix across the current request queue." badge="Urgency" headerRight={<MiniStat label="Top owner" value={topAssignee?.user || "N/A"} />} isEmpty={data.helpRequestsByPriority.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.helpRequestsByPriority}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="priority" fontSize={12} tick={{ fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={34}>
                {data.helpRequestsByPriority.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={
                      entry.priority === "urgent" ? "#ef4444" : 
                      entry.priority === "high" ? "#f59e0b" : 
                      entry.priority === "medium" ? "#0ea5e9" : "#94a3b8"
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Help Requests by Assigned User" description="See who currently carries the most support load." height={260} badge="Ownership" isEmpty={data.helpRequestsByAssignedUser.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.helpRequestsByAssignedUser}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="user" fontSize={10} interval={0} tick={{ width: 60, fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" fill="#0f766e" radius={[10, 10, 0, 0]} barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Resolution Snapshot" description="Quick context for support pressure versus resolved work." height={260} badge="Summary">
          <div className="grid h-full gap-3 p-2">
            <ReportMetricCard title="Request Types" value={String(data.helpRequestsByType.length)} detail="Distinct blocker categories in this range" tone="slate" icon={AlertCircle} align="center" />
            <ReportMetricCard title="Active Owners" value={String(data.helpRequestsByAssignedUser.length)} detail="Team members carrying support assignments" tone="sky" icon={UserCog} align="center" />
          </div>
        </ReportChartCard>
      </div>

      <ReportDataTable 
        title="Recent Help Requests & Escalations" 
        columns={columns} 
        data={data.recentHelpRequests} 
        exportFileName="help-requests"
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right ring-1 ring-slate-200">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
