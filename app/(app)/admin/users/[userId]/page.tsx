import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminUserActions } from "@/components/admin/admin-user-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportMetricCard } from "@/components/crm/reports/report-visuals";
import { getFixedSuperAdminEmail } from "@/lib/auth/super-admin";
import { formatDateTimeBD } from "@/lib/format/datetime";
import { getAdminUserDetail } from "@/lib/admin/queries";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getAdminUserDetail(userId);

  if (!user) {
    notFound();
  }

  const isProtected = user.email === getFixedSuperAdminEmail();

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.full_name?.trim() || user.email}
        description="Inspect account posture, workspace placement, ownership context, and recent platform activity."
        actions={(
          <Link href="/admin/users" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
            <ArrowLeft className="size-4" />
            Back to users
          </Link>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Account summary</CardTitle>
              <Badge variant={user.is_active ? "success" : "destructive"}>{user.is_active ? "Active" : "Inactive"}</Badge>
              {user.is_super_admin ? <Badge variant="info">Super Admin</Badge> : null}
              {isProtected ? <Badge variant="warning">Protected fixed admin</Badge> : null}
            </div>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <InfoPill label="Workspace" value={user.organization_name ?? "No workspace"} />
              <InfoPill label="Role" value={user.role_name ?? (user.is_super_admin ? "Super Admin" : "Unassigned")} />
              <InfoPill label="Job title" value={user.job_title ?? "-"} />
              <InfoPill label="Department" value={user.department ?? "-"} />
              <InfoPill label="Phone" value={user.phone ?? "-"} />
              <InfoPill label="Last login" value={user.last_login_at ? formatDateTimeBD(user.last_login_at) : "Never"} />
            </div>
            <AdminUserActions
              userId={user.id}
              email={user.email}
              isActive={user.is_active}
              isSuperAdmin={user.is_super_admin}
              isProtected={isProtected}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <ReportMetricCard title="Assigned companies" value={String(user.companies_count)} tone="sky" />
          <ReportMetricCard title="Meetings" value={String(user.meetings_count)} tone="teal" />
          <ReportMetricCard title="Follow-ups" value={String(user.followups_count)} tone="amber" />
          <ReportMetricCard title="Documents" value={String(user.documents_count)} tone="rose" />
          <ReportMetricCard title="Help requests" value={String(user.help_requests_count)} tone="slate" />
          <ReportMetricCard title="Workspace members" value={String(user.workspace_member_count)} tone="sky" />
        </div>
      </div>

      <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest platform events attributed to this user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {user.recentActivity.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No activity recorded yet for this user.
            </p>
          ) : user.recentActivity.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.action}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {item.organization_name ?? "No workspace"} - {formatDateTimeBD(item.created_at)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
