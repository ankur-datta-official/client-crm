import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseEnv } from "@/lib/env";

const inviteEmailEnvSchema = z.object({
  serviceRoleKey: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required for invite email delivery."),
});

type SendTeamInviteEmailInput = {
  email: string;
  token: string;
  fullName?: string | null;
};

export type InviteEmailDelivery =
  | { ok: true; method: "invite" | "magic_link" }
  | { ok: false; reason: string };

function getInviteEmailEnv() {
  const parsed = inviteEmailEnvSchema.safeParse({
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(" "));
  }

  return parsed.data;
}

function buildInviteRedirectUrl(token: string) {
  const env = getSupabaseEnv();
  const callbackUrl = new URL("/auth/callback", env.appUrl);
  callbackUrl.searchParams.set("invite_token", token);
  return callbackUrl.toString();
}

function createInviteAdminClient() {
  const env = getSupabaseEnv();
  const inviteEnv = getInviteEmailEnv();

  return createSupabaseClient(env.supabaseUrl, inviteEnv.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createStatelessAuthClient() {
  const env = getSupabaseEnv();

  return createSupabaseClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function isExistingUserInviteError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("already been registered")
    || normalized.includes("already registered")
    || normalized.includes("user already exists")
    || normalized.includes("email exists")
  );
}

export async function sendTeamInviteEmail(input: SendTeamInviteEmailInput): Promise<InviteEmailDelivery> {
  const redirectTo = buildInviteRedirectUrl(input.token);
  const adminClient = createInviteAdminClient();

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(input.email, {
    redirectTo,
    data: input.fullName?.trim() ? { full_name: input.fullName.trim() } : undefined,
  });

  if (!inviteError) {
    return { ok: true, method: "invite" };
  }

  if (!isExistingUserInviteError(inviteError.message)) {
    return { ok: false, reason: inviteError.message };
  }

  const authClient = createStatelessAuthClient();
  const { error: magicLinkError } = await authClient.auth.signInWithOtp({
    email: input.email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  });

  if (magicLinkError) {
    return { ok: false, reason: magicLinkError.message };
  }

  return { ok: true, method: "magic_link" };
}
