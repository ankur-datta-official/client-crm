# Storage Migration

## Snapshot
- Date/time: 2026-05-07 +06:00
- Goal: replace Supabase Storage with VPS/local storage while preserving secure private-file behavior and rollback safety

## Storage Audit Table
| SL | File path | Storage operation type | Bucket/folder | Public/private | File types | Size limit | Current URL generation | Replacement needed | Risk level |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `lib/profile/profile-actions.ts` | avatar upload, replace, delete | `local://avatars/{organization}/{profile}` with legacy `profile-avatars` fallback | Private | `image/jpeg`, `image/png`, `image/webp` | 2MB app rule + `MAX_UPLOAD_SIZE_MB` hard cap | API-served local URL via `/api/storage/avatars/[profileId]`, legacy signed URL fallback | Partial cleanup later for legacy Supabase fallback | Medium |
| 2 | `lib/profile/profile-utils.ts` | avatar URL resolution | local avatar path or legacy `profile-avatars` bucket | Private | image files only | n/a | local route URL or Supabase signed URL | Keep fallback until old records are migrated | Medium |
| 3 | `app/api/storage/avatars/[profileId]/route.ts` | authenticated avatar read | local private avatar path or legacy `profile-avatars` bucket | Private | image files only | n/a | direct file response for local, signed redirect for legacy | Supabase fallback still remains for old avatar paths | Medium |
| 4 | `lib/crm/document-actions.ts` | document upload, replace, signed view/download URL, delete | `local://documents/{organization}/{company}/{document}` with legacy `crm-documents` fallback | Private | broad document types, validated MIME presence and extension | plan limits + `MAX_UPLOAD_SIZE_MB` hard cap | API-served local URL via `/api/storage/documents/[documentId]`, legacy signed URL fallback | DB layer and legacy fallback still need future cleanup | High |
| 5 | `app/api/storage/documents/[documentId]/route.ts` | authenticated document view/download | local private document path or legacy `crm-documents` bucket | Private | preserves stored document MIME | n/a | direct file response for local, signed redirect for legacy | Supabase fallback still remains for old document paths | High |
| 6 | `.env.example` | storage configuration | local/VPS env template | n/a | n/a | `MAX_UPLOAD_SIZE_MB` | env-driven | complete for template | Low |
| 7 | `.env.production.example` | production storage configuration | VPS env template | n/a | n/a | `MAX_UPLOAD_SIZE_MB` | env-driven | complete for template | Low |
| 8 | `lib/storage/local.ts` | path resolution, file save/read/delete, filename sanitization, hard size validation | `public/uploads`, `uploads/private`, `uploads/tmp` or env overrides | Both structures prepared, current runtime uses private paths | generic | env hard cap | server-side route URLs for private files | foundation complete | Low |

## Current Storage Structure
- Public upload root:
  - `UPLOAD_DIR`
  - default: `public/uploads`
  - reserved for future public-file features
- Private upload root:
  - `PRIVATE_UPLOAD_DIR`
  - default: `uploads/private`
  - current avatar and document uploads are stored here
- Temporary upload root:
  - `TEMP_UPLOAD_DIR`
  - default: `uploads/tmp`
  - prepared for future staged-processing flows
- Current private stored path prefixes:
  - documents: `local://documents/{organization_id}/{company_id}/{document_id}/{safe-file-name}`
  - avatars: `local://avatars/{organization_id}/{profile_id}/{safe-file-name}`

## Security Model
- Private files stay outside `public/`.
- Path segments and filenames are sanitized before any file is written.
- Final resolved filesystem paths are checked against the configured private upload root to block path traversal.
- Hard file-size caps can be enforced via `MAX_UPLOAD_SIZE_MB`.
- Avatar uploads validate both MIME type and extension.
- Document uploads validate:
  - file presence
  - filename/extension presence
  - MIME presence
  - plan-based file limits
  - env-based hard file-size cap
- Private files are served only through authenticated route handlers.
- Document route handlers now enforce `documents.view` and `documents.download` permissions server-side.
- Local file responses include `X-Content-Type-Options: nosniff`.

## Current URL Behavior
- Local private avatars:
  - `/api/storage/avatars/{profileId}`
- Local private documents:
  - inline view: `/api/storage/documents/{documentId}`
  - download: `/api/storage/documents/{documentId}?download=1`
- Legacy Supabase-backed file paths:
  - still resolve through short-lived signed URL redirects
  - this preserves old records during migration

## Environment Variables
- `UPLOAD_DIR`
- `PRIVATE_UPLOAD_DIR`
- `TEMP_UPLOAD_DIR`
- `PUBLIC_UPLOAD_BASE_URL`
- `MAX_UPLOAD_SIZE_MB`

## Remaining Supabase Storage Usage
- `lib/profile/profile-utils.ts`
  - legacy signed avatar URL generation for old records
- `app/api/storage/avatars/[profileId]/route.ts`
  - legacy signed redirect fallback for non-local avatar paths
- `lib/crm/document-actions.ts`
  - legacy signed document URL generation for non-local paths
- `app/api/storage/documents/[documentId]/route.ts`
  - legacy signed redirect fallback for non-local document paths

No active `getPublicUrl(...)` usage was found for runtime storage flows.

## Migration Outcome In This Prompt
- Added explicit public/private/tmp storage structure in env/config.
- Hardened local storage helper with:
  - private-root separation
  - env-based hard upload-size enforcement
  - reusable upload metadata validation
- Kept current local private serving behavior stable.
- Added explicit permission enforcement on document file access paths.
- Moved avatar metadata lookup to Prisma while keeping legacy Supabase signed-file fallback for rollback.

## Remaining Risks
- Legacy Supabase-backed file paths still require Supabase signed URLs until old objects are copied or retired.
- Document metadata is still stored/fetched through existing Supabase DB paths in some modules.
- There is no public-file feature currently using `UPLOAD_DIR`; it is prepared for future use but not active yet.
