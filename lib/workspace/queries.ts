import { cache } from "react";
import { requireAuth } from "@/lib/auth/session";
import { canCreateWorkspaceForUser, listAccessibleWorkspacesForUser } from "./service";
import type { WorkspaceSummary } from "./types";

export const getAccessibleWorkspaces = cache(async (): Promise<WorkspaceSummary[]> => {
  const user = await requireAuth();
  return listAccessibleWorkspacesForUser(user.id);
});

export async function getAccessibleWorkspaceCount() {
  const workspaces = await getAccessibleWorkspaces();
  return workspaces.length;
}

export const getCanCreateWorkspace = cache(async () => {
  const user = await requireAuth();
  return canCreateWorkspaceForUser(user.id);
});
