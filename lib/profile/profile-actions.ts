"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, requireAuth, requireOrganization } from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { removePrivateUpload, savePrivateUpload, validateUploadMetadata, validateUploadSize } from "@/lib/storage/local";
import {
  buildProfileAvatarPath,
  isStoredProfileAvatarPath,
  resolveProfileAvatarUrl,
  sanitizeAvatarFileName,
} from "./profile-utils";

export type CurrentProfileSettings = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  roleName: string | null;
  roleSlug: string | null;
};

export type ProfileActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  avatarUrl?: string | null;
};

type RawProfileRow = {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  is_active: boolean;
  is_super_admin: boolean;
};

const updateCurrentProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^[0-9+()\-\s.]{7,20}$/.test(value), "Please enter a valid phone number."),
  jobTitle: z.string().trim().optional(),
  department: z.string().trim().optional(),
});

function getValidationFailure(error: z.ZodError): ProfileActionState {
  return {
    ok: false,
    error: error.errors[0]?.message ?? "Please check the form and try again.",
    fieldErrors: Object.fromEntries(error.errors.map((issue) => [String(issue.path[0]), issue.message])),
  };
}

function getProfileAvatarStorageErrorMessage(error: { message?: string; statusCode?: string | number } | null | undefined) {
  const rawMessage = error?.message?.toLowerCase() ?? "";
  const statusCode = String(error?.statusCode ?? "");

  if (rawMessage.includes("bucket not found") || statusCode === "404") {
    return "Storage bucket not found. Please create profile-avatars bucket.";
  }

  if (
    rawMessage.includes("row-level security")
    || rawMessage.includes("permission denied")
    || rawMessage.includes("unauthorized")
    || statusCode === "401"
    || statusCode === "403"
  ) {
    return "You do not have permission to upload this profile photo.";
  }

  return "Upload failed. Please try again.";
}

async function insertActivityLog(action: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const user = await requireAuth();
  const organization = await requireOrganization();

  await prisma.$executeRaw`
    insert into public.activity_logs (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      ${organization.id}::uuid,
      ${user.id}::uuid,
      ${action},
      'profile',
      ${entityId}::uuid,
      ${JSON.stringify(metadata)}::jsonb
    )
  `;
}

async function getRawCurrentProfile() {
  const user = await requireAuth();
  const organization = await requireOrganization();

  const rows = await prisma.$queryRaw<RawProfileRow[]>`
    select
      id::text as id,
      organization_id::text as organization_id,
      email,
      full_name,
      avatar_url,
      job_title,
      department,
      phone,
      is_active,
      is_super_admin
    from public.profiles
    where id = ${user.id}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const profile = rows[0] ?? null;
  if (!profile) {
    throw new Error("Profile not found.");
  }

  return { organization, profile };
}

async function getCurrentRoleInfo(userId: string, organizationId: string) {
  try {
    const userRole = await prisma.userRole.findFirst({
      where: {
        user_id: userId,
        organization_id: organizationId,
      },
      select: {
        role: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        assigned_at: "asc",
      },
    });

    return {
      roleName: userRole?.role?.name ?? null,
      roleSlug: userRole?.role?.slug ?? null,
    };
  } catch (error) {
    logServerError("profile.role.lookup", error, { userId, organizationId });
    return { roleName: null, roleSlug: null };
  }
}

async function cleanupUploadedAvatar(filePath: string) {
  try {
    await removePrivateUpload(filePath);
  } catch (error) {
    logServerError("profile.avatar.cleanup_failed", error, { filePath });
  }
}

function revalidateProfileSurfaces() {
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  revalidatePath("/team");
}

export async function getCurrentProfileSettings(): Promise<CurrentProfileSettings> {
  const user = await requireAuth();
  const { organization, profile } = await getRawCurrentProfile();
  const roleInfo = await getCurrentRoleInfo(user.id, organization.id);
  const avatarUrl = await resolveProfileAvatarUrl(profile.avatar_url, 900, {
    profileId: profile.id,
    organizationId: organization.id,
  });

  return {
    id: profile.id,
    organizationId: organization.id,
    organizationName: organization.name,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl,
    jobTitle: profile.job_title,
    department: profile.department,
    phone: profile.phone,
    isActive: profile.is_active,
    isSuperAdmin: profile.is_super_admin,
    roleName: profile.is_super_admin ? "Super Admin" : roleInfo.roleName,
    roleSlug: roleInfo.roleSlug,
  };
}

export async function updateCurrentProfile(input: {
  fullName: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
}): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  const { organization, profile } = await getRawCurrentProfile();
  const parsed = updateCurrentProfileSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationFailure(parsed.error);
  }

  try {
    await prisma.$executeRaw`
      update public.profiles
      set
        full_name = ${parsed.data.fullName},
        phone = ${parsed.data.phone || null},
        job_title = ${parsed.data.jobTitle || null},
        department = ${parsed.data.department || null},
        updated_at = now()
      where id = ${profile.id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    logServerError("profile.update", error, { userId: profile.id, organizationId: organization.id });
    return { ok: false, error: getSafeErrorMessage(error, "Unable to update your profile right now.") };
  }

  await insertActivityLog("profile.updated", profile.id, {
    email: profile.email,
    actor_user_id: user?.id ?? null,
  });

  revalidateProfileSurfaces();

  return { ok: true, message: "Profile updated successfully." };
}

export async function uploadProfileAvatar(formData: FormData): Promise<ProfileActionState> {
  const { organization, profile } = await getRawCurrentProfile();
  const maybeFile = formData.get("file");
  const file = maybeFile instanceof File ? maybeFile : null;

  if (!file || file.size <= 0) {
    return { ok: false, error: "Please choose an image to upload." };
  }

  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  const avatarValidation = validateUploadMetadata(
    file,
    ["jpg", "jpeg", "png", "webp"],
    allowedMimeTypes,
  );

  if (!avatarValidation.ok) {
    return { ok: false, error: "Please upload JPG, PNG, or WEBP image." };
  }

  const hardSizeValidation = validateUploadSize(file.size);
  if (!hardSizeValidation.ok) {
    return { ok: false, error: hardSizeValidation.message };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Profile photo must be under 2MB." };
  }

  const avatarFileName = `avatar-${Date.now()}-${sanitizeAvatarFileName(file.name)}`;
  const filePath = buildProfileAvatarPath(organization.id, profile.id, avatarFileName);

  try {
    await savePrivateUpload(filePath, file);
  } catch (uploadError) {
    logServerError("profile.avatar.upload", uploadError, {
      userId: profile.id,
      organizationId: organization.id,
      filePath,
      fileName: file.name,
      fileSize: file.size,
    });
    return { ok: false, error: getProfileAvatarStorageErrorMessage(null) };
  }

  try {
    await prisma.$executeRaw`
      update public.profiles
      set
        avatar_url = ${filePath},
        updated_at = now()
      where id = ${profile.id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (updateError) {
    await cleanupUploadedAvatar(filePath);
    logServerError("profile.avatar.record", updateError, {
      userId: profile.id,
      organizationId: organization.id,
      filePath,
    });
    return { ok: false, error: getSafeErrorMessage(updateError, "Unable to save your profile photo right now.") };
  }

  if (profile.avatar_url && isStoredProfileAvatarPath(profile.avatar_url) && profile.avatar_url !== filePath) {
    await cleanupUploadedAvatar(profile.avatar_url);
  }

  const avatarUrl = await resolveProfileAvatarUrl(filePath, 900, {
    profileId: profile.id,
    organizationId: organization.id,
  });
  await insertActivityLog("profile.avatar_updated", profile.id, {
    file_name: avatarFileName,
  });

  revalidateProfileSurfaces();

  return {
    ok: true,
    message: "Profile photo updated successfully.",
    avatarUrl,
  };
}

export async function removeProfileAvatar(): Promise<ProfileActionState> {
  const { organization, profile } = await getRawCurrentProfile();

  try {
    await prisma.$executeRaw`
      update public.profiles
      set
        avatar_url = null,
        updated_at = now()
      where id = ${profile.id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    logServerError("profile.avatar.remove", error, { userId: profile.id, organizationId: organization.id });
    return { ok: false, error: getSafeErrorMessage(error, "Unable to remove your profile photo right now.") };
  }

  if (profile.avatar_url && isStoredProfileAvatarPath(profile.avatar_url)) {
    await cleanupUploadedAvatar(profile.avatar_url);
  }

  await insertActivityLog("profile.avatar_removed", profile.id);
  revalidateProfileSurfaces();

  return {
    ok: true,
    message: "Profile photo removed successfully.",
    avatarUrl: null,
  };
}
