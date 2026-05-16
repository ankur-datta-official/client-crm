import Link from "next/link";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTimeBD } from "@/lib/format/datetime";
import { formatCurrency } from "@/lib/crm/utils";
import { getAdminFilterOptions, listAdminWorkspaces, resolveAdminFilters } from "@/lib/admin/queries";

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = resolveAdminFilters(await searchParams);
  const [options, workspaces] = await Promise.all([
    getAdminFilterOptions(),
    listAdminWorkspaces(filters),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Management"
        description="Track adoption, member load, pipeline health, and recent activity across every workspace."
      />

      <AdminFilterBar
        basePath="/admin/workspaces"
        filters={filters}
        options={options}
        statusOptions={[
          { value: "", label: "All workspaces" },
          { value: "quiet", label: "Quiet workspaces" },
        ]}
      />

      <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
        <CardContent className="p-0">
          {workspaces.rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No workspaces matched the current filters.
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {workspaces.rows.map((workspace) => (
                  <div key={workspace.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900/90">
                    <div className="space-y-1">
                      <Link href={`/admin/workspaces/${workspace.id}`} className="font-semibold text-slate-900 hover:text-primary dark:text-slate-100">
                        {workspace.name}
                      </Link>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{workspace.slug}</div>
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div><span className="text-slate-500 dark:text-slate-400">Owner:</span> {workspace.owner_name || workspace.owner_email || "Unassigned"}</div>
                      {workspace.owner_email ? <div className="text-xs text-slate-500 dark:text-slate-400">{workspace.owner_email}</div> : null}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{workspace.member_count} total</Badge>
                        <Badge variant="success">{workspace.active_member_count} active</Badge>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {workspace.companies_count} companies · {workspace.meetings_count} meetings · {workspace.documents_count} docs
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(workspace.pipeline_value)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {workspace.followups_pending_count} pending follow-ups · {workspace.help_requests_open_count} open help
                        </div>
                      </div>
                      <div><span className="text-slate-500 dark:text-slate-400">Last activity:</span> {workspace.last_activity_at ? formatDateTimeBD(workspace.last_activity_at) : "No activity yet"}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>CRM volume</TableHead>
                      <TableHead>Pipeline</TableHead>
                      <TableHead>Last activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workspaces.rows.map((workspace) => (
                      <TableRow key={workspace.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <Link href={`/admin/workspaces/${workspace.id}`} className="font-semibold text-slate-900 hover:text-primary dark:text-slate-100">
                              {workspace.name}
                            </Link>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{workspace.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{workspace.owner_name || workspace.owner_email || "Unassigned"}</div>
                            {workspace.owner_email ? <div className="text-xs text-slate-500 dark:text-slate-400">{workspace.owner_email}</div> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{workspace.member_count} total</Badge>
                            <Badge variant="success">{workspace.active_member_count} active</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                          {workspace.companies_count} companies · {workspace.meetings_count} meetings · {workspace.documents_count} docs
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(workspace.pipeline_value)}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {workspace.followups_pending_count} pending follow-ups · {workspace.help_requests_open_count} open help
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{workspace.last_activity_at ? formatDateTimeBD(workspace.last_activity_at) : "No activity yet"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AdminPagination
        basePath="/admin/workspaces"
        page={workspaces.page}
        pageSize={workspaces.pageSize}
        total={workspaces.total}
        query={{
          query: filters.query,
          dateRange: filters.dateRange,
          workspaceId: filters.workspaceId,
          userId: filters.userId,
          status: filters.status,
        }}
      />
    </div>
  );
}
