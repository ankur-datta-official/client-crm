import { redirect } from "next/navigation";
import { WorkspaceForm } from "@/components/onboarding/workspace-form";
import { getCurrentOrganization, requireActiveProfile } from "@/lib/auth/session";

export default async function WorkspaceOnboardingPage() {
  await requireActiveProfile();
  const organization = await getCurrentOrganization();

  if (organization) {
    redirect("/dashboard");
  }

  return <WorkspaceForm />;
}
