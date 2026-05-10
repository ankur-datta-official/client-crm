import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminOverviewCharts } from "@/components/admin/admin-overview-charts";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportMetricCard } from "@/components/crm/reports/report-visuals";
import { formatCurrency } from "@/lib/crm/utils";
import { getAdminOverviewData, resolveAdminFilters } from "@/lib/admin/queries";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = resolveAdminFilters(await searchParams);
  const overview = await getAdminOverviewData(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Analytics"
        description="Use global filters to inspect adoption, execution quality, and platform-wide activity trends across all workspaces."
      />

      <AdminFilterBar
        basePath="/admin/analytics"
        filters={filters}
        options={overview.filterOptions}
        statusOptions={[
          { value: "", label: "All activity" },
          { value: "followup", label: "Follow-up activity" },
          { value: "meeting", label: "Meeting activity" },
          { value: "company", label: "Company activity" },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportMetricCard title="Users in scope" value={String(overview.kpis.totalUsers)} detail={`${overview.kpis.activeUsers} active`} tone="sky" />
        <ReportMetricCard title="Workspaces in scope" value={String(overview.kpis.totalWorkspaces)} detail="Visible under current filter combination" tone="teal" />
        <ReportMetricCard title="Pipeline in scope" value={formatCurrency(overview.kpis.totalPipelineValue)} detail="Estimated value over selected filters" tone="rose" />
        <ReportMetricCard title="Open approvals" value={String(overview.kpis.pendingSignupRequests)} detail="Signup requests still waiting on super admin action" tone="amber" />
      </div>

      <AdminOverviewCharts
        userGrowthTrend={overview.userGrowthTrend}
        workspaceActivity={overview.workspaceActivity}
        signupRequestFunnel={overview.signupRequestFunnel}
        pipelineValueByWorkspace={overview.pipelineValueByWorkspace}
        userActivityDistribution={overview.userActivityDistribution}
      />

      <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
        <CardHeader>
          <CardTitle>Filtered activity stream</CardTitle>
          <CardDescription>Use this feed to trace operator behaviour, engagement patterns, and cross-workspace movement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.recentActivity.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No activity matched these filters.
            </p>
          ) : overview.recentActivity.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {(item.actor_name?.trim() || item.actor_email || "System")} · {item.action}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {item.organization_name ?? "No workspace"} · {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
