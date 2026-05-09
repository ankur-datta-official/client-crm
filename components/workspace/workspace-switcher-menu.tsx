"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronsUpDown,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { switchWorkspaceAction } from "@/lib/workspace/actions";
import type { WorkspaceSummary } from "@/lib/workspace/types";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

type WorkspaceSwitcherMenuProps = {
  workspaces: WorkspaceSummary[];
  canCreateWorkspace: boolean;
};

export function WorkspaceSwitcherMenu({
  workspaces,
  canCreateWorkspace,
}: WorkspaceSwitcherMenuProps) {
  const router = useRouter();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeWorkspaceId = workspaces.find((workspace) => workspace.is_active)?.id ?? "";

  function handleSwitch(organizationId: string) {
    if (!organizationId || organizationId === activeWorkspaceId) {
      return;
    }

    setSwitchError(null);
    setPendingWorkspaceId(organizationId);
    startTransition(async () => {
      try {
        await switchWorkspaceAction(organizationId);
        router.push("/dashboard");
        router.refresh();
      } catch (error) {
        setSwitchError(error instanceof Error ? error.message : "Unable to switch workspace right now.");
      } finally {
        setPendingWorkspaceId(null);
      }
    });
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="rounded-xl px-3 py-2.5 focus:bg-primary/5 data-[state=open]:bg-primary/5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <ChevronsUpDown className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Switch workspace</span>
          <span className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Open a side panel to change workspace
          </span>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {workspaces.length}
        </span>
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="w-80 rounded-[22px] border-slate-200/70 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
        <DropdownMenuLabel className="px-3 py-3">
          <div className="space-y-1">
            <p className="text-[13px] font-black text-slate-900 dark:text-slate-100">Switch workspace</p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Select the workspace you want to open next.
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="mx-2 bg-slate-100/80 dark:bg-slate-800" />

        <div className="space-y-2 p-1.5">
          {workspaces.length > 0 ? (
            workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspaceId;
              const isSwitching = pendingWorkspaceId === workspace.id;

              return (
                <button
                  key={workspace.id}
                  type="button"
                  disabled={isPending || isActive}
                  onClick={() => handleSwitch(workspace.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                    isActive
                      ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-950/30"
                      : "border-slate-200/80 bg-white hover:border-primary/30 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/80 dark:hover:border-primary/40 dark:hover:bg-slate-900"
                  } disabled:cursor-default disabled:opacity-100`}
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                      isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    {isActive ? <CheckCircle2 className="size-4" /> : <BriefcaseBusiness className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">{workspace.name}</p>
                    <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {[workspace.role_name ?? "Workspace member", workspace.is_owner ? "Owner" : null]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${
                      isActive
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-teal-600 dark:text-teal-300"
                    }`}
                  >
                    {isActive ? "Current" : isSwitching ? "Switching..." : "Open"}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              No workspace access found yet.
            </div>
          )}
        </div>

        {switchError ? (
          <div className="mx-2 mt-1 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
            {switchError}
          </div>
        ) : null}

        <DropdownMenuSeparator className="mx-2 bg-slate-100/80 dark:bg-slate-800" />

        <div className="space-y-1 p-1.5">
          {canCreateWorkspace ? (
            <CreateWorkspaceDialog
              trigger={(
                <Button variant="ghost" className="h-auto w-full justify-start rounded-xl px-3 py-2.5 text-left">
                  <Plus className="mr-2 size-4" />
                  <span className="text-[13px] font-bold">Create new workspace</span>
                </Button>
              )}
            />
          ) : null}
          <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/5 focus:text-primary cursor-pointer transition-colors">
            <Link href="/settings/workspaces" className="flex items-center gap-3 px-3 py-2.5">
              <ArrowRight className="size-4" />
              <span className="text-[13px] font-bold">Manage all workspaces</span>
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
