import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CircleHelp, FileText, Flame, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractionDetailHeader } from "@/components/crm/interaction-detail-header";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { DocumentCard } from "@/components/crm/document-card";
import { formatDateBD, formatDateTimeBD } from "@/lib/format/datetime";
import { getInteractionById } from "@/lib/crm/queries";
import { getDocumentsByInteraction } from "@/lib/crm/document-queries";
import { getHelpRequests } from "@/lib/crm/help-request-queries";
import { CompactEmptyPanel, DetailRowList, RecordContextSidebar, RecordOverviewPanel, WorkspaceKpiCard, WorkspaceKpiGrid, WorkspaceSection } from "@/components/shared/workspace-primitives";
import { HelpRequestCard } from "@/components/crm/help-request-card";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [interaction, documents] = await Promise.all([
    getInteractionById(id),
    getDocumentsByInteraction(id),
  ]);
  if (!interaction) notFound();
  const helpRequests = await getHelpRequests({ interaction: interaction.id });
  return (
    <div className="space-y-6">
      <InteractionDetailHeader interaction={interaction} />
      <WorkspaceKpiGrid>
        <WorkspaceKpiCard title="Meeting Date" value={formatDateBD(interaction.meeting_datetime)} description={interaction.completed_at ? `Completed ${formatDateBD(interaction.completed_at)}.` : "When this discussion was logged."} icon={CalendarClock} tone={interaction.completed_at ? "teal" : "blue"} />
        <WorkspaceKpiCard title="Next Action" value={interaction.next_action ?? "Not set"} description="The concrete next move from this meeting." icon={Flame} tone={interaction.next_action ? "teal" : "amber"} />
        <WorkspaceKpiCard title="Next Follow-up" value={interaction.next_followup_at ? formatDateBD(interaction.next_followup_at) : "Not scheduled"} description="Planned follow-up time captured from the discussion." icon={CalendarClock} tone={interaction.next_followup_at ? "teal" : "rose"} />
        <WorkspaceKpiCard title="Open Help" value={String(helpRequests.filter((request) => request.status === "open" || request.status === "in_progress").length)} description="Support requests already linked to this meeting." icon={CircleHelp} tone={interaction.need_help ? "rose" : "slate"} />
      </WorkspaceKpiGrid>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <RecordOverviewPanel title="Discussion Outcome" description="Sales signals, captured context, and what should happen next.">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRowList
                rows={[
                  { label: "Company", value: interaction.companies?.name },
                  { label: "Contact Person", value: interaction.contact_persons?.name },
                  { label: "Date / Time", value: formatDateTimeBD(interaction.meeting_datetime) },
                  { label: "Location", value: interaction.location },
                  { label: "Online Link", value: interaction.online_meeting_link },
                  { label: "Next Action", value: interaction.next_action },
                  { label: "Next Follow-up", value: interaction.next_followup_at ? formatDateTimeBD(interaction.next_followup_at) : null },
                  { label: "Decision Timeline", value: interaction.decision_timeline },
                ]}
              />
              <div className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Rating</p>
                  <div className="mt-3"><RatingBadge rating={interaction.success_rating} /></div>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Temperature</p>
                  <div className="mt-3">{interaction.lead_temperature ? <LeadTemperatureBadge temperature={interaction.lead_temperature} /> : "-"}</div>
                </div>
              </div>
            </div>
          </RecordOverviewPanel>

          <RecordOverviewPanel title="Captured Discussion" description="Reference notes that should drive the next client move.">
            <DetailRowList
              rows={[
                { label: "Client Requirement", value: interaction.client_requirement },
                { label: "Pain Point", value: interaction.pain_point },
                { label: "Proposed Solution", value: interaction.proposed_solution },
                { label: "Budget Discussion", value: interaction.budget_discussion },
                { label: "Competitor Mentioned", value: interaction.competitor_mentioned },
                { label: "Discussion Details", value: interaction.discussion_details },
                { label: "Internal Note", value: interaction.internal_note },
              ]}
            />
          </RecordOverviewPanel>

          <WorkspaceSection
            title="Related Documents"
            description="Files shared or discussed during this meeting."
            actions={
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href={`/need-help/new?company=${interaction.company_id}&contact=${interaction.contact_person_id}&interaction=${interaction.id}`}>Create Help Request</Link>
                </Button>
                <Button asChild>
                  <Link href={`/documents/new?companyId=${interaction.company_id}&contactId=${interaction.contact_person_id}&interactionId=${interaction.id}`}>Add Document</Link>
                </Button>
              </div>
            }
          >
            {documents.length === 0 ? (
              <CompactEmptyPanel icon={FileText} title="No documents for this meeting" description="Upload files shared or discussed during this interaction." />
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => <DocumentCard key={doc.id} document={doc} />)}
              </div>
            )}
          </WorkspaceSection>
        </div>

        <div className="space-y-4">
          <RecordContextSidebar title="Current Context">
            <DetailRowList
              rows={[
                { label: "Need Help Flag", value: interaction.need_help ? "Yes" : "No" },
                { label: "Completed", value: interaction.completed_at ? formatDateTimeBD(interaction.completed_at) : "Not completed yet" },
                { label: "Created By", value: interaction.created_profile?.full_name ?? interaction.created_profile?.email },
                { label: "Created Date", value: formatDateBD(interaction.created_at) },
                { label: "Support Requests", value: String(helpRequests.length) },
              ]}
            />
          </RecordContextSidebar>

          <WorkspaceSection
            title="Linked Support Requests"
            description="Escalations already raised from this discussion."
          >
            {helpRequests.length === 0 ? (
              <CompactEmptyPanel icon={CircleHelp} title="No help requests linked" description="Raise support here when pricing, management, or technical help is needed." />
            ) : (
              <div className="space-y-3">
                {helpRequests.slice(0, 4).map((request) => <HelpRequestCard key={request.id} helpRequest={request} />)}
              </div>
            )}
          </WorkspaceSection>
        </div>
      </div>
    </div>
  );
}
