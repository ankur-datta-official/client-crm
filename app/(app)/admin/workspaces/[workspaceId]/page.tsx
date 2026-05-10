import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminWorkspaceOwnerForm } from "@/components/admin/admin-workspace-owner-form";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportMetricCard } from "@/components/crm/reports/report-visuals";
import { formatDateTimeBD } from "@/lib/format/datetime";
import { formatCurrency } from "@/lib/crm/utils";
import { getAdminWorkspaceDetail } from "@/lib/admin/queries";

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const workspace = await getAdminWorkspaceDetail(workspaceId);

  if (!workspace) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspace.name}
        description="Inspect workspace ownership, member roster, data volume, and recent operational signals."
        actions={(
          <Link href="/admin/workspaces" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
            <ArrowLeft className="size-4" />
            Back to workspaces
          </Link>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Workspace summary</CardTitle>
              <Badge variant="secondary">{workspace.slug}</Badge>
            </div>
            <CardDescription>
              Owner: {workspace.owner_name || workspace.owner_email || "Unassigned"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <InfoPill label="Company size" value={workspace.company_size ?? "-"} />
              <InfoPill label="Members" value={`${workspace.member_count} total - ${workspace.active_member_count} active`} />
              <InfoPill label="Created" value={formatDateTimeBD(workspace.created_at)} />
              <InfoPill label="Last activity" value={workspace.last_activity_at ? formatDateTimeBD(workspace.last_activity_at) : "No activity yet"} />
            </div>
            <AdminWorkspaceOwnerForm
              workspaceId={workspace.id}
              currentOwnerUserId={workspace.owner_user_id}
              members={workspace.members}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <ReportMetricCard title="Companies" value={String(workspace.companies_count)} tone="sky" />
          <ReportMetricCard title="Meetings" value={String(workspace.meetings_count)} tone="teal" />
          <ReportMetricCard title="Pending follow-ups" value={String(workspace.followups_pending_count)} tone="amber" />
          <ReportMetricCard title="Documents" value={String(workspace.documents_count)} tone="rose" />
          <ReportMetricCard title="Open help requests" value={String(workspace.help_requests_open_count)} tone="slate" />
          <ReportMetricCard title="Pipeline value" value={formatCurrency(workspace.pipeline_value)} tone="sky" />
        </div>
      </div>

      <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Current workspace roster with role visibility.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{member.full_name?.trim() || member.email}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{member.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{member.role_name ?? "Unassigned"}</TableCell>
                  <TableCell>
                    <Badge variant={member.is_active ? "success" : "destructive"}>
                      {member.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{member.is_super_admin ? <Badge variant="info">Super Admin</Badge> : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest events captured inside this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.recentActivity.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No activity recorded yet for this workspace.
            </p>
          ) : workspace.recentActivity.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {(item.actor_name?.trim() || item.actor_email || "System")} - {item.action}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTimeBD(item.created_at)}</p>
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
