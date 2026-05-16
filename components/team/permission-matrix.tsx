"use client";

import { useMemo, useState, useTransition } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateRolePermissions } from "@/lib/team/team-actions";
import { PERMISSION_GROUPS, type Permission, type RoleWithPermissions } from "@/lib/team/types";
import { cn } from "@/lib/utils";

type PermissionMatrixProps = {
  role: RoleWithPermissions | null;
  permissions: Permission[];
  canManage: boolean;
  onSaved: () => void;
};

export function PermissionMatrix({ role, permissions, canManage, onSaved }: PermissionMatrixProps) {
  const [isPending, startTransition] = useTransition();
  const permissionByKey = useMemo(
    () => new Map(permissions.map((permission) => [permission.key, permission])),
    [permissions],
  );
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(() =>
    role
      ? role.permissions
          .map((permissionKey) => permissionByKey.get(permissionKey)?.id ?? null)
          .filter((permissionId): permissionId is string => Boolean(permissionId))
      : [],
  );

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((value) => value !== permissionId)
        : [...current, permissionId],
    );
  }

  function handleSave() {
    if (!role || !canManage) {
      return;
    }

    startTransition(async () => {
      await updateRolePermissions(role.id, selectedPermissionIds);
      onSaved();
    });
  }

  if (!role) {
    return (
      <div className="rounded-2xl border bg-white p-8 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_20px_40px_-30px_rgba(2,6,23,0.95)]">
        <div className="mx-auto max-w-xl text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Role permissions</div>
          <h3 className="mt-3 text-2xl font-semibold text-foreground">Create the role first, then choose what it can access.</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            After you save a new custom role, this panel will open its permission checklist automatically so you can finish the setup safely.
          </p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm dark:border-primary/15 dark:bg-primary/10">
            <div className="font-medium text-foreground">Keep access limited</div>
            <p className="mt-2 text-muted-foreground">Only enable the pages and actions this role genuinely needs.</p>
          </div>
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm dark:border-primary/15 dark:bg-primary/10">
            <div className="font-medium text-foreground">Review sensitive actions</div>
            <p className="mt-2 text-muted-foreground">Sensitive team, settings, and scoring controls should stay with trusted managers or admins.</p>
          </div>
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm dark:border-primary/15 dark:bg-primary/10">
            <div className="font-medium text-foreground">Assign when ready</div>
            <p className="mt-2 text-muted-foreground">Your new role will appear in team member and invitation role selectors automatically.</p>
          </div>
        </div>
      </div>
    );
  }

  const isAdminRole = role.slug === "organization-admin";

  return (
    <div className="rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_20px_40px_-30px_rgba(2,6,23,0.95)]">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">{role.name}</h3>
          <p className="text-sm text-muted-foreground">{role.description ?? "No description provided."}</p>
        </div>
        <Button type="button" onClick={handleSave} disabled={!canManage || isPending || isAdminRole}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? "Saving..." : "Save Permissions"}
        </Button>
      </div>
      {isAdminRole ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100">
          <ShieldCheck className="mt-0.5 h-5 w-5" />
          <div>Organization Admin always keeps full access. This role is shown for visibility and cannot be reduced.</div>
        </div>
      ) : null}
      <div className="mt-6 space-y-6">
        {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
          <section key={groupKey} className="space-y-3">
            <div>
              <h4 className="font-medium">{group.label}</h4>
              <p className="text-sm text-muted-foreground">Choose which actions this role can perform.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.permissions.map((permissionKey) => {
                const permission = permissionByKey.get(permissionKey);
                if (!permission) {
                  return null;
                }

                const checked = selectedPermissionIds.includes(permission.id) || isAdminRole;

                return (
                  <label
                    key={permission.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3",
                      checked ? "border-primary bg-primary/5 dark:bg-primary/10" : "bg-background dark:border-slate-800 dark:bg-slate-950/70",
                      (!canManage || isAdminRole) && "opacity-80",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!canManage || isAdminRole}
                      onCheckedChange={() => togglePermission(permission.id)}
                    />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium">{permission.name}</span>
                      <span className="block text-xs text-muted-foreground">{permission.description ?? permission.key}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
