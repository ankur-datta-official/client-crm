"use client";

import { Building2, CheckCircle2, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { switchWorkspaceAction } from "@/lib/workspace/actions";
import type { WorkspaceSummary } from "@/lib/workspace/types";

type WorkspaceManagementPanelProps = {
  workspaces: WorkspaceSummary[];
  canCreateWorkspace: boolean;
};

export function WorkspaceManagementPanel({
  workspaces,
  canCreateWorkspace,
}: WorkspaceManagementPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSwitch(organizationId: string) {
    setError(null);
    setPendingWorkspaceId(organizationId);
    startTransition(async () => {
      try {
        await switchWorkspaceAction(organizationId);
        router.push("/dashboard");
        router.refresh();
      } catch (switchError) {
        setError(switchError instanceof Error ? switchError.message : "Unable to switch workspace right now.");
      } finally {
        setPendingWorkspaceId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/80 bg-white shadow-[0_20px_70px_-56px_rgba(15,23,42,0.45)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">Workspace access</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6 dark:text-slate-300">
              Switch your active workspace here. Your profile menu and the rest of the CRM will follow this selection.
            </CardDescription>
          </div>
          {canCreateWorkspace ? (
            <CreateWorkspaceDialog
              trigger={(
                <Button className="rounded-xl">
                  <Plus className="size-4" />
                  Create Workspace
                </Button>
              )}
            />
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {workspaces.map((workspace) => {
              const isSwitching = isPending && pendingWorkspaceId === workspace.id;

              return (
                <Card key={workspace.id} className="border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/70">
                  <CardContent className="flex h-full flex-col gap-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm dark:bg-slate-950 dark:text-slate-200">
                          <Building2 className="size-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{workspace.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {workspace.company_size ? `${workspace.company_size} team size` : "Company size not set"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {workspace.is_active ? <Badge variant="success">Active</Badge> : null}
                        {workspace.is_owner ? <Badge variant="secondary">Owner</Badge> : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/80">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{workspace.role_name ?? "Workspace member"}</p>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">Role inside this workspace</p>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{workspace.slug}</p>
                      {workspace.is_active ? (
                        <Button type="button" variant="outline" className="rounded-xl" disabled>
                          <CheckCircle2 className="size-4" />
                          Active now
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          disabled={isPending}
                          onClick={() => handleSwitch(workspace.id)}
                        >
                          <ChevronsUpDown className="size-4" />
                          {isSwitching ? "Switching..." : "Switch here"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
