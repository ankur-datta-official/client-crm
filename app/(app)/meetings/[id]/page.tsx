import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InteractionDetailHeader } from "@/components/crm/interaction-detail-header";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { DocumentCard } from "@/components/crm/document-card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateBD, formatDateTimeBD } from "@/lib/format/datetime";
import { getInteractionById } from "@/lib/crm/queries";
import { getDocumentsByInteraction } from "@/lib/crm/document-queries";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [interaction, documents] = await Promise.all([
    getInteractionById(id),
    getDocumentsByInteraction(id),
  ]);
  if (!interaction) notFound();
  return (
    <div className="space-y-5">
      <InteractionDetailHeader interaction={interaction} />
      <Card>
        <CardHeader><CardTitle>Interaction Details</CardTitle><CardDescription>Discussion details, sales signals, and next steps.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Info label="Company" value={interaction.companies?.name} />
          <Info label="Contact person" value={interaction.contact_persons?.name} />
          <Info label="Date/time" value={formatDateTimeBD(interaction.meeting_datetime)} />
          <Info label="Location" value={interaction.location} />
          <Info label="Online link" value={interaction.online_meeting_link} />
          <div className="rounded-md border p-3"><p className="text-xs font-medium uppercase text-muted-foreground">Rating</p><div className="mt-2"><RatingBadge rating={interaction.success_rating} /></div></div>
          <div className="rounded-md border p-3"><p className="text-xs font-medium uppercase text-muted-foreground">Temperature</p><div className="mt-2">{interaction.lead_temperature ? <LeadTemperatureBadge temperature={interaction.lead_temperature} /> : "-"}</div></div>
          <Info label="Next action" value={interaction.next_action} />
          <Info label="Next follow-up" value={interaction.next_followup_at ? formatDateTimeBD(interaction.next_followup_at) : null} />
          <Info label="Client requirement" value={interaction.client_requirement} />
          <Info label="Pain point" value={interaction.pain_point} />
          <Info label="Proposed solution" value={interaction.proposed_solution} />
          <Info label="Budget discussion" value={interaction.budget_discussion} />
          <Info label="Competitor mentioned" value={interaction.competitor_mentioned} />
          <Info label="Decision timeline" value={interaction.decision_timeline} />
          <Info label="Need help" value={interaction.need_help ? "Yes" : "No"} />
          <Info label="Created by" value={interaction.created_profile?.full_name ?? interaction.created_profile?.email} />
          <Info label="Created date" value={formatDateBD(interaction.created_at)} />
          <div className="md:col-span-2 xl:col-span-3"><Info label="Discussion details" value={interaction.discussion_details} /></div>
          <div className="md:col-span-2 xl:col-span-3"><Info label="Internal note" value={interaction.internal_note} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Related Documents</CardTitle>
            <CardDescription>Files shared or discussed during this meeting.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/need-help/new?company=${interaction.company_id}&contact=${interaction.contact_person_id}&interaction=${interaction.id}`}>
                <Plus className="w-4 h-4 mr-2" />
                Create Help Request
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/documents/new?companyId=${interaction.company_id}&contactId=${interaction.contact_person_id}&interactionId=${interaction.id}`}>
                <Plus className="w-4 h-4 mr-2" />
                Add Document
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <EmptyState
              title="No documents for this meeting"
              description="Upload files shared or discussed during this interaction."
              icon={FileText}
            />
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <DocumentCard key={doc.id} document={doc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-md border p-3"><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm">{value || "-"}</p></div>;
}
