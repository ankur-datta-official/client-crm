import { notFound } from "next/navigation";
import {
  Calendar,
  User,
  Building2,
  MessageSquare,
  Clock,
  FileText,
  Link as LinkIcon,
  Plus
} from "lucide-react";
import { getDocumentById } from "@/lib/crm/document-queries";
import { getSignedDocumentViewUrl } from "@/lib/crm/document-actions";
import { DocumentDetailHeader } from "@/components/crm/document-detail-header";
import { DocumentPreviewCard } from "@/components/crm/document-preview-card";
import { Button } from "@/components/ui/button";
import { formatDateBD } from "@/lib/format/datetime";
import Link from "next/link";
import { DetailRowList, RecordContextSidebar, RecordOverviewPanel, WorkspaceKpiCard, WorkspaceKpiGrid, WorkspaceSection } from "@/components/shared/workspace-primitives";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await getDocumentById(id);
  return {
    title: `${document?.title ?? "Document"} | CRM`,
  };
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await getDocumentById(id);

  if (!document) {
    notFound();
  }

  let signedViewUrl: string | null = null;
  try {
    const signedView = await getSignedDocumentViewUrl(document.id);
    signedViewUrl = signedView.signedUrl;
  } catch {
    signedViewUrl = null;
  }

  return (
    <div className="space-y-6">
      <DocumentDetailHeader document={document} />
      <WorkspaceKpiGrid>
        <WorkspaceKpiCard title="Document Status" value={document.status.replaceAll("_", " ")} description="Current lifecycle state for this file." icon={FileText} tone={document.status === "revision_requested" ? "amber" : document.status === "approved" ? "teal" : "blue"} />
        <WorkspaceKpiCard title="Document Type" value={document.document_type} description="Commercial file category attached to this record." icon={FileText} tone="teal" />
        <WorkspaceKpiCard title="Submitted Date" value={document.submitted_at ? formatDateBD(document.submitted_at) : "Not submitted"} description="When the file was formally sent out." icon={Calendar} tone="blue" />
        <WorkspaceKpiCard title="Expiry" value={document.expiry_date ? formatDateBD(document.expiry_date) : "No expiry"} description="Expiry tracking for time-sensitive commercial files." icon={Clock} tone={document.expiry_date ? "amber" : "slate"} />
      </WorkspaceKpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DocumentPreviewCard document={document} signedViewUrl={signedViewUrl} />

          <RecordOverviewPanel title="Document Details" description="Business meaning and internal notes around this file.">
              {document.description ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Description</h4>
                  <p className="text-sm whitespace-pre-wrap">{document.description}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}

              {document.remarks && (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Internal Remarks</h4>
                  <p className="text-sm whitespace-pre-wrap">{document.remarks}</p>
                </div>
              )}
          </RecordOverviewPanel>

          <WorkspaceSection
            title="CRM Context"
            description="Records linked to this document."
            actions={
              <Button asChild size="sm">
                <Link href={`/need-help/new?company=${document.company_id}&contact=${document.contact_person_id}&document=${document.id}`}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Help Request
                </Link>
              </Button>
            }
          >
              <div className="space-y-4">
                <ContextItem 
                  label="Company" 
                  value={document.companies?.name || "N/A"} 
                  href={`/companies/${document.company_id}`}
                  icon={<Building2 className="w-4 h-4" />}
                />
                
                {document.contact_persons && (
                  <ContextItem 
                    label="Contact Person" 
                    value={document.contact_persons.name} 
                    href={`/contacts/${document.contact_person_id}`}
                    icon={<User className="w-4 h-4" />}
                  />
                )}

                {document.interactions && (
                  <ContextItem 
                    label="Meeting / Interaction" 
                    value={`${formatDateBD(document.interactions.meeting_datetime)} - ${document.interactions.interaction_type}`} 
                    href={`/meetings/${document.interaction_id}`}
                    icon={<MessageSquare className="w-4 h-4" />}
                  />
                )}

                {document.followups && (
                  <ContextItem 
                    label="Follow-up" 
                    value={document.followups.title} 
                    href={`/followups/${document.followup_id}`}
                    icon={<Clock className="w-4 h-4" />}
                  />
                )}

                {!document.contact_person_id && !document.interaction_id && !document.followup_id && (
                  <p className="text-sm text-muted-foreground italic">No additional CRM records linked.</p>
                )}
              </div>
          </WorkspaceSection>
        </div>

        <div className="space-y-6">
          <RecordContextSidebar title="Submission Info">
            <DetailRowList
              rows={[
                { label: "Submitted To", value: document.submitted_to || "N/A" },
                { label: "Submitted Date", value: document.submitted_at ? formatDateBD(document.submitted_at) : "N/A" },
                { label: "Expiry Date", value: document.expiry_date ? formatDateBD(document.expiry_date) : "No expiry" },
              ]}
            />
          </RecordContextSidebar>

          <RecordContextSidebar title="File Properties">
            <DetailRowList
              rows={[
                { label: "File Name", value: document.file_name },
                { label: "Mime Type", value: document.mime_type || "Unknown" },
                { label: "File Extension", value: document.file_extension?.toUpperCase() || "N/A" },
                { label: "File Size", value: document.file_size_mb ? `${document.file_size_mb} MB` : "Unknown" },
              ]}
            />
          </RecordContextSidebar>
        </div>
      </div>
    </div>
  );
}

function ContextItem({ label, value, href, icon }: { label: string; value: string; href: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tight">{label}</p>
          <p className="text-sm font-medium">{value}</p>
        </div>
      </div>
      <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
        <Link href={href}>
          <ExternalLink className="w-4 h-4" />
        </Link>
      </Button>
    </div>
  );
}

function ExternalLink({ className }: { className?: string }) {
  return <LinkIcon className={className} />;
}
