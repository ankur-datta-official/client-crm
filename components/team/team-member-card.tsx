"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTimeBD } from "@/lib/format/datetime";
import { getDisplayName } from "@/lib/utils";
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
import type { RoleRow, TeamMember } from "@/lib/team/types";
import { RoleBadge } from "./role-badge";
import { UserStatusBadge } from "./user-status-badge";

type TeamMemberCardProps = {
  member: TeamMember;
  roles: RoleRow[];
  canUpdateRole: boolean;
  canDeactivate: boolean;
  canManageHierarchy: boolean;
  managerOptions: Array<{ id: string; label: string }>;
  onRoleChange: (member: TeamMember, roleId: string) => void;
  onManagerChange: (member: TeamMember, managerUserId: string | null) => void;
  onDeactivate: (userId: string) => void;
  onReactivate: (userId: string, roleId?: string) => void;
};

export function TeamMemberCard({
  member,
  roles,
  canUpdateRole,
  canDeactivate,
  canManageHierarchy,
  managerOptions,
  onRoleChange,
  onManagerChange,
  onDeactivate,
  onReactivate,
}: TeamMemberCardProps) {
  const fallbackRoleId = member.role_id ?? roles.find((role) => role.slug === "viewer")?.id ?? roles[0]?.id;
  const isProtectedMember = Boolean(member.is_fixed_super_admin || member.is_workspace_owner);
  const assignableRoles = member.is_workspace_owner
    ? roles.filter((role) => role.slug === "organization-admin")
    : roles;
  const selectedRoleName = roles.find((role) => role.id === member.role_id)?.name ?? member.role_name ?? "Unassigned";
  const canManageMemberHierarchy = canManageHierarchy && member.is_active;
  const assignableManagers = managerOptions.filter((candidate) => candidate.id !== member.id);

  return (
    <div className="rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900/85">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{getDisplayName(member.full_name, member.email)}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{member.email}</p>
        </div>
        <UserStatusBadge active={member.is_active} />
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Role</span>
          <RoleBadge name={member.role_name ?? "Unassigned"} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Designation</span>
          <span>{member.job_title ?? "-"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Department</span>
          <span>{member.department ?? "-"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Reports To</span>
          {canManageMemberHierarchy ? (
            <select
              className="h-10 min-w-[11rem] rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring dark:border-slate-800 dark:bg-slate-950/85 dark:[color-scheme:dark]"
              value={member.manager_user_id ?? ""}
              aria-label={`Reports to for ${getDisplayName(member.full_name, member.email)}`}
              onChange={(event) => {
                const value = event.target.value || null;
                onManagerChange(member, value);
              }}
            >
              <option value="">No senior assigned</option>
              {assignableManagers.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
          ) : (
            <span>{member.manager_name ?? member.manager_email ?? "No senior assigned"}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Last Login</span>
          <span>{member.last_login_at ? formatDateTimeBD(member.last_login_at) : "Never recorded"}</span>
        </div>
      </div>
      {(canUpdateRole || canDeactivate) ? (
        <div className="mt-4 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="mr-2 h-4 w-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdateRole && !member.is_fixed_super_admin ? (
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
                        onSelect={() => onRoleChange(member, role.id)}
                      >
                        {role.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              {canDeactivate && member.is_active && !member.is_fixed_super_admin ? (
                <DropdownMenuItem onSelect={() => onDeactivate(member.id)}>
                  Deactivate user
                </DropdownMenuItem>
              ) : null}
              {canDeactivate && !member.is_active && fallbackRoleId && !member.is_fixed_super_admin ? (
                <DropdownMenuItem onSelect={() => onReactivate(member.id, fallbackRoleId)}>
                  Reactivate user
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}
