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
  FunnelChart,
  Funnel,
  LabelList,
  LineChart,
  Line
} from "recharts";
import { BadgeDollarSign, Gauge, GitBranchPlus, Target, Trophy } from "lucide-react";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { ReportChartTooltip, REPORT_CHART_COLORS, ReportMetricCard } from "./report-visuals";
import type { PipelineReportData } from "@/lib/crm/report-queries";
import { formatCurrency } from "@/lib/crm/utils";
import { RatingBadge } from "@/components/crm/rating-badge";
import Link from "next/link";

export function PipelineReport({ data }: { data: PipelineReportData }) {
  const activePipelineCount = data.companiesByStage.reduce((sum, item) => sum + item.count, 0);
  const totalPipelineValue = data.pipelineValueByStage.reduce((sum, item) => sum + item.value, 0);
  const topValueStage = [...data.pipelineValueByStage].sort((a, b) => b.value - a.value)[0];

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
    { header: "Stage", accessorKey: "pipeline_stages.name" },
    { 
      header: "Value", 
      accessorKey: "estimated_value",
      cell: (item: any) => formatCurrency(item.estimated_value)
    },
    { 
      header: "Rating", 
      accessorKey: "success_rating",
      cell: (item: any) => <RatingBadge rating={item.success_rating} />
    },
    { 
      header: "Created", 
      accessorKey: "created_at",
      cell: (item: any) => new Date(item.created_at).toLocaleDateString()
    },
  ];

  const getGradientId = (prefix: string, index: number) => `${prefix}-gradient-${index}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard title="Active Pipeline" value={String(activePipelineCount)} detail="Open deals still moving through the board" tone="slate" icon={GitBranchPlus} badge="count" />
        <ReportMetricCard title="Pipeline Value" value={formatCurrency(totalPipelineValue)} detail="Estimated value across all active stages" tone="teal" icon={BadgeDollarSign} badge="bdt" />
        <ReportMetricCard title="Top Value Stage" value={topValueStage?.stage || "N/A"} detail={topValueStage ? `${formatCurrency(topValueStage.value)} currently sits here` : "No stage value yet"} tone="sky" icon={Target} badge="focus" />
        <ReportMetricCard title="Stuck Leads" value={String(data.stuckLeads.length)} detail="Open deals with no activity in the last 30 days" tone="rose" icon={Gauge} badge="risk" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Pipeline Funnel (Count by Stage)" description="See how deal volume narrows as opportunities move forward." badge={`${data.companiesByStage.length} stages`} headerRight={<MiniStat label="Won/Lost" value={`${data.wonLostCount.won}/${data.wonLostCount.lost}`} />} isEmpty={data.companiesByStage.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <defs>
                {data.companiesByStage.map((_, index) => {
                  const colorStart = REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length];
                  const colorEnd = REPORT_CHART_COLORS[(index + 3) % REPORT_CHART_COLORS.length];
                  return (
                    <linearGradient key={getGradientId("pipeline-funnel", index)} id={getGradientId("pipeline-funnel", index)} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={colorStart} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={colorEnd} stopOpacity={1} />
                    </linearGradient>
                  );
                })}
              </defs>
              <Tooltip content={<ReportChartTooltip />} />
              <Funnel
                data={data.companiesByStage}
                dataKey="count"
                nameKey="stage"
              >
                {data.companiesByStage.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#${getGradientId("pipeline-funnel", index)})`} />
                ))}
                <LabelList position="right" fill="#64748b" dataKey="stage" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Pipeline Value by Stage" description="Review where estimated deal value is concentrated across the funnel." badge="Stage value" headerRight={<MiniStat label="Peak stage" value={topValueStage?.stage || "N/A"} />} isEmpty={data.pipelineValueByStage.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.pipelineValueByStage}>
              <defs>
                {data.pipelineValueByStage.map((_, index) => {
                  const colorStart = REPORT_CHART_COLORS[(index + 1) % REPORT_CHART_COLORS.length];
                  const colorEnd = REPORT_CHART_COLORS[(index + 4) % REPORT_CHART_COLORS.length];
                  return (
                    <linearGradient key={getGradientId("pipeline-stage-value", index)} id={getGradientId("pipeline-stage-value", index)} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorStart} stopOpacity={1} />
                      <stop offset="100%" stopColor={colorEnd} stopOpacity={0.84} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="stage"
                interval={0}
                minTickGap={0}
                tickMargin={8}
                fontSize={12}
                tick={{ fill: "#64748b" }}
                tickFormatter={(value) => {
                  const stage = String(value ?? "").trim();
                  if (!stage) return "Meeting";
                  return stage === "Meeting Scheduled" ? "Meeting" : stage;
                }}
              />
              <YAxis 
                fontSize={12} 
                tick={{ fill: "#64748b" }}
                tickFormatter={(val) => `৳${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip content={<ReportChartTooltip />} formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={34}>
                {data.pipelineValueByStage.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#${getGradientId("pipeline-stage-value", index)})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportChartCard title="Average Success Rating by Stage" description="Identify where deal quality is strongest or weakest." badge="Confidence" isEmpty={data.avgRatingByStage.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.avgRatingByStage}>
              <defs>
                <linearGradient id="pipelineRatingLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="50%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#0f766e" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="stage" fontSize={12} tick={{ fill: "#64748b" }} />
              <YAxis domain={[0, 10]} fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Line
                type="monotone"
                dataKey="avgRating"
                stroke="url(#pipelineRatingLine)"
                strokeWidth={3}
                dot={{ fill: "#0f766e", r: 4, stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <div className="grid gap-4 sm:grid-cols-2">
          <ReportMetricCard title="Won Deals" value={String(data.wonLostCount.won)} detail="Deals moved into a won stage" tone="teal" icon={Trophy} badge="result" />
          <ReportMetricCard title="Lost Deals" value={String(data.wonLostCount.lost)} detail="Deals marked as lost" tone="rose" icon={Gauge} badge="drop" />
        <ReportMetricCard
          title="Total Active Pipeline"
          value={String(activePipelineCount)}
          detail="Open deals currently in the funnel"
          tone="sky"
          icon={GitBranchPlus}
          badge="open"
        />
        <ReportMetricCard
          title="Average Success Rating"
          value={data.avgRatingByStage.length > 0
            ? (data.avgRatingByStage.reduce((sum, item) => sum + item.avgRating, 0) / data.avgRatingByStage.length).toFixed(1)
            : "0.0"}
          detail="Average rating across active stages"
          tone="amber"
          icon={Target}
          badge="score"
        />
      </div>
      </div>

      <ReportDataTable 
        title="Stuck Leads (No activity in 30 days)" 
        columns={columns} 
        data={data.stuckLeads} 
        exportFileName="stuck-leads"
      />

      <ReportDataTable 
        title="Negotiation Stage Leads" 
        columns={columns} 
        data={data.negotiationStageLeads} 
        exportFileName="negotiation-leads"
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
