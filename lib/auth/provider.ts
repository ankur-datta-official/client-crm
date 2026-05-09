export type AuthProvider = "nextauth" | "betterauth";

export function getAuthProvider(): AuthProvider {
  return process.env.AUTH_PROVIDER === "nextauth" ? "nextauth" : "betterauth";
}

export function getClientAuthProvider(): AuthProvider {
  return process.env.NEXT_PUBLIC_AUTH_PROVIDER === "nextauth" ? "nextauth" : "betterauth";
}

export function isNextAuthProvider(provider: AuthProvider = getAuthProvider()) {
  return provider === "nextauth";
}

export function isBetterAuthProvider(provider: AuthProvider = getAuthProvider()) {
  return provider === "betterauth";
}
