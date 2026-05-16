import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminUserActions } from "@/components/admin/admin-user-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFixedSuperAdminEmail } from "@/lib/auth/super-admin";
import { formatDateTimeBD } from "@/lib/format/datetime";
import { getAdminFilterOptions, listAdminUsers, resolveAdminFilters } from "@/lib/admin/queries";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = resolveAdminFilters(await searchParams);
  const [options, users] = await Promise.all([
    getAdminFilterOptions(),
    listAdminUsers(filters),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Inspect every user across the CRM, review usage signals, and safely manage account lifecycle and super-admin access."
      />

      <AdminFilterBar
        basePath="/admin/users"
        filters={filters}
        options={options}
        statusOptions={[
          { value: "", label: "All users" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
          { value: "super_admin", label: "Super Admins" },
        ]}
      />

      <Card className="rounded-[30px] border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
        <CardContent className="p-0">
          {users.rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No users matched the current filters.
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {users.rows.map((user) => {
                  const isProtected = user.email === getFixedSuperAdminEmail();

                  return (
                    <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900/90">
                      <div className="space-y-1">
                        <Link href={`/admin/users/${user.id}`} className="font-semibold text-slate-900 hover:text-primary dark:text-slate-100">
                          {user.full_name?.trim() || user.email}
                        </Link>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                        {isProtected ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            <ShieldCheck className="size-3.5" />
                            Protected fixed admin
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div><span className="text-slate-500 dark:text-slate-400">Workspace:</span> {user.organization_name ?? "No workspace"}</div>
                        <div><span className="text-slate-500 dark:text-slate-400">Role:</span> {user.role_name ?? (user.is_super_admin ? "Super Admin" : "Unassigned")}</div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={user.is_active ? "success" : "destructive"}>
                            {user.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {user.is_super_admin ? <Badge variant="info">Super Admin</Badge> : null}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {user.companies_count} companies · {user.meetings_count} meetings · {user.followups_count} follow-ups
                        </div>
                        <div><span className="text-slate-500 dark:text-slate-400">Last login:</span> {user.last_login_at ? formatDateTimeBD(user.last_login_at) : "Never"}</div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <AdminUserActions
                          userId={user.id}
                          email={user.email}
                          isActive={user.is_active}
                          isSuperAdmin={user.is_super_admin}
                          isProtected={isProtected}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Last login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.rows.map((user) => {
                      const isProtected = user.email === getFixedSuperAdminEmail();

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <Link href={`/admin/users/${user.id}`} className="font-semibold text-slate-900 hover:text-primary dark:text-slate-100">
                                {user.full_name?.trim() || user.email}
                              </Link>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                              {isProtected ? (
                                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                  <ShieldCheck className="size-3.5" />
                                  Protected fixed admin
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{user.organization_name ?? "No workspace"}</TableCell>
                          <TableCell>{user.role_name ?? (user.is_super_admin ? "Super Admin" : "Unassigned")}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={user.is_active ? "success" : "destructive"}>
                                {user.is_active ? "Active" : "Inactive"}
                              </Badge>
                              {user.is_super_admin ? <Badge variant="info">Super Admin</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                            {user.companies_count} companies · {user.meetings_count} meetings · {user.followups_count} follow-ups
                          </TableCell>
                          <TableCell>{user.last_login_at ? formatDateTimeBD(user.last_login_at) : "Never"}</TableCell>
                          <TableCell className="text-right">
                            <AdminUserActions
                              userId={user.id}
                              email={user.email}
                              isActive={user.is_active}
                              isSuperAdmin={user.is_super_admin}
                              isProtected={isProtected}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AdminPagination
        basePath="/admin/users"
        page={users.page}
        pageSize={users.pageSize}
        total={users.total}
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
