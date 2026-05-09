"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceErrorMessage } from "@/lib/auth/errors";
import { requireAuth } from "@/lib/auth/session";
import { createWorkspaceForUser, switchWorkspaceForUser } from "./service";

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is required."),
  companySize: z.string().trim().min(1, "Company size is required."),
});

export type WorkspaceActionState =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

export async function createWorkspaceAction(values: unknown): Promise<WorkspaceActionState> {
  const user = await requireAuth();
  const parsed = workspaceSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid workspace details." };
  }

  try {
    const organizationId = await createWorkspaceForUser(user.id, parsed.data);

    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/settings/workspaces");

    return { ok: true, organizationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create workspace right now.";
    return { ok: false, error: getWorkspaceErrorMessage(message) };
  }
}

export async function switchWorkspaceAction(organizationId: string) {
  const user = await requireAuth();
  await switchWorkspaceForUser(user.id, organizationId);

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/workspaces");

  return { ok: true };
}
