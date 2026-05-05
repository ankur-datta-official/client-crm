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
  Legend,
  PieChart,
  Pie
} from "recharts";
import { Building2, Flame, PhoneOff, Radar, UserCheck } from "lucide-react";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { ReportChartLegend, ReportChartTooltip, REPORT_CHART_COLORS, ReportMetricCard } from "./report-visuals";
import type { LeadReportData } from "@/lib/crm/report-queries";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { formatCurrency } from "@/lib/crm/utils";
import Link from "next/link";

export function LeadReport({ data }: { data: LeadReportData }) {
  const totalLeadCount = data.leadsByIndustry.reduce((sum, item) => sum + item.count, 0);
  const topIndustry = [...data.leadsByIndustry].sort((a, b) => b.count - a.count)[0];
  const topSource = [...data.leadsBySource].sort((a, b) => b.count - a.count)[0];
  const topOwner = [...data.leadsByAssignedUser].sort((a, b) => b.count - a.count)[0];

  const columns = [
    { 
      header: "Company", 
      accessorKey: "name",
      cell: (item: any) => (
        <Link href={`/companies/${item.id}`} className="font-medium text-primary hover:underline">
          {item.name}
        </Link>
      )
    },
    { header: "Industry", accessorKey: "industries.name" },
    { header: "Category", accessorKey: "company_categories.name" },
    { header: "Assigned To", accessorKey: "assigned_profile.full_name" },
    { header: "Stage", accessorKey: "pipeline_stages.name" },
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
    { 
      header: "Value", 
      accessorKey: "estimated_value",
      cell: (item: any) => formatCurrency(item.estimated_value)
    },
    { 
      header: "Created", 
      accessorKey: "created_at",
      cell: (item: any) => new Date(item.created_at).toLocaleDateString()
    },
  ];

  const getBarGradientId = (prefix: string, index: number) => `${prefix}-gradient-${index}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard title="Tracked Leads" value={String(totalLeadCount)} detail="Filtered leads included in this analysis" tone="slate" icon={Building2} badge="scope" />
        <ReportMetricCard title="Top Industry" value={topIndustry?.industry || "N/A"} detail={topIndustry ? `${topIndustry.count} leads currently mapped here` : "No industry data yet"} tone="teal" icon={Radar} badge="leader" />
        <ReportMetricCard title="Top Source" value={topSource?.source || "N/A"} detail={topSource ? `${topSource.count} leads generated from this source` : "No source data yet"} tone="sky" icon={Flame} badge="channel" />
        <ReportMetricCard title="Needs Follow-up" value={String(data.leadsWithoutFollowup.length)} detail="Leads without a follow-up in the last 30 days" tone="rose" icon={PhoneOff} badge="gap" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Leads by Industry" description="Compare lead distribution across active industries." badge={`${data.leadsByIndustry.length} segments`} headerRight={<MiniStat label="Top" value={topIndustry?.industry || "N/A"} />} isEmpty={data.leadsByIndustry.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.leadsByIndustry} layout="vertical">
              <defs>
                {data.leadsByIndustry.map((_, index) => {
                  const color = REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length];
                  return (
                    <linearGradient key={getBarGradientId("industry", index)} id={getBarGradientId("industry", index)} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={color} stopOpacity={0.86} />
                      <stop offset="100%" stopColor={color} stopOpacity={1} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="industry" type="category" width={120} fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={24}>
                {data.leadsByIndustry.map((_, index) => (
                  <Cell key={`industry-cell-${index}`} fill={`url(#${getBarGradientId("industry", index)})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Leads by Category" description="See which lead categories currently carry the most volume." badge={`${data.leadsByCategory.length} categories`} headerRight={<MiniStat label="Owners" value={topOwner?.user || "N/A"} />} isEmpty={data.leadsByCategory.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.leadsByCategory}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={92}
                paddingAngle={5}
                dataKey="count"
                nameKey="category"
                stroke="#ffffff"
                strokeWidth={4}
              >
                {data.leadsByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ReportChartTooltip />} />
              <Legend content={<ReportChartLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </ReportChartCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReportChartCard title="Leads by Source" description="Understand which sources generate the most leads." height={250} badge="Acquisition" isEmpty={data.leadsBySource.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.leadsBySource}>
              <defs>
                {data.leadsBySource.map((_, index) => {
                  const color = REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length];
                  return (
                    <linearGradient key={getBarGradientId("source", index)} id={getBarGradientId("source", index)} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={1} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.84} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="source" fontSize={12} tick={{ fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={30}>
                {data.leadsBySource.map((_, index) => (
                  <Cell key={`source-cell-${index}`} fill={`url(#${getBarGradientId("source", index)})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Leads by Assigned User" description="Spot ownership load across your active team." height={250} badge="Ownership" isEmpty={data.leadsByAssignedUser.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.leadsByAssignedUser}>
              <defs>
                {data.leadsByAssignedUser.map((_, index) => {
                  const color = REPORT_CHART_COLORS[(index + 2) % REPORT_CHART_COLORS.length];
                  return (
                    <linearGradient key={getBarGradientId("owner", index)} id={getBarGradientId("owner", index)} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={1} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.84} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="user" fontSize={10} interval={0} tick={{ width: 60, fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={30}>
                {data.leadsByAssignedUser.map((_, index) => (
                  <Cell key={`owner-cell-${index}`} fill={`url(#${getBarGradientId("owner", index)})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Lead Action Gaps" description="Quickly spot where nurturing is missing." height={290} badge="Priority view">
          <div className="grid h-full gap-2 p-1.5">
            <ReportMetricCard title="Hot Leads" value={String(data.hotLeads.length)} detail="High-intent leads to prioritize first" tone="rose" icon={Flame} align="center" compact />
            <ReportMetricCard title="No Follow-up" value={String(data.leadsWithoutFollowup.length)} detail="Leads needing immediate next action" tone="amber" icon={PhoneOff} align="center" compact />
            <ReportMetricCard title="No Meeting" value={String(data.leadsWithoutMeeting.length)} detail="Leads that have not reached a conversation yet" tone="sky" icon={UserCheck} align="center" compact />
          </div>
        </ReportChartCard>
      </div>

      <ReportDataTable 
        title="Hot Leads" 
        columns={columns} 
        data={data.hotLeads} 
        exportFileName="hot-leads"
      />

      <ReportDataTable 
        title="Leads Without Follow-up (Last 30 Days)" 
        columns={columns} 
        data={data.leadsWithoutFollowup} 
        exportFileName="leads-without-followup"
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
