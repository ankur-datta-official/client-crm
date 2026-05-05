import { redirect } from "next/navigation";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { acceptTeamInvitation } from "@/lib/team/team-actions";
import { getInvitationPreview } from "@/lib/team/team-queries";

type AcceptInvitePageProps = {
  searchParams: Promise<{ token?: string; auth_error?: string; auth_error_description?: string }>;
};

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

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/auth/accept-invite?token=${inviteToken}`)}`);
  }

  const profile = await getCurrentProfile();
  const belongsToDifferentOrg = profile?.organization_id && profile.organization_id !== invitation.organization_id;
  const wrongInviteEmail = !belongsToDifferentOrg && Boolean(user.email) && user.email!.trim().toLowerCase() !== invitation.email.trim().toLowerCase();
  const acceptedToken: string = inviteToken;

  async function handleAccept() {
    "use server";

    await acceptTeamInvitation(acceptedToken);
    redirect("/dashboard");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept Team Invitation</CardTitle>
        <CardDescription>Join {invitation.organization_name} and get your assigned CRM access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Email:</span> {invitation.email}</p>
              <p><span className="font-medium">Role:</span> {invitation.role_name ?? "Assigned on accept"}</p>
              <p><span className="font-medium">Expires:</span> {new Date(invitation.expires_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {belongsToDifferentOrg ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            This account already belongs to another organization. Use a different account to accept this invitation.
          </div>
        ) : authError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {authError === "access_denied"
              ? "This email sign-in link is no longer valid. Ask your admin to resend the invitation, then open the newest email."
              : "We could not complete email sign-in for this invitation."}
            {authErrorDescription ? <p className="mt-2 text-xs opacity-80">{authErrorDescription}</p> : null}
          </div>
        ) : wrongInviteEmail ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            You are signed in with a different email address. Please use {invitation.email} to accept this invitation.
          </div>
        ) : invitation.status !== "pending" ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            This invitation is no longer pending.
          </div>
        ) : (
          <form action={handleAccept} className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-5 w-5" />
                Ready to join the workspace
              </div>
              <p className="mt-2">
                Accepting this invite will connect your profile to {invitation.organization_name} and assign your invited role.
              </p>
            </div>
            <Button type="submit" className="w-full">
              Accept Invitation
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
