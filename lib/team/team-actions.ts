"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getCurrentProfile,
  getCurrentUser,
  hasPermission,
  requireAuth,
  requireOrganization,
  requirePermission,
} from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { createNotification } from "@/lib/notifications/notifications";
import { applyScoringEvent, buildScoreIdempotencyKey } from "@/lib/scoring/service";
import { createClient } from "@/lib/supabase/server";
import { checkUserLimit } from "@/lib/subscription/subscription-queries";
import { sendTeamInviteEmail } from "./invite-email";
import { getPermissions, getRoleById, getRoles } from "./team-queries";

type InviteTeamMemberInput = {
  email: string;
  roleId: string;
  fullName?: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
};

type RoleInput = {
  name: string;
  description?: string;
};

const inviteTeamMemberSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Please enter a valid email address."),
  roleId: z.string().trim().min(1, "Role is required."),
  fullName: z.string().trim().optional(),
  jobTitle: z.string().trim().optional(),
  department: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

const roleInputSchema = z.object({
  name: z.string().trim().min(1, "Role name is required."),
  description: z.string().trim().optional(),
});

async function logActivity(
  organizationId: string,
  action: string,
  entityType: string | null,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  await supabase.from("activity_logs").insert({
    organization_id: organizationId,
    actor_user_id: user?.id ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getRoleOrThrow(roleId: string, organizationId: string) {
  const role = await getRoleById(roleId);

  if (!role || role.organization_id !== organizationId) {
    throw new Error("Role not found.");
  }

  return role;
}

async function getDefaultRoleId() {
  const roles = await getRoles();
  return roles.find((role) => role.slug === "viewer")?.id ?? roles[0]?.id ?? null;
}

async function ensureRoleManagementAccess() {
  const allowed = await hasPermission("settings.manage");

  if (!allowed) {
    throw new Error("You do not have permission to manage roles.");
  }
}

export async function inviteTeamMember(input: InviteTeamMemberInput) {
  await requirePermission("team.invite");
  const organization = await requireOrganization();
  const user = await requireAuth();
  const supabase = await createClient();
  const parsedInputResult = inviteTeamMemberSchema.safeParse(input);
  if (!parsedInputResult.success) {
    throw new Error(parsedInputResult.error.errors[0]?.message ?? "Please check the invite form and try again.");
  }
  const parsedInput = parsedInputResult.data;
  const email = normalizeEmail(parsedInput.email);
  const userLimit = await checkUserLimit(1);

  if (!userLimit.allowed) {
    await logActivity(organization.id, "subscription.limit_reached", "organization", organization.id, {
      limit_type: "users",
      current: userLimit.current,
      projected: userLimit.projected,
      max: userLimit.max,
    });
    throw new Error(userLimit.message ?? "Your current plan has no room for more team members.");
  }

  await getRoleOrThrow(parsedInput.roleId, organization.id);

  const { data: existingInvitation } = await supabase
    .from("team_invitations")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvitation) {
    throw new Error("A pending invitation already exists for this email.");
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile?.organization_id === organization.id) {
    throw new Error("This user is already a member of your organization.");
  }

  if (existingProfile?.organization_id && existingProfile.organization_id !== organization.id) {
    throw new Error("This user already belongs to another organization.");
  }

  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from("team_invitations")
    .insert({
      organization_id: organization.id,
      email,
      role_id: parsedInput.roleId,
      invited_by: user.id,
      token,
      full_name: parsedInput.fullName || null,
      job_title: parsedInput.jobTitle || null,
      department: parsedInput.department || null,
      phone: parsedInput.phone || null,
    })
    .select("id, token")
    .single();

  if (error) {
    logServerError("team.invite", error, { organizationId: organization.id, email });
    throw new Error(getSafeErrorMessage(error, "Unable to create the invitation right now."));
  }

  let emailDelivery: Awaited<ReturnType<typeof sendTeamInviteEmail>>;

  try {
    emailDelivery = await sendTeamInviteEmail({
      email,
      token: data.token,
      fullName: parsedInput.fullName || null,
    });
  } catch (deliveryError) {
    logServerError("team.invite.email", deliveryError, { organizationId: organization.id, email });
    emailDelivery = {
      ok: false,
      reason: deliveryError instanceof Error ? deliveryError.message : "Email delivery could not be completed.",
    };
  }

  await logActivity(organization.id, "team.member.invited", "team_invitation", data.id, {
    email,
    role_id: parsedInput.roleId,
    email_delivery_method: emailDelivery.ok ? emailDelivery.method : "manual_fallback",
  });

  await createNotification({
    userId: user.id,
    type: "team.invitation.created",
    title: "Invitation created",
    message: emailDelivery.ok
      ? `Invitation email sent to ${email}.`
      : `Invite created for ${email}, but email delivery needs manual fallback.`,
    link: "/team",
  });

  revalidatePath("/team");
  return {
    ...data,
    emailDelivery,
  };
}

export async function cancelTeamInvitation(invitationId: string) {
  await requirePermission("team.invite");
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data: invitation, error: fetchError } = await supabase
    .from("team_invitations")
    .select("id, email, status")
    .eq("id", invitationId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (fetchError || !invitation) {
    throw new Error("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new Error("Only pending invitations can be cancelled.");
  }

  const { error } = await supabase
    .from("team_invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(organization.id, "team.invitation.cancelled", "team_invitation", invitationId, {
    email: invitation.email,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function resendTeamInvitation(invitationId: string) {
  await requirePermission("team.invite");
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data: invitation, error: fetchError } = await supabase
    .from("team_invitations")
    .select("id, email, status")
    .eq("id", invitationId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (fetchError || !invitation) {
    throw new Error("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new Error("Only pending invitations can be resent.");
  }

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("team_invitations")
    .update({
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

  const { data: invitationDetails } = await supabase
    .from("team_invitations")
    .select("email, full_name")
    .eq("id", invitationId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  let emailDelivery: Awaited<ReturnType<typeof sendTeamInviteEmail>>;

  try {
    emailDelivery = await sendTeamInviteEmail({
      email: invitationDetails?.email ?? invitation.email,
      token,
      fullName: invitationDetails?.full_name ?? null,
    });
  } catch (deliveryError) {
    logServerError("team.invite.resend_email", deliveryError, { organizationId: organization.id, email: invitation.email });
    emailDelivery = {
      ok: false,
      reason: deliveryError instanceof Error ? deliveryError.message : "Email delivery could not be completed.",
    };
  }

  await logActivity(organization.id, "team.invitation.resent", "team_invitation", invitationId, {
    email: invitation.email,
    email_delivery_method: emailDelivery.ok ? emailDelivery.method : "manual_fallback",
  });

  revalidatePath("/team");
  return { success: true, token, emailDelivery };
}

export async function acceptTeamInvitation(token: string) {
  const user = await requireAuth();
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: invitationRecord } = await supabase
    .from("team_invitations")
    .select("id, email, organization_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invitationRecord || invitationRecord.status !== "pending" || new Date(invitationRecord.expires_at).getTime() <= Date.now()) {
    throw new Error("This invitation is invalid or has expired.");
  }

  if (!user.email || normalizeEmail(user.email) !== normalizeEmail(invitationRecord.email)) {
    throw new Error("Please sign in with the same email address that received this invitation.");
  }

  if (profile?.organization_id && profile.is_active) {
    throw new Error("This account already belongs to an active organization.");
  }

  const { data, error } = await supabase.rpc("accept_team_invitation", {
    invite_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.organization_id) {
    throw new Error("This invitation is invalid or has expired.");
  }

  await logActivity(result.organization_id as string, "team.invitation.accepted", "team_invitation", result.invitation_id as string, {
    accepted_user_id: user.id,
    role_id: result.role_id,
  });

  const { data: invitation } = await supabase
    .from("team_invitations")
    .select("id, email, invited_by")
    .eq("id", result.invitation_id as string)
    .eq("organization_id", result.organization_id as string)
    .maybeSingle();

  if (invitation?.invited_by && invitation.invited_by !== user.id) {
    await applyScoringEvent({
      organizationId: result.organization_id as string,
      userId: invitation.invited_by,
      actionKey: "team_invite_accepted",
      sourceRecordId: invitation.id,
      sourceRecordType: "team_invitation",
      metadata: {
        accepted_user_id: user.id,
        invited_email: invitation.email,
      },
      actorUserId: user.id,
      addToLeadScore: false,
      idempotencyKey: buildScoreIdempotencyKey(["team_invite_accepted", invitation.id]),
    });
  }

  revalidatePath("/team");
  revalidatePath("/dashboard");
  return result as { organization_id: string; invitation_id: string; role_id: string };
}

export async function updateTeamMemberRole(userId: string, roleId: string) {
  await requirePermission("team.update_role");
  const organization = await requireOrganization();
  const user = await requireAuth();
  const supabase = await createClient();
  const role = await getRoleOrThrow(roleId, organization.id);

  if (userId === user.id) {
    throw new Error("You cannot change your own role.");
  }

  const { data: targetProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, organization_id, is_active")
    .eq("id", userId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (profileError || !targetProfile) {
    throw new Error("Team member not found.");
  }

  await supabase
    .from("user_roles")
    .delete()
    .eq("organization_id", organization.id)
    .eq("user_id", userId);

  const { error } = await supabase.from("user_roles").insert({
    organization_id: organization.id,
    user_id: userId,
    role_id: roleId,
    assigned_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(organization.id, "team.member.role_changed", "profile", userId, {
    email: targetProfile.email,
    role_id: roleId,
    role_name: role.name,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function updateTeamMemberManager(userId: string, managerUserId: string | null) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const user = await requireAuth();
  const supabase = await createClient();

  if (userId === user.id && managerUserId) {
    throw new Error("You cannot report to yourself.");
  }

  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id, email, organization_id")
    .eq("id", userId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (targetError || !targetProfile) {
    throw new Error("Team member not found.");
  }

  if (managerUserId) {
    const { data: managerProfile, error: managerError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", managerUserId)
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .maybeSingle();

    if (managerError || !managerProfile) {
      throw new Error("Selected senior team member was not found.");
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      manager_user_id: managerUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(organization.id, "team.member.manager_changed", "profile", userId, {
    email: targetProfile.email,
    manager_user_id: managerUserId,
    updated_by: user.id,
  });

  revalidatePath("/team");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: true };
}

export async function deactivateTeamMember(userId: string) {
  await requirePermission("team.deactivate");
  const organization = await requireOrganization();
  const user = await requireAuth();
  const supabase = await createClient();

  if (userId === user.id) {
    throw new Error("You cannot deactivate your own account.");
  }

  const { data: targetProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, organization_id, is_active")
    .eq("id", userId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (profileError || !targetProfile) {
    throw new Error("Team member not found.");
  }

  if (!targetProfile.is_active) {
    throw new Error("This team member is already inactive.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(organization.id, "team.member.deactivated", "profile", userId, {
    email: targetProfile.email,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function reactivateTeamMember(userId: string, roleId?: string) {
  await requirePermission("team.deactivate");
  const organization = await requireOrganization();
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: targetProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, organization_id, is_active")
    .eq("id", userId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (profileError || !targetProfile) {
    throw new Error("Team member not found.");
  }

  if (targetProfile.is_active) {
    throw new Error("This team member is already active.");
  }

  const selectedRoleId = roleId ?? (await getDefaultRoleId());
  if (!selectedRoleId) {
    throw new Error("No role is available for reactivation.");
  }

  const role = await getRoleOrThrow(selectedRoleId, organization.id);

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: true })
    .eq("id", userId)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

  const { data: currentRoles } = await supabase
    .from("user_roles")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("user_id", userId);

  if ((currentRoles ?? []).length === 0) {
    const { error: roleError } = await supabase.from("user_roles").insert({
      organization_id: organization.id,
      user_id: userId,
      role_id: selectedRoleId,
      assigned_by: user.id,
    });

    if (roleError) {
      throw new Error(roleError.message);
    }
  }

  await logActivity(organization.id, "team.member.reactivated", "profile", userId, {
    email: targetProfile.email,
    role_id: selectedRoleId,
    role_name: role.name,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function createRole(input: RoleInput) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const parsedInputResult = roleInputSchema.safeParse(input);
  if (!parsedInputResult.success) {
    throw new Error(parsedInputResult.error.errors[0]?.message ?? "Please check the role form and try again.");
  }
  const parsedInput = parsedInputResult.data;
  const slug = parsedInput.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data, error } = await supabase
    .from("roles")
    .insert({
      organization_id: organization.id,
      name: parsedInput.name,
      slug: `${slug}-${Date.now()}`,
      description: parsedInput.description || null,
      is_system: false,
    })
    .select("id, name")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(organization.id, "team.role.created", "role", data.id, {
    name: data.name,
  });

  revalidatePath("/team");
  return data;
}

export async function updateRole(roleId: string, input: RoleInput) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const role = await getRoleOrThrow(roleId, organization.id);
  const parsedInputResult = roleInputSchema.safeParse(input);
  if (!parsedInputResult.success) {
    throw new Error(parsedInputResult.error.errors[0]?.message ?? "Please check the role form and try again.");
  }
  const parsedInput = parsedInputResult.data;

  if (role.is_system) {
    throw new Error("System role names cannot be edited.");
  }

  const { error } = await supabase
    .from("roles")
    .update({
      name: parsedInput.name,
      description: parsedInput.description || null,
    })
    .eq("id", roleId)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(organization.id, "team.role.updated", "role", roleId, {
    name: parsedInput.name,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function archiveRole(roleId: string) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const role = await getRoleOrThrow(roleId, organization.id);

  if (role.is_system) {
    throw new Error("System roles cannot be archived.");
  }

  const { count, error: countError } = await supabase
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .eq("role_id", roleId);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error("Reassign team members before archiving this role.");
  }

  const { error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(organization.id, "team.role.archived", "role", roleId, {
    name: role.name,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]) {
  await ensureRoleManagementAccess();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const role = await getRoleOrThrow(roleId, organization.id);
  const permissions = await getPermissions();

  const permissionMap = new Map(permissions.map((permission) => [permission.id, permission]));
  const validPermissionIds = permissionIds.filter((permissionId) => permissionMap.has(permissionId));
  const finalPermissionIds =
    role.slug === "organization-admin" ? permissions.map((permission) => permission.id) : validPermissionIds;

  const { error: deleteError } = await supabase.from("role_permissions").delete().eq("role_id", roleId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (finalPermissionIds.length > 0) {
    const { error: insertError } = await supabase.from("role_permissions").insert(
      finalPermissionIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
      })),
    );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  await logActivity(organization.id, "team.role.permissions_updated", "role", roleId, {
    permission_ids: finalPermissionIds,
  });

  revalidatePath("/team");
  return { success: true };
}
