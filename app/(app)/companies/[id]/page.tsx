import { notFound } from "next/navigation";
import { CompanyProfileHeader } from "@/components/crm/company-profile-header";
import { CompanyDetailWorkspace } from "@/components/crm/company-detail-workspace";
import { getCompanyById, getContactsByCompany, getInteractionsByCompany } from "@/lib/crm/queries";
import { getFollowupsByCompany } from "@/lib/crm/followup-queries";
import { getDocumentsByCompany } from "@/lib/crm/document-queries";
import { getHelpRequestsByCompany } from "@/lib/crm/help-request-queries";
import { getCompanyScoringHistory } from "@/lib/scoring/queries";
import type { Company, ContactPerson, Document, Followup, HelpRequest, Interaction } from "@/lib/crm/types";
import type { ScoringActivityLog } from "@/lib/scoring/types";

export default async function CompanyProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [company, contacts, interactions, followups, documents, helpRequests, scoringHistory]: [
    Company | null,
    ContactPerson[],
    Interaction[],
    Followup[],
    Document[],
    HelpRequest[],
    ScoringActivityLog[],
  ] = await Promise.all([
    getCompanyById(id),
    getContactsByCompany(id),
    getInteractionsByCompany(id),
    getFollowupsByCompany(id),
    getDocumentsByCompany(id),
    getHelpRequestsByCompany(id),
    getCompanyScoringHistory(id, 20),
  ]);

  if (!company) {
    notFound();
  }

  const lastInteraction = interactions[0] ?? null;
  const pendingFollowups = followups.filter((followup) => followup.status === "pending");
  const now = getCurrentTimestamp();
  const overdueFollowupCount = pendingFollowups.filter((followup) => new Date(followup.scheduled_at).getTime() < now).length;
  const nextFollowup =
    pendingFollowups.find((followup) => new Date(followup.scheduled_at).getTime() >= now) ??
    pendingFollowups[0] ??
    null;
  const openHelpCount = helpRequests.filter((request) => request.status === "open" || request.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <CompanyProfileHeader
        company={company}
        nextFollowupAt={nextFollowup?.scheduled_at}
        lastInteractionAt={lastInteraction?.meeting_datetime}
        overdueFollowupCount={overdueFollowupCount}
        openHelpCount={openHelpCount}
      />
      <CompanyDetailWorkspace
        company={company}
        contacts={contacts}
        interactions={interactions}
        followups={followups}
        documents={documents}
        helpRequests={helpRequests}
        scoringHistory={scoringHistory}
        nextFollowup={nextFollowup}
        overdueFollowupCount={overdueFollowupCount}
        lastInteraction={lastInteraction}
        openHelpCount={openHelpCount}
      />
    </div>
  );
}

function getCurrentTimestamp() {
  return Date.now();
}
