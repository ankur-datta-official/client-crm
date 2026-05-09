import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export const LOCAL_STORAGE_SCHEME = "local://";

const EXTERNAL_URL_PATTERN = /^(https?:)?\/\//i;
const DEFAULT_PUBLIC_UPLOAD_DIR = "public/uploads";
const DEFAULT_PRIVATE_UPLOAD_DIR = "uploads/private";
const DEFAULT_TEMP_UPLOAD_DIR = "uploads/tmp";

function getConfiguredBaseUrl() {
  const rawBaseUrl =
    process.env.PUBLIC_UPLOAD_BASE_URL
    ?? process.env.NEXTAUTH_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? "";

  const value = rawBaseUrl.trim();
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/+$/, "");
  }

  if (value.startsWith("localhost") || value.startsWith("127.0.0.1")) {
    return `http://${value.replace(/\/+$/, "")}`;
  }

  return `https://${value.replace(/\/+$/, "")}`;
}

function resolveConfiguredDir(configuredDir: string) {
  return path.isAbsolute(configuredDir)
    ? path.normalize(configuredDir)
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredDir);
}

export function getUploadRootDir() {
  const configuredDir = process.env.UPLOAD_DIR?.trim() || DEFAULT_PUBLIC_UPLOAD_DIR;
  return resolveConfiguredDir(configuredDir);
}

export function getPrivateUploadRootDir() {
  const configuredDir =
    process.env.PRIVATE_UPLOAD_DIR?.trim()
    || process.env.UPLOAD_DIR?.trim()
    || DEFAULT_PRIVATE_UPLOAD_DIR;

  return resolveConfiguredDir(configuredDir);
}

export function getTemporaryUploadRootDir() {
  const configuredDir = process.env.TEMP_UPLOAD_DIR?.trim() || DEFAULT_TEMP_UPLOAD_DIR;
  return resolveConfiguredDir(configuredDir);
}

export function getMaxUploadSizeBytes() {
  const rawValue = process.env.MAX_UPLOAD_SIZE_MB?.trim();
  const maxUploadSizeMb = rawValue ? Number(rawValue) : null;

  if (!maxUploadSizeMb || Number.isNaN(maxUploadSizeMb) || maxUploadSizeMb <= 0) {
    return null;
  }

  return Math.round(maxUploadSizeMb * 1024 * 1024);
}

export function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function sanitizeStoredFileName(fileName: string, fallback = "file", maxLength = 120) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .trim();

  const safeValue = cleaned || fallback;
  return safeValue.slice(0, maxLength);
}

export function isExternalFileUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  return EXTERNAL_URL_PATTERN.test(value) || value.startsWith("/") || value.startsWith("data:") || value.startsWith("blob:");
}

export function isLocalStoredFilePath(value?: string | null) {
  return Boolean(value?.startsWith(LOCAL_STORAGE_SCHEME));
}

export function encodeLocalStoredFilePath(relativePath: string) {
  return `${LOCAL_STORAGE_SCHEME}${relativePath.replace(/\\/g, "/")}`;
}

export function decodeLocalStoredFilePath(storedPath: string) {
  if (!isLocalStoredFilePath(storedPath)) {
    throw new Error("Path is not a local storage path.");
  }

  return storedPath.slice(LOCAL_STORAGE_SCHEME.length);
}

export function buildDocumentStoredPath(
  organizationId: string,
  companyId: string,
  documentId: string,
  originalFileName: string,
) {
  const safeOrganizationId = sanitizePathSegment(organizationId);
  const safeCompanyId = sanitizePathSegment(companyId);
  const safeDocumentId = sanitizePathSegment(documentId);
  const safeFileName = sanitizeStoredFileName(originalFileName, "document", 120);

  return encodeLocalStoredFilePath(`documents/${safeOrganizationId}/${safeCompanyId}/${safeDocumentId}/${safeFileName}`);
}

export function buildProfileAvatarStoredPath(
  organizationId: string,
  profileId: string,
  fileName: string,
) {
  const safeOrganizationId = sanitizePathSegment(organizationId);
  const safeProfileId = sanitizePathSegment(profileId);
  const safeFileName = sanitizeStoredFileName(fileName, "avatar", 100);

  return encodeLocalStoredFilePath(`avatars/${safeOrganizationId}/${safeProfileId}/${safeFileName}`);
}

export function getDocumentIdFromStoredPath(storedPath?: string | null) {
  if (!storedPath || !isLocalStoredFilePath(storedPath)) {
    return null;
  }

  const relativePath = decodeLocalStoredFilePath(storedPath);
  const [, , , documentId] = relativePath.split("/");
  return documentId || null;
}

export function getProfileIdFromStoredPath(storedPath?: string | null) {
  if (!storedPath || !isLocalStoredFilePath(storedPath)) {
    return null;
  }

  const relativePath = decodeLocalStoredFilePath(storedPath);
  const [, , profileId] = relativePath.split("/");
  return profileId || null;
}

function resolveAbsoluteUploadPath(relativePath: string) {
  const rootDir = getPrivateUploadRootDir();
  const absolutePath = path.resolve(rootDir, relativePath);
  const normalizedRootDir = path.normalize(rootDir);

  if (absolutePath !== normalizedRootDir && !absolutePath.startsWith(`${normalizedRootDir}${path.sep}`)) {
    throw new Error("Resolved path is outside of the configured upload directory.");
  }

  return absolutePath;
}

export function validateUploadSize(fileSize: number) {
  const maxUploadSizeBytes = getMaxUploadSizeBytes();

  if (!maxUploadSizeBytes) {
    return { ok: true as const };
  }

  if (fileSize <= maxUploadSizeBytes) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    message: `File exceeds the hard upload limit of ${Math.round(maxUploadSizeBytes / (1024 * 1024))}MB.`,
  };
}

export function validateUploadMetadata(file: File, allowedExtensions?: readonly string[], allowedMimeTypes?: readonly string[]) {
  const normalizedName = file.name.trim();
  const extension = normalizedName.includes(".")
    ? normalizedName.split(".").pop()?.toLowerCase() ?? ""
    : "";

  if (!normalizedName || !extension) {
    return {
      ok: false as const,
      message: "The uploaded file must include a valid filename and extension.",
    };
  }

  if (!file.type?.trim()) {
    return {
      ok: false as const,
      message: "The uploaded file is missing a valid MIME type.",
    };
  }

  if (allowedExtensions && !allowedExtensions.includes(extension)) {
    return {
      ok: false as const,
      message: "This file extension is not allowed.",
    };
  }

  if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) {
    return {
      ok: false as const,
      message: "This file type is not allowed.",
    };
  }

  return {
    ok: true as const,
    extension,
  };
}

export async function savePrivateUpload(storedPath: string, file: File) {
  const relativePath = decodeLocalStoredFilePath(storedPath);
  const absolutePath = resolveAbsoluteUploadPath(relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return {
    absolutePath,
    relativePath,
    size: buffer.byteLength,
  };
}

export async function savePrivateUploadBuffer(storedPath: string, buffer: Buffer | Uint8Array) {
  const relativePath = decodeLocalStoredFilePath(storedPath);
  const absolutePath = resolveAbsoluteUploadPath(relativePath);
  const normalizedBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, normalizedBuffer);

  return {
    absolutePath,
    relativePath,
    size: normalizedBuffer.byteLength,
  };
}

export async function removePrivateUpload(storedPath: string) {
  if (!isLocalStoredFilePath(storedPath)) {
    return;
  }

  const relativePath = decodeLocalStoredFilePath(storedPath);
  const absolutePath = resolveAbsoluteUploadPath(relativePath);
  await fs.rm(absolutePath, { force: true });
}

export async function readPrivateUpload(storedPath: string) {
  const relativePath = decodeLocalStoredFilePath(storedPath);
  const absolutePath = resolveAbsoluteUploadPath(relativePath);
  const content = await fs.readFile(absolutePath);

  return {
    absolutePath,
    relativePath,
    content,
  };
}

export function buildStorageRouteUrl(routePath: string) {
  const normalizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const baseUrl = getConfiguredBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
