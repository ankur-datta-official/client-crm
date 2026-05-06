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
import { Activity, CalendarCheck2, Flame, ListTodo } from "lucide-react";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { ReportChartLegend, ReportChartTooltip, REPORT_CHART_COLORS, ReportMetricCard } from "./report-visuals";
import type { MeetingReportData } from "@/lib/crm/report-queries";
import { InteractionTypeBadge } from "@/components/crm/interaction-type-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import Link from "next/link";

export function MeetingReport({ data }: { data: MeetingReportData }) {
  const topMeetingType = [...data.meetingsByType].sort((a, b) => b.count - a.count)[0];
  const topSalesperson = [...data.meetingsBySalesperson].sort((a, b) => b.count - a.count)[0];

  const columns = [
    { 
      header: "Date", 
      accessorKey: "meeting_datetime",
      cell: (item: any) => new Date(item.meeting_datetime).toLocaleDateString()
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
    { header: "Contact", accessorKey: "contact_persons.name" },
    { 
      header: "Type", 
      accessorKey: "interaction_type",
      cell: (item: any) => <InteractionTypeBadge type={item.interaction_type} />
    },
    { header: "Salesperson", accessorKey: "profiles.full_name" },
    { 
      header: "Rating", 
      accessorKey: "success_rating",
      cell: (item: any) => <RatingBadge rating={item.success_rating} />
    },
    { 
      header: "Temperature", 
      accessorKey: "lead_temperature",
      cell: (item: any) => <LeadTemperatureBadge temperature={item.lead_temperature} />
    },
    { header: "Next Action", accessorKey: "next_action" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard title="Total Meetings" value={String(data.totalMeetings)} detail="Meetings logged in the selected range" tone="slate" icon={Activity} badge="volume" />
        <ReportMetricCard title="Average Success Rating" value={data.avgSuccessRating.toFixed(1)} detail="Average sales confidence after meetings" tone="amber" icon={CalendarCheck2} badge="score" />
        <ReportMetricCard title="Hot Meetings" value={String(data.hotMeetings.length)} detail="Meetings marked with hot temperature" tone="rose" icon={Flame} badge="heat" />
        <ReportMetricCard title="Action Ready" value={String(data.meetingsWithNextAction.length)} detail="Discussions already tied to a next step" tone="sky" icon={ListTodo} badge="next" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Meetings by Type" description="Break down meeting volume by interaction type." badge="Mix" headerRight={<MiniStat label="Top type" value={topMeetingType?.type || "N/A"} />} isEmpty={data.meetingsByType.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.meetingsByType}
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
                {data.meetingsByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ReportChartTooltip />} />
              <Legend content={<ReportChartLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Meetings by Salesperson" description="Compare meeting activity across the active team." badge="Team activity" headerRight={<MiniStat label="Top owner" value={topSalesperson?.user || "N/A"} />} isEmpty={data.meetingsBySalesperson.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.meetingsBySalesperson}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="user" fontSize={10} interval={0} tick={{ width: 60, fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" fill="#0f766e" radius={[10, 10, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>
      </div>

      <ReportDataTable 
        title="Meetings Without Follow-up" 
        columns={columns} 
        data={data.meetingsWithoutFollowup} 
        exportFileName="meetings-without-followup"
      />

      <ReportDataTable 
        title="Recent Meetings" 
        columns={columns} 
        data={data.hotMeetings} // Using hotMeetings as a proxy for interesting ones, or could pass all
        exportFileName="recent-meetings"
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
