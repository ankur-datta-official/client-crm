import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { 
  Building2, 
  User, 
  MessageSquare, 
  Calendar, 
  Clock, 
  UserPlus, 
  AlertCircle,
  FileText as FileTextIcon,
  History
} from "lucide-react";
import { getFollowupById } from "@/lib/crm/followup-queries";
import { getDocumentsByFollowup } from "@/lib/crm/document-queries";
import { FollowupDetailHeader } from "@/components/crm/followup-detail-header";
import { DocumentCard } from "@/components/crm/document-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { formatDateBD, formatDateTimeBD } from "@/lib/format/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

  return (
    <div className="container py-6">
      <FollowupDetailHeader followup={followup} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5 text-primary" />
                Description & Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {followup.description ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {followup.description}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}
            </CardContent>
          </Card>

          {(followup.completed_at || followup.rescheduled_from || followup.cancelled_reason) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Status History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Related Documents
                </CardTitle>
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href={`/need-help/new?company=${followup.company_id}&contact=${followup.contact_person_id}&followup=${followup.id}`}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Help Request
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={`/documents/new?companyId=${followup.company_id}&contactId=${followup.contact_person_id}&interactionId=${followup.interaction_id}&followupId=${followup.id}`}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Document
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <EmptyState
                  title="No documents for this follow-up"
                  description="Upload files related to this follow-up task."
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Assignment & Meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To:</span>
                <span className="font-medium">{followup.assigned_profile?.full_name ?? followup.assigned_profile?.email ?? "Unassigned"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reminder:</span>
                <span className="font-medium">{followup.reminder_before_minutes} mins before</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created By:</span>
                <span className="text-xs">{followup.created_profile?.full_name ?? followup.created_profile?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created At:</span>
                <span className="text-xs">{formatDateBD(followup.created_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
