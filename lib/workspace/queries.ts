import { cache } from "react";
import { requireAuth } from "@/lib/auth/session";
import { canCreateWorkspaceForUser, listAccessibleWorkspacesForUser } from "./service";
import type { WorkspaceSummary } from "./types";

export const getWorkspaceSwitcherState = cache(async () => {
  const user = await requireAuth();
  const workspaces = await listAccessibleWorkspacesForUser(user.id);
  const canCreateWorkspace = workspaces.length === 0
    ? true
    : await canCreateWorkspaceForUser(user.id, workspaces);

  return {
    workspaces,
    canCreateWorkspace,
  };
});

export const getAccessibleWorkspaces = cache(async (): Promise<WorkspaceSummary[]> => {
  const state = await getWorkspaceSwitcherState();
  return state.workspaces;
});

export async function getAccessibleWorkspaceCount() {
  const workspaces = await getAccessibleWorkspaces();
  return workspaces.length;
}

export const getCanCreateWorkspace = cache(async () => {
  const state = await getWorkspaceSwitcherState();
  return state.canCreateWorkspace;
});
