const FIXED_SUPER_ADMIN_EMAIL = "ankur.mugnee@gmail.com";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function getFixedSuperAdminEmail() {
  return FIXED_SUPER_ADMIN_EMAIL;
}

export function isFixedSuperAdminEmail(email: string | null | undefined) {
  return normalizeEmail(email) === FIXED_SUPER_ADMIN_EMAIL;
}

export function resolveSuperAdminAccess(input: {
  email: string | null | undefined;
  isSuperAdmin: boolean;
}) {
  return input.isSuperAdmin || isFixedSuperAdminEmail(input.email);
}
