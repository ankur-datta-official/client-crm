import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminOverviewCharts } from "@/components/admin/admin-overview-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ReportMetricCard } from "@/components/crm/reports/report-visuals";
import { formatDateTimeBD } from "@/lib/format/datetime";
import { formatCurrency } from "@/lib/crm/utils";
import { getAdminOverviewData, resolveAdminFilters } from "@/lib/admin/queries";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = resolveAdminFilters(await searchParams);
  const overview = await getAdminOverviewData(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Console"
        description="Run the platform from one place with global visibility into users, workspaces, signup approvals, and activity."
      />

      <AdminFilterBar
        basePath="/admin"
        filters={overview.filters}
        options={overview.filterOptions}
        statusOptions={[
          { value: "", label: "All signals" },
          { value: "active", label: "Active focus" },
          { value: "inactive", label: "Inactive users" },
          { value: "followup", label: "Follow-up watch" },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportMetricCard title="Total users" value={String(overview.kpis.totalUsers)} detail={`${overview.kpis.activeUsers} active - ${overview.kpis.inactiveUsers} inactive`} tone="sky" badge="platform" />
        <ReportMetricCard title="Open access queue" value={String(overview.kpis.pendingSignupRequests)} detail="Pending signup requests awaiting review" tone="amber" badge="approval" />
        <ReportMetricCard title="Workspaces" value={String(overview.kpis.totalWorkspaces)} detail="Global organizations currently in the CRM" tone="teal" badge="global" />
        <ReportMetricCard title="Pipeline value" value={formatCurrency(overview.kpis.totalPipelineValue)} detail="Estimated value across visible workspaces" tone="rose" badge="revenue" />
        <ReportMetricCard title="Companies" value={String(overview.kpis.totalCompanies)} detail="Lead and company records in the current scope" tone="slate" />
        <ReportMetricCard title="Meetings" value={String(overview.kpis.totalMeetings)} detail="Meeting and interaction volume for the selected period" tone="sky" />
        <ReportMetricCard title="Follow-ups" value={String(overview.kpis.totalFollowups)} detail="Pending and completed follow-up workload" tone="teal" />
        <ReportMetricCard title="Documents" value={String(overview.kpis.totalDocuments)} detail={`${overview.kpis.totalHelpRequests} help requests are also tracked globally`} tone="amber" />
      </div>

      <AdminOverviewCharts
        userGrowthTrend={overview.userGrowthTrend}
        workspaceActivity={overview.workspaceActivity}
        signupRequestFunnel={overview.signupRequestFunnel}
        pipelineValueByWorkspace={overview.pipelineValueByWorkspace}
        userActivityDistribution={overview.userActivityDistribution}
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent platform activity</CardTitle>
                <CardDescription>See who is doing what across the CRM right now.</CardDescription>
              </div>
              <Link href="/admin/analytics" className="text-sm font-medium text-primary">
                Open analytics
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.recentActivity.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No recent activity found for the selected scope.
              </p>
            ) : overview.recentActivity.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {(item.actor_name?.trim() || item.actor_email || "System")} - {item.action}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {item.organization_name ?? "No workspace"} - {formatDateTimeBD(item.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline">{item.entity_type ?? "activity"}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Alerts</CardTitle>
                  <CardDescription>Operational issues that need super admin attention.</CardDescription>
                </div>
                <Badge variant="info">{overview.alerts.length} live</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.alerts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                  No urgent platform alerts right now.
                </p>
              ) : overview.alerts.map((alert) => (
                <Link key={alert.id} href={alert.href} className="block rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{alert.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{alert.description}</p>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Latest access requests</CardTitle>
                  <CardDescription>Newest account requests in the approval pipeline.</CardDescription>
                </div>
                <Link href="/admin/access-requests" className="text-sm font-medium text-primary">
                  Review queue
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.latestAccessRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{request.full_name || request.email}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{request.email}</p>
                    </div>
                    <Badge variant={request.status === "pending" ? "warning" : request.status === "completed" ? "success" : "secondary"}>
                      {request.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Recently active workspaces</CardTitle>
                  <CardDescription>High-level health of the most active workspaces.</CardDescription>
                </div>
                <Link href="/admin/workspaces" className="text-sm font-medium text-primary">
                  Open workspaces
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.recentWorkspaces.map((workspace) => (
                <Link key={workspace.id} href={`/admin/workspaces/${workspace.id}`} className="block rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{workspace.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {workspace.member_count} members - {workspace.companies_count} companies
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-slate-400" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
