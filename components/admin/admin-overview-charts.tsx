"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ReportChartCard } from "@/components/crm/reports/report-chart-card";
import { REPORT_CHART_COLORS, ReportChartLegend, ReportChartTooltip } from "@/components/crm/reports/report-visuals";

type AdminOverviewChartsProps = {
  userGrowthTrend: Array<{ month: string; users: number }>;
  workspaceActivity: Array<{ workspace: string; activityCount: number }>;
  signupRequestFunnel: Array<{ status: string; count: number }>;
  pipelineValueByWorkspace: Array<{ workspace: string; value: number }>;
  userActivityDistribution: Array<{ user: string; activityCount: number }>;
};

export function AdminOverviewCharts({
  userGrowthTrend,
  workspaceActivity,
  signupRequestFunnel,
  pipelineValueByWorkspace,
  userActivityDistribution,
}: AdminOverviewChartsProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ReportChartCard
        title="User growth"
        description="Track new user creation across the platform."
        isEmpty={userGrowthTrend.length === 0}
        emptyDescription="No user growth data is available yet."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={userGrowthTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" allowDecimals={false} />
            <Tooltip content={<ReportChartTooltip />} />
            <Line type="monotone" dataKey="users" name="Users" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ReportChartCard>

      <ReportChartCard
        title="Workspace activity"
        description="Compare recent activity volume across workspaces."
        isEmpty={workspaceActivity.length === 0}
        emptyDescription="No workspace activity was recorded in this period."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={workspaceActivity}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="workspace" stroke="#94a3b8" hide />
            <YAxis stroke="#94a3b8" allowDecimals={false} />
            <Tooltip content={<ReportChartTooltip />} />
            <Bar dataKey="activityCount" name="Activity" radius={[10, 10, 0, 0]}>
              {workspaceActivity.map((entry, index) => (
                <Cell key={`${entry.workspace}-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ReportChartCard>

      <ReportChartCard
        title="Access request funnel"
        description="Monitor the current signup approval pipeline."
        isEmpty={signupRequestFunnel.length === 0}
        emptyDescription="No signup request records are available yet."
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={signupRequestFunnel}
              dataKey="count"
              nameKey="status"
              innerRadius={52}
              outerRadius={92}
              paddingAngle={4}
            >
              {signupRequestFunnel.map((entry, index) => (
                <Cell key={`${entry.status}-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ReportChartTooltip />} />
            <ReportChartLegend
              payload={signupRequestFunnel.map((entry, index) => ({
                value: entry.status,
                color: REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length],
              }))}
            />
          </PieChart>
        </ResponsiveContainer>
      </ReportChartCard>

      <ReportChartCard
        title="Pipeline value by workspace"
        description="See where estimated deal value is concentrated."
        isEmpty={pipelineValueByWorkspace.length === 0}
        emptyDescription="No pipeline value data is available yet."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pipelineValueByWorkspace}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="workspace" stroke="#94a3b8" hide />
            <YAxis stroke="#94a3b8" />
            <Tooltip content={<ReportChartTooltip />} />
            <Bar dataKey="value" name="Pipeline value" radius={[10, 10, 0, 0]} fill="#0284c7" />
          </BarChart>
        </ResponsiveContainer>
      </ReportChartCard>

      <ReportChartCard
        title="User activity distribution"
        description="Identify the most active users in the selected period."
        className="xl:col-span-2"
        isEmpty={userActivityDistribution.length === 0}
        emptyDescription="No activity data is available for users in this period."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={userActivityDistribution} layout="vertical" margin={{ left: 24, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" stroke="#94a3b8" allowDecimals={false} />
            <YAxis type="category" dataKey="user" stroke="#94a3b8" width={180} />
            <Tooltip content={<ReportChartTooltip />} />
            <Bar dataKey="activityCount" name="Activity" radius={[0, 12, 12, 0]} fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </ReportChartCard>
    </div>
  );
}
