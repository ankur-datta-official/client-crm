import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, Calendar, CheckCircle2, CircleHelp, FileText, MessageSquare, User } from "lucide-react";
import { getHelpRequestById, getHelpRequestComments } from "@/lib/crm/help-request-queries";
import { HelpRequestDetailHeader } from "@/components/crm/help-request-detail-header";
import { HelpRequestComments } from "@/components/crm/help-request-comments";
import { Separator } from "@/components/ui/separator";
import { formatDateBD, formatDateTimeBD } from "@/lib/format/datetime";
import { DetailRowList, RecordContextSidebar, RecordOverviewPanel, WorkspaceKpiCard, WorkspaceKpiGrid, WorkspaceSection } from "@/components/shared/workspace-primitives";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const helpRequest = await getHelpRequestById(id);
  return {
    title: helpRequest ? `${helpRequest.title} | Help Request` : "Help Request Details",
  };
}

export default async function HelpRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [helpRequest, comments] = await Promise.all([
    getHelpRequestById(id),
    getHelpRequestComments(id),
  ]);

  if (!helpRequest) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <HelpRequestDetailHeader helpRequest={helpRequest} />
      <WorkspaceKpiGrid>
        <WorkspaceKpiCard title="Status" value={helpRequest.status.replaceAll("_", " ")} description="Current lifecycle state of this request." icon={CircleHelp} tone={helpRequest.status === "open" || helpRequest.status === "in_progress" ? "rose" : "teal"} />
        <WorkspaceKpiCard title="Priority" value={helpRequest.priority} description="Urgency level set for this blocker." icon={CheckCircle2} tone={helpRequest.priority === "urgent" || helpRequest.priority === "high" ? "amber" : "slate"} />
        <WorkspaceKpiCard title="Assigned To" value={helpRequest.assigned_profile?.full_name ?? helpRequest.assigned_profile?.email ?? "Unassigned"} description="Current owner responsible for follow-through." icon={User} tone="blue" />
        <WorkspaceKpiCard title="Comments" value={String(comments.length)} description="Conversation updates already attached to this request." icon={MessageSquare} tone="teal" />
      </WorkspaceKpiGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RecordOverviewPanel title="Description" description="Why this deal is blocked and what support is needed.">
              {helpRequest.description ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {helpRequest.description}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}
          </RecordOverviewPanel>

          {helpRequest.resolution_note && (
            <RecordOverviewPanel title="Resolution Note" description="Final resolution captured for this support request.">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {helpRequest.resolution_note}
                </div>
                {helpRequest.resolved_profile && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Resolved by {helpRequest.resolved_profile.full_name ?? helpRequest.resolved_profile.email} on {formatDateTimeBD(helpRequest.resolved_at ?? "")}
                  </p>
                )}
            </RecordOverviewPanel>
          )}

          <WorkspaceSection title={`Comments (${comments.length})`} description="Conversation trail and updates around this escalation.">
              <HelpRequestComments helpRequestId={id} comments={comments} />
          </WorkspaceSection>
        </div>

        <div className="space-y-6">
          <RecordContextSidebar title="Context">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Company</p>
                    {helpRequest.companies ? (
                      <Link 
                        href={`/companies/${helpRequest.company_id}`}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {helpRequest.companies.name}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">None</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Contact Person</p>
                    {helpRequest.contact_persons ? (
                      <Link 
                        href={`/contacts/${helpRequest.contact_person_id}`}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {helpRequest.contact_persons.name}
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
                    {helpRequest.interactions ? (
                      <Link 
                        href={`/meetings/${helpRequest.interaction_id}`}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {helpRequest.interactions.interaction_type} - {formatDateBD(helpRequest.interactions.meeting_datetime)}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">None</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Related Follow-up</p>
                    {helpRequest.followups ? (
                      <Link 
                        href={`/followups/${helpRequest.followup_id}`}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {helpRequest.followups.title}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">None</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Related Document</p>
                    {helpRequest.documents ? (
                      <Link 
                        href={`/documents/${helpRequest.document_id}`}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {helpRequest.documents.title}
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">None</p>
                    )}
                  </div>
                </div>
              </div>
          </RecordContextSidebar>

          <RecordContextSidebar title="Request Details">
            <DetailRowList
              rows={[
                { label: "Help Type", value: helpRequest.help_type.replace("_", " ") },
                { label: "Priority", value: helpRequest.priority },
                { label: "Status", value: helpRequest.status.replace("_", " ") },
                { label: "Requested By", value: helpRequest.requested_profile?.full_name ?? helpRequest.requested_profile?.email ?? "Unknown" },
                { label: "Assigned To", value: helpRequest.assigned_profile?.full_name ?? helpRequest.assigned_profile?.email ?? "Unassigned" },
                { label: "Created", value: formatDateBD(helpRequest.created_at) },
              ]}
            />
          </RecordContextSidebar>
        </div>
      </div>
    </div>
  );
}
