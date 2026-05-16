import { Suspense } from "react";
import { getFollowupFormOptions } from "@/lib/crm/queries";
import { PageHeader } from "@/components/shared/page-header";
import { FollowupForm } from "@/components/crm/followup-form";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

export const metadata = {
  title: "New Follow-up | SaaS CRM",
  description: "Create a new follow-up reminder.",
};

export default async function NewFollowupPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; contact?: string; interaction?: string }>;
}) {
  const params = await searchParams;

  return (
    <div>
      <PageHeader
        title="Create Follow-up"
        description="Capture the next client action now, then add reminders or related CRM context only if needed."
      />
      <Suspense fallback={<LoadingSkeleton />}>
        <FollowupFormLoader
          defaultCompanyId={params.company}
          defaultContactId={params.contact}
          defaultInteractionId={params.interaction}
        />
      </Suspense>
    </div>
  );
}

async function FollowupFormLoader({
  defaultCompanyId,
  defaultContactId,
  defaultInteractionId,
}: {
  defaultCompanyId?: string;
  defaultContactId?: string;
  defaultInteractionId?: string;
}) {
  const { companies, contacts, interactions, teamMembers } = await getFollowupFormOptions();

  return (
    <FollowupForm
      companies={companies}
      contacts={contacts}
      interactions={interactions}
      teamMembers={teamMembers}
      defaultCompanyId={defaultCompanyId}
      defaultContactId={defaultContactId}
      defaultInteractionId={defaultInteractionId}
    />
  );
}
