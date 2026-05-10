"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Eye, EyeOff, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import type { AuthProvider } from "@/lib/auth/provider";

const authSchema = z.object({
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
  fullName: z.string().optional(),
});

type AuthValues = z.infer<typeof authSchema>;

type AuthFormProps = {
  mode: "login" | "register";
  provider: AuthProvider;
};

type PendingApproval = {
  email: string;
};

const ACCESS_SUPPORT_EMAIL = "support@crm.mugnee.com";
const ACCESS_SUPPORT_WHATSAPP = "+8801958645415";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getVerifiedMessage(params: {
  inviteEmail: string;
  inviteMode: boolean;
  verifiedFromQuery: boolean;
}) {
  if (!params.verifiedFromQuery) {
    return null;
  }

  return params.inviteMode
    ? `Access verified. Sign in with ${params.inviteEmail || "the invited email"} to accept the invitation.`
    : "Access verified. Please sign in to continue to workspace setup.";
}

export function AuthForm({ mode, provider }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegister = mode === "register";
  const emailFromQuery = searchParams.get("email") ?? "";
  const accessPasskeyFromQuery = searchParams.get("passkey")?.trim().toUpperCase() ?? "";
  const accessAutoFromQuery = searchParams.get("access") === "1";
  const verifiedFromQuery = searchParams.get("verified") === "1";
  const inviteMode = searchParams.get("mode") === "invite";
  const inviteEmail = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const inviteToken = searchParams.get("token") ?? "";
  const inviteWorkspace = searchParams.get("workspace") ?? "";
  const inviteRole = searchParams.get("role") ?? "";
  const nextPath = searchParams.get("next") ?? "/onboarding/workspace";
  const lockedInviteEmail = inviteMode && inviteEmail.length > 0;
  const inviteWorkspaceLabel = inviteWorkspace || "the CRM workspace";
  const inviteRoleLabel = inviteRole || "your assigned role";
  const verifiedMessage = getVerifiedMessage({
    inviteEmail,
    inviteMode,
    verifiedFromQuery,
  });

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passkey, setPasskey] = useState(accessPasskeyFromQuery);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(
    isRegister && emailFromQuery && accessPasskeyFromQuery
      ? { email: normalizeEmail(emailFromQuery) }
      : null,
  );
  const [isCompletingRegistration, setIsCompletingRegistration] = useState(false);
  const [showPasskeyStep, setShowPasskeyStep] = useState(Boolean(accessPasskeyFromQuery));
  const [showPassword, setShowPassword] = useState(false);
  const autoAccessTriggeredRef = useRef(false);

  const isPasskeyStep = isRegister && pendingApproval !== null;
  const message = statusMessage ?? verifiedMessage;

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: emailFromQuery,
      password: "",
      fullName: "",
    },
  });

  useEffect(() => {
    if (emailFromQuery) {
      form.setValue("email", emailFromQuery, {
        shouldDirty: false,
        shouldTouch: false,
      });
    }
  }, [emailFromQuery, form]);

  function buildAuthHref(path: "/auth/login" | "/auth/register") {
    const params = new URLSearchParams();

    if (nextPath) {
      params.set("next", nextPath);
    }
    if (inviteMode) {
      params.set("mode", "invite");
    }
    if (inviteToken) {
      params.set("token", inviteToken);
    }
    if (inviteWorkspace) {
      params.set("workspace", inviteWorkspace);
    }
    if (inviteRole) {
      params.set("role", inviteRole);
    }
    if (inviteEmail) {
      params.set("email", inviteEmail);
    }

    return params.size > 0 ? `${path}?${params.toString()}` : path;
  }

  async function submitAccessRequest(values: AuthValues) {
    const registerResponse = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizeEmail(values.email),
        password: values.password,
        fullName: values.fullName ?? "",
      }),
    });

    const registerPayload = await registerResponse.json().catch(() => ({}));

    if (!registerResponse.ok) {
      setError(typeof registerPayload.error === "string" ? registerPayload.error : "Could not submit your access request.");
      return false;
    }

    setPasskey("");
    setStatusMessage(
      typeof registerPayload.message === "string"
        ? registerPayload.message
        : "Your access request has been submitted. After approval, your secure registration link and fallback passkey will be sent by email.",
    );
    return true;
  }

  async function completeApprovedRegistration(options?: {
    overrideEmail?: string;
    overridePasskey?: string;
  }) {
    const registrationEmail = options?.overrideEmail ?? pendingApproval?.email ?? normalizeEmail(form.getValues("email"));
    const accessPasskey = options?.overridePasskey ?? passkey;

    if (!registrationEmail) {
      setError("Enter your request email first.");
      return;
    }

    if (!accessPasskey.trim()) {
      setError("Enter the access passkey from your approval email.");
      return;
    }

    setError(null);
    if (!options?.overridePasskey) {
      setStatusMessage(null);
    }
    setIsCompletingRegistration(true);

    try {
      const verifyResponse = await fetch("/api/auth/register", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: registrationEmail,
          passkey: accessPasskey,
        }),
      });

      const verifyPayload = await verifyResponse.json().catch(() => ({}));

      if (!verifyResponse.ok) {
        setError(typeof verifyPayload.error === "string" ? verifyPayload.error : "Could not verify your access link.");
        if (options?.overridePasskey) {
          setStatusMessage("This secure link could not complete registration automatically. Use the fallback passkey below or contact support.");
        }
        return;
      }

      const redirectQuery = new URLSearchParams({
        email: registrationEmail,
        verified: "1",
        next: nextPath,
      });

      if (inviteMode) {
        redirectQuery.set("mode", "invite");
      }
      if (inviteToken) {
        redirectQuery.set("token", inviteToken);
      }
      if (inviteWorkspace) {
        redirectQuery.set("workspace", inviteWorkspace);
      }
      if (inviteRole) {
        redirectQuery.set("role", inviteRole);
      }

      setPendingApproval(null);
      setPasskey("");
      setStatusMessage(
        inviteMode
          ? "Access verified. Redirecting you to sign in and finish accepting the invitation."
          : "Access verified. Redirecting you to sign in.",
      );
      router.replace(`/auth/login?${redirectQuery.toString()}`);
      router.refresh();
    } finally {
      setIsCompletingRegistration(false);
    }
  }

  const handleAutoAccessCompletion = useEffectEvent((email: string, accessPasskey: string) => {
    void completeApprovedRegistration({
      overrideEmail: normalizeEmail(email),
      overridePasskey: accessPasskey,
    });
  });

  useEffect(() => {
    if (
      !isRegister
      || autoAccessTriggeredRef.current
      || !accessAutoFromQuery
      || !emailFromQuery
      || !accessPasskeyFromQuery
    ) {
      return;
    }

    autoAccessTriggeredRef.current = true;
    handleAutoAccessCompletion(emailFromQuery, accessPasskeyFromQuery);
  }, [
    accessAutoFromQuery,
    accessPasskeyFromQuery,
    emailFromQuery,
    isRegister,
  ]);

  async function onSubmit(values: AuthValues) {
    setError(null);
    setStatusMessage(null);

    const submittedEmail = normalizeEmail(values.email);

    if (inviteMode && inviteEmail && submittedEmail !== inviteEmail) {
      setError(`Use ${inviteEmail} to continue with this invitation.`);
      return;
    }

    if (provider === "betterauth") {
      if (isRegister) {
        const requestSubmitted = await submitAccessRequest({
          ...values,
          email: submittedEmail,
        });

        if (requestSubmitted) {
          setPendingApproval({
            email: submittedEmail,
          });
          setShowPasskeyStep(true);
        }

        return;
      }

      const result = await authClient.signIn.email({
        email: submittedEmail,
        password: values.password,
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error.message ?? "Sign in failed."));
        return;
      }

      router.push(nextPath || "/dashboard");
      router.refresh();
      return;
    }

    if (provider === "nextauth") {
      if (isRegister) {
        const requestSubmitted = await submitAccessRequest({
          ...values,
          email: submittedEmail,
        });

        if (requestSubmitted) {
          setPendingApproval({
            email: submittedEmail,
          });
          setShowPasskeyStep(true);
        }

        return;
      }

      const result = await signIn("credentials", {
        email: submittedEmail,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      router.push(nextPath || "/dashboard");
      router.refresh();
      return;
    }

    setError("Supabase Auth sign-in is no longer supported in this branch. Use the PostgreSQL-backed auth flow instead.");
  }

  const title = inviteMode
    ? isRegister
      ? `Create your account to join ${inviteWorkspaceLabel}`
      : `Sign in to join ${inviteWorkspaceLabel}`
    : isRegister
      ? "Request CRM access"
      : "Welcome back";

  const description = inviteMode
    ? isRegister
      ? `Use ${inviteEmail || "the invited email"} to request access. After admin approval and passkey verification, you can sign in and accept the ${inviteRoleLabel} invitation.`
      : `Sign in with ${inviteEmail || "the invited email"} to review and accept your invitation.`
    : isRegister
      ? "Submit an access request first. After a super admin approves it, you will receive a secure access link and fallback passkey by email."
      : "Sign in to your CRM workspace and continue your daily pipeline flow.";

  const accentPills = inviteMode
    ? [
        "Invitation access",
        inviteRole ? `Role: ${inviteRole}` : "Workspace invite",
      ]
    : [
        "Admin-approved access",
        isRegister ? "Secure link + passkey" : "Resume instantly",
      ];

  return (
    <Card className="overflow-hidden rounded-[28px] border border-white/90 bg-white/92 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.24)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.94))] dark:shadow-[0_30px_90px_-40px_rgba(2,6,23,0.82)]">
      <div className="h-1.5 bg-[linear-gradient(90deg,#14b8a6,#0ea5e9,#22c55e)]" />
      <CardHeader className="space-y-2.5 px-5 pb-2.5 pt-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200">
              {isRegister ? <BriefcaseBusiness className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {inviteMode ? "Team invitation" : isRegister ? "Controlled signup" : "Secure sign in"}
            </div>
            <CardTitle className="text-[1.85rem] leading-tight tracking-tight text-slate-950 dark:text-slate-50">
              {title}
            </CardTitle>
            <CardDescription className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
              {description}
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#14b8a6,#0ea5e9)] text-white shadow-[0_18px_28px_-18px_rgba(14,165,233,0.75)]">
              {inviteMode ? <MailCheck className="size-5" /> : isRegister ? <KeyRound className="size-5" /> : <ShieldCheck className="size-5" />}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {accentPills.map((item) => (
            <div key={item} className="rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0 sm:px-6 sm:pb-5">
        {inviteMode ? (
          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100">
            <p className="font-medium">Invitation for {inviteWorkspaceLabel}</p>
            <p className="mt-1">This flow is reserved for {inviteEmail || "the invited email"}{inviteRole ? ` as ${inviteRole}` : ""}.</p>
          </div>
        ) : null}
        <form className="space-y-2.5" onSubmit={form.handleSubmit(onSubmit)}>
          {isRegister ? (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-semibold text-slate-800 dark:text-slate-200">Full name</Label>
              <Input
                id="fullName"
                placeholder="Amina Rahman"
                className="h-11 rounded-2xl border-slate-200 bg-white/95 px-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                disabled={isPasskeyStep}
                {...form.register("fullName")}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-slate-800 dark:text-slate-200">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              className="h-11 rounded-2xl border-slate-200 bg-white/95 px-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
              disabled={Boolean(pendingApproval)}
              readOnly={lockedInviteEmail}
              {...form.register("email")}
            />
            {lockedInviteEmail ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This invitation is locked to {inviteEmail}. Use that email to continue safely.
              </p>
            ) : null}
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-800 dark:text-slate-200">Password</Label>
                {!isRegister ? (
                  <Link className="text-xs font-medium text-primary hover:underline" href="/auth/forgot-password">
                  Forgot password?
                  </Link>
                ) : null}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  className="h-11 rounded-2xl border-slate-200 bg-white/95 px-4 pr-12 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                  disabled={isPasskeyStep}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  disabled={isPasskeyStep}
                >
                  {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </button>
              </div>
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
          {isRegister && (pendingApproval !== null || showPasskeyStep) ? (
            <div className="space-y-3 rounded-3xl border border-teal-100 bg-teal-50/70 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Complete registration with your approval email</p>
                <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {pendingApproval
                    ? <>Your access request for <span className="font-semibold">{pendingApproval.email}</span> is waiting for admin approval. Once you receive the approval email, use the secure access link or enter the fallback passkey below.</>
                    : <>Already received your approval email? Open the secure access link, or enter the fallback passkey below to finish creating the account for <span className="font-semibold">{normalizeEmail(form.getValues("email") || inviteEmail || "your email")}</span>.</>}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="passkey" className="text-sm font-semibold text-slate-800 dark:text-slate-200">Fallback access passkey</Label>
                <Input
                  id="passkey"
                  autoComplete="one-time-code"
                  placeholder="ABCD-EFGH-IJKL"
                  className="h-11 rounded-2xl border-slate-200 bg-white/95 px-4 tracking-[0.18em] shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                  value={passkey}
                  onChange={(event) => setPasskey(event.target.value.toUpperCase())}
                />
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-medium">
                {!showPasskeyStep ? (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setShowPasskeyStep(true)}
                  >
                    I already have the approval email
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-slate-600 hover:underline dark:text-slate-300"
                  onClick={() => {
                    setPendingApproval(null);
                    setPasskey("");
                    setStatusMessage(null);
                    setError(null);
                    setShowPasskeyStep(false);
                  }}
                >
                  {pendingApproval ? "Update request details" : "Clear approval mode"}
                </button>
              </div>
            </div>
          ) : null}
          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
          {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">{message}</p> : null}
          {isRegister && !showPasskeyStep && !pendingApproval ? (
            <button
              type="button"
              className="w-full text-sm font-medium text-primary hover:underline"
              onClick={() => {
                setShowPasskeyStep(true);
                setStatusMessage(null);
                setError(null);
              }}
            >
              Already received an approval email or passkey?
            </button>
          ) : null}
          {isRegister && showPasskeyStep ? (
            <Button
              className="h-11 w-full rounded-2xl bg-[linear-gradient(135deg,#0f766e,#14b8a6)] text-base font-semibold text-white shadow-[0_20px_34px_-20px_rgba(20,184,166,0.72)] hover:opacity-95"
              type="button"
              disabled={isCompletingRegistration || passkey.trim().length < 6}
              onClick={() => void completeApprovedRegistration()}
            >
              {isCompletingRegistration ? "Completing registration..." : "Verify passkey & create account"}
              <ArrowRight className="size-4.5" />
            </Button>
          ) : (
            <Button className="h-11 w-full rounded-2xl bg-[linear-gradient(135deg,#0f766e,#14b8a6)] text-base font-semibold text-white shadow-[0_20px_34px_-20px_rgba(20,184,166,0.72)] hover:opacity-95" type="submit" disabled={form.formState.isSubmitting}>
              {isRegister ? "Request access" : "Sign in"}
              <ArrowRight className="size-4.5" />
            </Button>
          )}
        </form>
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-300" />
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {inviteMode
                  ? isRegister
                    ? "After admin approval and passkey verification, sign in once and you will return to the invitation review page automatically."
                    : "After sign-in, you will be returned to the invitation review page to confirm joining the workspace."
                  : isRegister
                    ? "A super admin must approve your request and issue a one-time access email. Use the secure link from that email for the easiest completion flow, or use the fallback passkey manually."
                    : "Use your work email to continue where your leads, meetings, and next steps are already organized."}
              </p>
            </div>
          </div>
          {isRegister ? (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Need an access key faster?</p>
              <p className="mt-1 text-sm leading-6 text-amber-800/90 dark:text-amber-100/90">
                Send your correct business details and access request information to{" "}
                <a className="font-semibold underline underline-offset-4" href={`mailto:${ACCESS_SUPPORT_EMAIL}`}>
                  {ACCESS_SUPPORT_EMAIL}
                </a>{" "}
                or WhatsApp{" "}
                <a className="font-semibold underline underline-offset-4" href="https://wa.me/8801958645415" target="_blank" rel="noreferrer">
                  {ACCESS_SUPPORT_WHATSAPP}
                </a>.
              </p>
            </div>
          ) : null}
          <p className="text-center text-sm text-muted-foreground dark:text-slate-400">
            {isRegister ? "Already have an account?" : "New to the CRM?"}{" "}
            <Link className="font-medium text-primary hover:underline" href={isRegister ? buildAuthHref("/auth/login") : buildAuthHref("/auth/register")}>
              {isRegister ? "Sign in" : "Create account"}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
