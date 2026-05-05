"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDisplayName } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  onRoleChange: (userId: string, roleId: string) => void;
  onDeactivate: (userId: string) => void;
  onReactivate: (userId: string, roleId?: string) => void;
};

export function TeamMemberCard({
  member,
  roles,
  canUpdateRole,
  canDeactivate,
  onRoleChange,
  onDeactivate,
  onReactivate,
}: TeamMemberCardProps) {
  const fallbackRoleId = member.role_id ?? roles.find((role) => role.slug === "viewer")?.id ?? roles[0]?.id;

  return (
    <div className="rounded-lg border bg-white p-4">
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
          <span>{member.manager_name ?? member.manager_email ?? "-"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Last Login</span>
          <span>{member.last_login_at ? new Date(member.last_login_at).toLocaleString() : "Never recorded"}</span>
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
              {canUpdateRole ? (
                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                  <select
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                    value={member.role_id ?? ""}
                    onChange={(event) => onRoleChange(member.id, event.target.value)}
                    disabled={!member.is_active}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </DropdownMenuItem>
              ) : null}
              {canDeactivate && member.is_active ? (
                <DropdownMenuItem onSelect={() => onDeactivate(member.id)}>
                  Deactivate user
                </DropdownMenuItem>
              ) : null}
              {canDeactivate && !member.is_active && fallbackRoleId ? (
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
