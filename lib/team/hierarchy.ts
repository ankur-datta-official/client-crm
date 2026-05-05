import "server-only";

import { getCurrentProfile, hasPermission, requireAuth, requireOrganization } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/notifications";
import { createClient } from "@/lib/supabase/server";

type MinimalProfile = {
  id: string;
  full_name: string | null;
  email: string;
  manager_user_id: string | null;
};

export async function canManageTeamMember(targetUserId: string) {
  const user = await requireAuth();
  const organization = await requireOrganization();

  if (user.id === targetUserId) {
    return true;
  }

  if (await hasPermission("settings.manage")) {
    return true;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", targetUserId)
    .eq("organization_id", organization.id)
    .eq("manager_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function ensureCanManageTeamMember(targetUserId: string, message = "You do not have permission to manage this team member.") {
  const allowed = await canManageTeamMember(targetUserId);

  if (!allowed) {
    throw new Error(message);
  }
}

export async function ensureCanAssignUser(targetUserId: string) {
  await ensureCanManageTeamMember(
    targetUserId,
    "You can only assign work to yourself, your direct junior team members, or any user when you have admin settings access.",
  );
}

export async function ensureCanWorkWithCompany(companyId: string) {
  const user = await requireAuth();
  const organization = await requireOrganization();

  if (await hasPermission("settings.manage")) {
    return;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, assigned_user_id")
    .eq("id", companyId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Company was not found in your workspace.");
  }

  if (!data.assigned_user_id || data.assigned_user_id === user.id) {
    return;
  }

  const canManageAssignedUser = await canManageTeamMember(data.assigned_user_id);
  if (!canManageAssignedUser) {
    throw new Error("Only the assigned team member, their senior, or an admin can update this company.");
  }
}

export async function getAssignableTeamMembers() {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("full_name");

  if (!(await hasPermission("settings.manage"))) {
    query = query.or(`id.eq.${user.id},manager_user_id.eq.${user.id}`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{ id: string; full_name: string | null; email: string }>;
}

async function getDirectManagerProfile(userId: string, organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, manager_user_id")
    .eq("id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const actorProfile = data as MinimalProfile | null;

  if (!actorProfile?.manager_user_id) {
    return null;
  }

  const { data: manager, error: managerError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", actorProfile.manager_user_id)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (managerError) {
    throw new Error(managerError.message);
  }

  return manager as { id: string; full_name: string | null; email: string } | null;
}

export async function notifyDirectManagerOfActivity(input: {
  actorUserId?: string | null;
  title: string;
  message: string;
  link: string;
}) {
  const actorUserId = input.actorUserId ?? null;
  const profile = await getCurrentProfile();

  if (!actorUserId || !profile?.organization_id) {
    return;
  }

  const manager = await getDirectManagerProfile(actorUserId, profile.organization_id);
  if (!manager || manager.id === actorUserId) {
    return;
  }

  await createNotification({
    userId: manager.id,
    type: "team.subordinate_activity",
    title: input.title,
    message: input.message,
    link: input.link,
  });
}
