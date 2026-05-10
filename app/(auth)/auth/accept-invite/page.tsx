import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, Mail, ShieldAlert, UserPlus2 } from "lucide-react";
import { SwitchAccountButton } from "@/components/auth/switch-account-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { acceptTeamInvitation } from "@/lib/team/team-actions";
import { getInvitationPreview } from "@/lib/team/team-queries";

type AcceptInvitePageProps = {
  searchParams: Promise<{ token?: string; auth_error?: string; auth_error_description?: string }>;
};

function buildInviteAuthHref(
  path: "/auth/login" | "/auth/register",
  invitation: { email: string; organization_name: string; role_name: string | null },
  inviteToken: string,
) {
  const params = new URLSearchParams({
    next: `/auth/accept-invite?token=${inviteToken}`,
    email: invitation.email,
    mode: "invite",
    token: inviteToken,
    workspace: invitation.organization_name,
  });

  if (invitation.role_name) {
    params.set("role", invitation.role_name);
  }

  return `${path}?${params.toString()}`;
}

function buildInvitationStateMessage(status: string) {
  if (status === "accepted") {
    return "This invitation has already been accepted.";
  }

  if (status === "expired") {
    return "This invitation has expired. Ask your admin to send a fresh invitation link.";
  }

  if (status === "cancelled") {
    return "This invitation was cancelled. Ask your admin to resend it if you still need access.";
  }

  return "This invitation is no longer pending.";
}

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const { token, auth_error: authError, auth_error_description: authErrorDescription } = await searchParams;
  const inviteToken = token ?? null;

  if (!inviteToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation not found</CardTitle>
          <CardDescription>The invite link is missing its token.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const invitation = await getInvitationPreview(inviteToken);

  if (!invitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation unavailable</CardTitle>
          <CardDescription>This invite link is invalid, cancelled, or already used.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [user, profile, existingInvitee] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
    prisma.user.findUnique({
      where: {
        email: invitation.email,
      },
      select: {
        id: true,
      },
    }),
  ]);

  const loginHref = buildInviteAuthHref("/auth/login", invitation, inviteToken);
  const registerHref = buildInviteAuthHref("/auth/register", invitation, inviteToken);
  const belongsToDifferentOrg = Boolean(profile?.organization_id && profile.organization_id !== invitation.organization_id);
  const wrongInviteEmail = Boolean(
    user?.email
    && user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase(),
  );
  const isAcceptedWorkspaceMember = Boolean(
    user?.email
    && profile?.is_active
    && profile.organization_id === invitation.organization_id
    && user.email.trim().toLowerCase() === invitation.email.trim().toLowerCase(),
  );
  const acceptedToken = inviteToken;

  if (isAcceptedWorkspaceMember) {
    redirect("/dashboard");
  }

  async function handleAccept() {
    "use server";

    await acceptTeamInvitation(acceptedToken);
    redirect("/dashboard");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {invitation.organization_name}</CardTitle>
        <CardDescription>Review your invitation, then sign in or request the invited account to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Invited email:</span> {invitation.email}</p>
              <p><span className="font-medium">Workspace:</span> {invitation.organization_name}</p>
              <p><span className="font-medium">Role:</span> {invitation.role_name ?? "Assigned on accept"}</p>
              <p><span className="font-medium">Expires:</span> {new Date(invitation.expires_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {authError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {authError === "access_denied" || authError === "legacy_callback_disabled"
              ? "This invitation callback link is no longer valid. Open the invitation email again and continue from the newest secure invite link."
              : "We could not complete sign-in for this invitation."}
            {authErrorDescription ? <p className="mt-2 text-xs opacity-80">{authErrorDescription}</p> : null}
          </div>
        ) : null}

        {belongsToDifferentOrg ? (
          <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4" />
              <p>This signed-in account already belongs to another organization. Use the invited email address to continue.</p>
            </div>
            <SwitchAccountButton redirectTo={loginHref} className="w-full sm:w-auto" />
          </div>
        ) : wrongInviteEmail ? (
          <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4" />
              <p>You are signed in with a different email address. Please switch to {invitation.email} to accept this invitation.</p>
            </div>
            <SwitchAccountButton redirectTo={loginHref} className="w-full sm:w-auto" />
          </div>
        ) : invitation.status !== "pending" ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {buildInvitationStateMessage(invitation.status)}
          </div>
        ) : !user ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <div className="flex items-center gap-2 font-medium">
                {existingInvitee ? <CheckCircle2 className="h-5 w-5" /> : <UserPlus2 className="h-5 w-5" />}
                {existingInvitee
                  ? "This email already has an account"
                  : "Create the invited account first"}
              </div>
              <p className="mt-2">
                {existingInvitee
                  ? `Sign in with ${invitation.email} to review and accept the workspace invitation.`
                  : `Request an account with ${invitation.email}, complete the admin passkey step, then come back here to accept access.`}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {existingInvitee ? (
                <>
                  <Button asChild className="flex-1">
                    <Link href={loginHref}>Sign in to accept</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={registerHref}>Need a new account instead?</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild className="flex-1">
                    <Link href={registerHref}>Request account to accept</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={loginHref}>Already have an account?</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <form action={handleAccept} className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-5 w-5" />
                Ready to join the workspace
              </div>
              <p className="mt-2">
                You are signed in as {invitation.email}. Accepting this invite will connect your profile to {invitation.organization_name} and assign your invited role.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <Clock3 className="h-5 w-5" />
                Final confirmation
              </div>
              <p className="mt-2">Click accept once to join the workspace safely. This keeps the organization join action explicit and reviewable.</p>
            </div>
            <Button type="submit" className="w-full">
              Accept invitation
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
