import { redirect } from "next/navigation";
import { WorkspaceForm } from "@/components/onboarding/workspace-form";
import { getCurrentOrganization, requireAuth } from "@/lib/auth/session";

export default async function WorkspaceOnboardingPage() {
  await requireAuth();
  const organization = await getCurrentOrganization();

  if (organization) {
    redirect("/dashboard");
  }

  return <WorkspaceForm />;
}
