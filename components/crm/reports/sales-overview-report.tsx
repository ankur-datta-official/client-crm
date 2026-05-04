"use client";

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
  Label
} from "recharts";
import { Activity, AlertTriangle, BriefcaseBusiness, Building2, CalendarClock, FileText, Flame, HandHelping, Trophy, Users } from "lucide-react";
import { ReportChartCard } from "./report-chart-card";
import { ReportChartLegend, ReportChartTooltip, REPORT_CHART_COLORS, ReportMetricCard } from "./report-visuals";
import type { SalesOverviewReport as SalesOverviewReportType } from "@/lib/crm/report-queries";
import { formatCurrency } from "@/lib/crm/utils";

const PIPELINE_STAGE_COLORS: Record<string, string> = {
  "new lead": "#3b82f6",
  contacted: "#06b6d4",
  "meeting scheduled": "#8b5cf6",
  negotiation: "#f59e0b",
  won: "#22c55e",
  "meeting done": "#14b8a6",
  unknown: "#f43f5e",
};

function getPipelineStageColor(stage: string, index: number) {
  const normalizedStage = stage.trim().toLowerCase();
  return PIPELINE_STAGE_COLORS[normalizedStage] || REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length];
}

export function SalesOverviewReport({ data }: { data: SalesOverviewReportType }) {
  const stats = [
    { title: "Total Companies", value: String(data.totalCompanies), detail: "Active leads and company records", tone: "slate" as const, icon: Building2, badge: "base" },
    { title: "New Leads", value: String(data.newLeadsInPeriod), detail: "Created during the selected period", tone: "sky" as const, icon: Users, badge: "flow" },
    { title: "Hot Leads", value: String(data.hotLeads), detail: "High-intent opportunities to prioritize", tone: "rose" as const, icon: Flame, badge: "focus" },
    { title: "Pipeline Value", value: formatCurrency(data.pipelineValue), detail: "Estimated value across open deals", tone: "teal" as const, icon: BriefcaseBusiness, badge: "bdt" },
    { title: "Won Deals", value: String(data.wonDeals), detail: "Deals already converted", tone: "teal" as const, icon: Trophy, badge: "result" },
    { title: "Lost Deals", value: String(data.lostDeals), detail: "Closed opportunities that were lost", tone: "rose" as const, icon: AlertTriangle, badge: "risk" },
    { title: "Meetings", value: String(data.meetingsCompleted), detail: "Logged client conversations", tone: "amber" as const, icon: Activity, badge: "activity" },
    { title: "Follow-ups Due", value: String(data.followupsDue), detail: "Pending actions requiring attention", tone: "amber" as const, icon: CalendarClock, badge: "queue" },
    { title: "Overdue", value: String(data.overdueFollowups), detail: "Follow-ups now overdue", tone: "rose" as const, icon: AlertTriangle, badge: "urgent" },
    { title: "Documents", value: String(data.documentsSubmitted), detail: "Submitted files and proposals", tone: "sky" as const, icon: FileText, badge: "docs" },
    { title: "Open Help", value: String(data.openHelpRequests), detail: "Internal blockers still unresolved", tone: "amber" as const, icon: HandHelping, badge: "support" },
  ];

  const temperatureTotal = data.leadTemperatureDistribution.reduce((sum, item) => sum + item.count, 0);
  const totalStageCount = data.pipelineStageDistribution.reduce((sum, item) => sum + item.count, 0);
  const hottestShare = temperatureTotal > 0
    ? Math.round((((data.hotLeads + data.veryHotLeads) / temperatureTotal) * 100))
    : 0;
  const winRate = data.wonDeals + data.lostDeals > 0
    ? Math.round((data.wonDeals / (data.wonDeals + data.lostDeals)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <ReportMetricCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            detail={stat.detail}
            tone={stat.tone}
            icon={stat.icon}
            badge={stat.badge}
          />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard
          title="Lead Temperature Distribution"
          description="See how current opportunities are spread by sales temperature."
          badge={`${temperatureTotal} leads`}
          headerRight={<InsightPill label="Hot share" value={`${hottestShare}%`} tone="rose" />}
          isEmpty={data.leadTemperatureDistribution.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.leadTemperatureDistribution}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={92}
                paddingAngle={3}
                dataKey="count"
                nameKey="temperature"
                stroke="#ffffff"
                strokeWidth={4}
              >
                {data.leadTemperatureDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} dy="-0.3em" className="fill-slate-400 text-[11px] font-semibold uppercase tracking-[0.2em]">
                          Active
                        </tspan>
                        <tspan x={viewBox.cx} dy="1.6em" className="fill-slate-950 text-[24px] font-semibold">
                          {temperatureTotal}
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
              <Tooltip content={<ReportChartTooltip />} />
              <Legend content={<ReportChartLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard
          title="Pipeline Stage Distribution"
          description="Compare how many deals are currently sitting in each active stage."
          badge={`${totalStageCount} open deals`}
          headerRight={<InsightPill label="Win rate" value={`${winRate}%`} tone="teal" />}
          isEmpty={data.pipelineStageDistribution.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.pipelineStageDistribution} layout="vertical">
              <defs>
                {data.pipelineStageDistribution.map((entry, index) => {
                  const stageColor = getPipelineStageColor(entry.stage, index);
                  return (
                    <linearGradient key={`pipeline-stage-gradient-${index}`} id={`pipelineStageGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={stageColor} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={stageColor} stopOpacity={1} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" horizontal vertical={false} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="stage" 
                type="category"
                width={110}
                fontSize={12}
                tick={{ fill: "#475569", fontWeight: 500 }}
              />
              <Tooltip 
                cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                content={<ReportChartTooltip />}
              />
              <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={24} background={{ fill: "rgba(226, 232, 240, 0.45)" }}>
                {data.pipelineStageDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#pipelineStageGradient-${index})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard
          title="Monthly Lead Creation Trend"
          description="Track lead creation volume over time to spot growth or slowdowns."
          badge="Momentum"
          headerRight={<InsightPill label="Range" value="Monthly" tone="sky" />}
          isEmpty={data.monthlyLeadCreationTrend.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthlyLeadCreationTrend}>
              <defs>
                <linearGradient id="leadTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="month" 
                fontSize={12}
                tick={{ fill: "#64748b" }}
                tickFormatter={(val) => {
                  const [year, month] = val.split('-');
                  const date = new Date(parseInt(year), parseInt(month) - 1);
                  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                }}
              />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                fill="url(#leadTrendFill)"
                stroke="none"
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#0f766e"
                strokeWidth={3}
                dot={{ fill: "#0f766e", r: 4, stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#0f766e", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard
          title="Meeting Activity Trend"
          description="Monitor recent meeting activity to keep client conversations moving."
          badge="Activity"
          headerRight={<InsightPill label="Window" value="Daily" tone="amber" />}
          isEmpty={data.meetingActivityTrend.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.meetingActivityTrend}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="date" 
                fontSize={12}
                tick={{ fill: "#64748b" }}
                tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" fill="#f59e0b" radius={[10, 10, 0, 0]} barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>
      </div>
    </div>
  );
}

function InsightPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "teal" | "sky" | "amber" | "rose";
}) {
  const toneClasses = {
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };

  return (
    <div className={`rounded-2xl px-3 py-2 text-right ring-1 ${toneClasses[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
