import { logServerError } from "@/lib/errors";
import {
  buildProfileAvatarStoredPath,
  buildStorageRouteUrl,
  getProfileIdFromStoredPath,
  isExternalFileUrl,
  isLocalStoredFilePath,
  sanitizeStoredFileName,
} from "@/lib/storage/local";

export const PROFILE_AVATAR_BUCKET = "profile-avatars";

export function sanitizeAvatarFileName(fileName: string) {
  return sanitizeStoredFileName(fileName, "avatar", 100);
}

export function isStoredProfileAvatarPath(value?: string | null) {
  if (!value) {
    return false;
  }

  return !isExternalFileUrl(value);
}

export function buildProfileAvatarPath(organizationId: string, profileId: string, fileName: string) {
  return buildProfileAvatarStoredPath(organizationId, profileId, fileName);
}

export async function resolveProfileAvatarUrl(
  avatarUrl?: string | null,
  expiresInSeconds = 900,
  options?: { profileId?: string | null; organizationId?: string | null },
) {
  if (!avatarUrl) {
    return null;
  }

  if (isExternalFileUrl(avatarUrl)) {
    return avatarUrl;
  }

  if (isLocalStoredFilePath(avatarUrl)) {
    const profileId = getProfileIdFromStoredPath(avatarUrl);
    return profileId ? buildStorageRouteUrl(`/api/storage/avatars/${profileId}`) : null;
  }

  if (options?.profileId) {
    return buildStorageRouteUrl(`/api/storage/avatars/${options.profileId}`);
  }

  logServerError("profile.avatar.resolve.missing_profile_id", new Error("Profile ID is required to resolve a legacy avatar route."), {
    avatarPath: avatarUrl,
    expiresInSeconds,
  });
  return null;
}
