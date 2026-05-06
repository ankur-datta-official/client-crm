"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, PlusCircle, Shield } from "lucide-react";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { archiveRole } from "@/lib/team/team-actions";
import type { Permission, RoleWithPermissions } from "@/lib/team/types";
import { cn } from "@/lib/utils";
import { PermissionMatrix } from "./permission-matrix";
import { RoleForm } from "./role-form";

type RoleTableProps = {
  roles: RoleWithPermissions[];
  permissions: Permission[];
  canManage: boolean;
};

export function RoleTable({ roles, permissions, canManage }: RoleTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(roles[0]?.id ?? null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const activeRoleId = selectedRoleId && roles.some((role) => role.id === selectedRoleId) ? selectedRoleId : (roles[0]?.id ?? null);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === activeRoleId) ?? null,
    [activeRoleId, roles],
  );

  function handleRoleSaved(roleId: string | null) {
    setSelectedRoleId(roleId);
    router.refresh();
  }

  if (roles.length === 0) {
    return (
      <EmptyState
        title="No roles available"
        description="Create a custom role to start managing permissions."
        icon={Shield}
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-white to-emerald-50/60 p-4 shadow-sm dark:border-teal-500/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(6,78,59,0.18),rgba(15,23,42,0.98))] dark:shadow-[0_20px_44px_-28px_rgba(2,6,23,0.98)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">Custom role setup</h3>
              <p className="max-w-xl text-sm text-muted-foreground">
                Create a role, choose its permissions, then assign that role to team members from the Team Members tab.
              </p>
            </div>
            {canManage ? (
              <Button
                type="button"
                className="shrink-0"
                onClick={() => setSelectedRoleId(null)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Role
              </Button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <div className="rounded-xl border border-white/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Step 1</div>
              <p className="mt-2 text-sm text-foreground">Add a clear role name such as Sales Intern or Support Lead.</p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Step 2</div>
              <p className="mt-2 text-sm text-foreground">Turn permissions on only for the actions that role should perform.</p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Step 3</div>
              <p className="mt-2 text-sm text-foreground">Assign the finished role to users from the Team Members tab.</p>
            </div>
          </div>
        </div>

        <RoleForm key={selectedRole?.id ?? "new-role"} selectedRole={selectedRole} canManage={canManage} onSaved={handleRoleSaved} />
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_20px_40px_-30px_rgba(2,6,23,0.95)]">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {canManage ? (
              <TableRow
                  className={cn("cursor-pointer", activeRoleId === null && "bg-primary/5")}
                  onClick={() => setSelectedRoleId(null)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium text-primary">
                      <PlusCircle className="h-4 w-4" />
                      Create a new custom role
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Start with a role name, then configure its permissions.
                    </div>
                  </TableCell>
                  <TableCell>Custom</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">New</TableCell>
                </TableRow>
              ) : null}
              {roles.map((role) => (
                <TableRow
                  key={role.id}
                  className={cn("cursor-pointer", activeRoleId === role.id && "bg-muted/30")}
                  onClick={() => setSelectedRoleId(role.id)}
                >
                  <TableCell>
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs text-muted-foreground">{role.description ?? "No description"}</div>
                  </TableCell>
                  <TableCell>{role.is_system ? "System" : "Custom"}</TableCell>
                  <TableCell className="text-right">
                    {!role.is_system && canManage ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          setArchiveId(role.id);
                        }}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Protected</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <PermissionMatrix key={selectedRole?.id ?? "no-role"} role={selectedRole} permissions={permissions} canManage={canManage} onSaved={() => router.refresh()} />

      <ConfirmModal
        open={Boolean(archiveId)}
        onOpenChange={(open) => !open && setArchiveId(null)}
        title="Archive role"
        description="This permanently removes the custom role after all assigned users have been moved elsewhere."
        confirmLabel="Archive role"
        onConfirm={() => {
          if (!archiveId) {
            return;
          }

          startTransition(async () => {
            await archiveRole(archiveId);
            setArchiveId(null);
            router.refresh();
          });
        }}
      />
    </div>
  );
}
