import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CircleHelp, FileText, Plus, UserRound } from "lucide-react";
import { 
  Building2, 
  User, 
  MessageSquare, 
  Calendar, 
  Clock, 
  AlertCircle,
  FileText as FileTextIcon,
  History
} from "lucide-react";
import { getFollowupById } from "@/lib/crm/followup-queries";
import { getDocumentsByFollowup } from "@/lib/crm/document-queries";
import { getHelpRequests } from "@/lib/crm/help-request-queries";
import { FollowupDetailHeader } from "@/components/crm/followup-detail-header";
import { DocumentCard } from "@/components/crm/document-card";
import { HelpRequestCard } from "@/components/crm/help-request-card";
import { Button } from "@/components/ui/button";
import { formatDateBD, formatDateTimeBD } from "@/lib/format/datetime";
import { Separator } from "@/components/ui/separator";
import { CompactEmptyPanel, DetailRowList, RecordContextSidebar, RecordOverviewPanel, WorkspaceKpiCard, WorkspaceKpiGrid, WorkspaceSection } from "@/components/shared/workspace-primitives";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const followup = await getFollowupById(id);
  return {
    title: followup ? `${followup.title} | Follow-up` : "Follow-up Details",
  };
}

export default async function FollowupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [followup, documents] = await Promise.all([
    getFollowupById(id),
    getDocumentsByFollowup(id),
  ]);

  if (!followup) {
    notFound();
  }

  const helpRequests = await getHelpRequests({ followup: followup.id });

  return (
    <div className="space-y-6">
      <FollowupDetailHeader followup={followup} />
      <WorkspaceKpiGrid>
        <WorkspaceKpiCard title="Scheduled At" value={formatDateBD(followup.scheduled_at)} description="When this action is due to happen." icon={CalendarClock} tone="blue" />
        <WorkspaceKpiCard title="Status" value={followup.status} description="Current follow-up execution state." icon={History} tone={followup.status === "pending" ? "amber" : followup.status === "completed" ? "teal" : "slate"} />
        <WorkspaceKpiCard title="Assigned To" value={followup.assigned_profile?.full_name ?? followup.assigned_profile?.email ?? "Unassigned"} description="Current owner of this action item." icon={UserRound} tone="teal" />
        <WorkspaceKpiCard title="Support Requests" value={String(helpRequests.length)} description="Help requests linked to this follow-up." icon={CircleHelp} tone={helpRequests.length > 0 ? "rose" : "slate"} />
      </WorkspaceKpiGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RecordOverviewPanel title="Description & Notes" description="Execution notes and what this follow-up is meant to achieve.">
            <div className="flex items-center gap-2 pb-4">
                <FileTextIcon className="h-5 w-5 text-primary" />
            </div>
              {followup.description ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {followup.description}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}
          </RecordOverviewPanel>

          {(followup.completed_at || followup.rescheduled_from || followup.cancelled_reason) && (
            <RecordOverviewPanel title="Status History" description="Track how this follow-up changed over time.">
              <div className="space-y-4">
                {followup.completed_at && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-emerald-100 p-1 text-emerald-600">
                      <Clock className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-900">Completed</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTimeBD(followup.completed_at)}
                      </p>
                    </div>
                  </div>
                )}
                {followup.rescheduled_from && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-amber-100 p-1 text-amber-600">
                      <Calendar className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-900">Rescheduled from</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTimeBD(followup.rescheduled_from)}
                      </p>
                    </div>
                  </div>
                )}
                {followup.cancelled_reason && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-rose-100 p-1 text-rose-600">
                      <AlertCircle className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-rose-900">Cancelled Reason</p>
                      <p className="text-xs text-muted-foreground">{followup.cancelled_reason}</p>
                    </div>
                  </div>
                )}
              </div>
            </RecordOverviewPanel>
          )}

          <WorkspaceSection
            title="Related Documents"
            description="Files attached to this follow-up action."
            actions={
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href={`/need-help/new?company=${followup.company_id}&contact=${followup.contact_person_id}&followup=${followup.id}`}>Create Help Request</Link>
                </Button>
                <Button asChild>
                  <Link href={`/documents/new?companyId=${followup.company_id}&contactId=${followup.contact_person_id}&interactionId=${followup.interaction_id}&followupId=${followup.id}`}>Add Document</Link>
                </Button>
              </div>
            }
          >
              {documents.length === 0 ? (
                <CompactEmptyPanel icon={FileText} title="No documents for this follow-up" description="Upload files related to this follow-up task." />
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <DocumentCard key={doc.id} document={doc} />
                  ))}
                </div>
              )}
          </WorkspaceSection>
        </div>

        <div className="space-y-6">
          <RecordContextSidebar title="Context">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Company</p>
                    <Link 
                      href={`/companies/${followup.company_id}`}
                      className="text-sm font-medium hover:text-primary hover:underline"
                    >
                      {followup.companies?.name}
                    </Link>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Contact Person</p>
                    {followup.contact_persons ? (
                      <Link 
                        href={`/contacts/${followup.contact_person_id}`}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {followup.contact_persons.name}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">None</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Related Meeting</p>
                    {followup.interactions ? (
                      <Link 
                        href={`/meetings/${followup.interaction_id}`}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {followup.interactions.interaction_type} - {formatDateBD(followup.interactions.meeting_datetime)}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">None</p>
                    )}
                  </div>
                </div>
              </div>
          </RecordContextSidebar>

          <RecordContextSidebar title="Assignment & Meta">
            <DetailRowList
              rows={[
                { label: "Assigned To", value: followup.assigned_profile?.full_name ?? followup.assigned_profile?.email ?? "Unassigned" },
                { label: "Reminder", value: `${followup.reminder_before_minutes} mins before` },
                { label: "Created By", value: followup.created_profile?.full_name ?? followup.created_profile?.email },
                { label: "Created At", value: formatDateBD(followup.created_at) },
              ]}
            />
          </RecordContextSidebar>

          <WorkspaceSection title="Linked Support Requests" description="Escalations raised from this follow-up.">
            {helpRequests.length === 0 ? (
              <CompactEmptyPanel icon={CircleHelp} title="No help requests linked" description="Raise support here when this follow-up needs pricing, management, or technical help." />
            ) : (
              <div className="space-y-3">
                {helpRequests.slice(0, 3).map((request) => <HelpRequestCard key={request.id} helpRequest={request} />)}
              </div>
            )}
          </WorkspaceSection>
        </div>
      </div>
    </div>
  );
}
