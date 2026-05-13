"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, MoreHorizontal, Search, User } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deactivateTeamMember, reactivateTeamMember, updateTeamMemberRole } from "@/lib/team/team-actions";
import { formatDateTimeBD } from "@/lib/format/datetime";
import type { RoleRow, TeamMember } from "@/lib/team/types";
import { getDisplayName } from "@/lib/utils";
import { RoleBadge } from "./role-badge";
import { TeamMemberCard } from "./team-member-card";
import { UserStatusBadge } from "./user-status-badge";

type TeamMemberTableProps = {
  members: TeamMember[];
  roles: RoleRow[];
  currentUserId: string | null;
  canUpdateRole: boolean;
  canDeactivate: boolean;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

function getAssignableRoles(member: TeamMember, roles: RoleRow[]) {
  if (member.is_workspace_owner) {
    return roles.filter((role) => role.slug === "organization-admin");
  }

  return roles;
}

export function TeamMemberTable({
  members,
  roles,
  currentUserId,
  canUpdateRole,
  canDeactivate,
}: TeamMemberTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [roleUpdateError, setRoleUpdateError] = useState<string | null>(null);
  const [roleUpdateMessage, setRoleUpdateMessage] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        member.full_name?.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.job_title?.toLowerCase().includes(query) ||
        member.department?.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || member.role_id === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && member.is_active) ||
        (statusFilter === "inactive" && !member.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, roleFilter, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const visibleMembers = filteredMembers.slice(pageStart, pageStart + pageSize);
  const rangeStart = filteredMembers.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + visibleMembers.length, filteredMembers.length);

  function refreshAfter(work: () => Promise<void>, options?: { successMessage?: string }) {
    startTransition(async () => {
      try {
        await work();
        setRoleUpdateError(null);
        if (options?.successMessage) {
          setRoleUpdateMessage(options.successMessage);
        }
        router.refresh();
      } catch (error) {
        setRoleUpdateMessage(null);
        setRoleUpdateError(error instanceof Error ? error.message : "Unable to complete this team update right now.");
      }
    });
  }

  function handleRoleChange(member: TeamMember, roleId: string) {
    refreshAfter(async () => {
      await updateTeamMemberRole(member.id, roleId);
    }, {
      successMessage: `Role updated for ${getDisplayName(member.full_name, member.email)}.`,
    });
  }

  function handleDeactivate(userId: string) {
    refreshAfter(async () => {
      await deactivateTeamMember(userId);
      setDeactivateId(null);
    });
  }

  function handleReactivate(userId: string, roleId?: string) {
    refreshAfter(async () => {
      await reactivateTeamMember(userId, roleId);
    });
  }

  if (members.length === 0) {
    return (
      <EmptyState
        title="No team members yet"
        description="Invite your first teammate to start collaborating in this CRM workspace."
        icon={User}
        actionLabel="Invite User"
        actionHref="/team"
      />
    );
  }

  return (
    <div className="space-y-4">
      {roleUpdateError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Team update failed</AlertTitle>
          <AlertDescription>{roleUpdateError}</AlertDescription>
        </Alert>
      ) : null}

      {roleUpdateMessage ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Team updated</AlertTitle>
          <AlertDescription>{roleUpdateMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="crm-filter-surface grid gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by name, email, designation, or department"
            className="pl-9"
          />
        </div>
        <div className="flex gap-3">
          <select
            className="crm-filter-select"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <select
            className="crm-filter-select"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {canUpdateRole ? (
        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          Custom roles you create in the <span className="font-medium text-foreground">Roles & Permissions</span> tab will appear here automatically, so you can assign them to active team members safely.
        </div>
      ) : null}

      {filteredMembers.length === 0 ? (
        <EmptyState
          title="No matching team members"
          description="Try a different search or filter combination."
          icon={User}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.95)]">
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart}-{rangeEnd} of {filteredMembers.length} team members
            </p>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <select
                className="rounded-full border border-input bg-background px-3 py-1.5 text-foreground outline-none transition focus:border-ring"
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                  setCurrentPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:hidden">
            {visibleMembers.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                roles={roles}
                canUpdateRole={canUpdateRole && member.id !== currentUserId}
                canDeactivate={canDeactivate && member.id !== currentUserId}
                onRoleChange={handleRoleChange}
                onDeactivate={() => setDeactivateId(member.id)}
                onReactivate={handleReactivate}
              />
            ))}
          </div>

          <div className="crm-table-shell hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Reports To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMembers.map((member) => {
                    const fallbackRoleId = member.role_id ?? roles.find((role) => role.slug === "viewer")?.id ?? roles[0]?.id;
                    const isProtectedMember = Boolean(member.is_fixed_super_admin || member.is_workspace_owner);
                    const canManageMemberRole = canUpdateRole && member.id !== currentUserId && !member.is_fixed_super_admin;
                    const canManageMemberStatus = canDeactivate && member.id !== currentUserId && !member.is_fixed_super_admin;
                    const assignableRoles = getAssignableRoles(member, roles);
                    const selectedRoleName = roles.find((role) => role.id === member.role_id)?.name ?? member.role_name ?? "Unassigned";

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="max-w-[180px]">
                          <div className="truncate font-medium">
                            {getDisplayName(member.full_name, member.email)}
                            {member.id === currentUserId ? <span className="ml-2 text-xs text-muted-foreground">(You)</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{member.email}</TableCell>
                        <TableCell><RoleBadge name={member.role_name ?? "Unassigned"} /></TableCell>
                        <TableCell className="max-w-[160px] truncate">{member.job_title ?? "-"}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{member.department ?? "-"}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{member.manager_name ?? member.manager_email ?? "-"}</TableCell>
                        <TableCell><UserStatusBadge active={member.is_active} /></TableCell>
                        <TableCell className="max-w-[180px] truncate">{member.last_login_at ? formatDateTimeBD(member.last_login_at) : "Never recorded"}</TableCell>
                        <TableCell className="text-right">
                          {(canManageMemberRole || canManageMemberStatus) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isPending}>
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Manage member</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                {canManageMemberRole ? (
                                  <>
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger disabled={!member.is_active || isProtectedMember}>
                                        Change role
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent className="w-56">
                                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                                          Current: {selectedRoleName}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {assignableRoles.map((role) => (
                                          <DropdownMenuItem
                                            key={role.id}
                                            disabled={role.id === member.role_id}
                                            onSelect={() => handleRoleChange(member, role.id)}
                                          >
                                            {role.name}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  </>
                                ) : null}
                                {canManageMemberStatus && member.is_active ? (
                                  <DropdownMenuItem onSelect={() => setDeactivateId(member.id)}>
                                    Deactivate user
                                  </DropdownMenuItem>
                                ) : null}
                                {canManageMemberStatus && !member.is_active && fallbackRoleId ? (
                                  <DropdownMenuItem onSelect={() => handleReactivate(member.id, fallbackRoleId)}>
                                    Reactivate user
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {member.is_fixed_super_admin ? "Protected" : "No actions"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.95)]">
            <p className="text-sm text-muted-foreground">
              Page {safeCurrentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={Boolean(deactivateId)}
        onOpenChange={(open) => !open && setDeactivateId(null)}
        title="Deactivate team member"
        description="This will block the user from accessing the CRM until an admin reactivates them."
        confirmLabel="Deactivate"
        onConfirm={() => {
          if (!deactivateId) return;
          handleDeactivate(deactivateId);
        }}
      />
    </div>
  );
}
