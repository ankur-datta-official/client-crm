import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, FileText, Building2, User, MessageSquare, Calendar, CheckCircle2, XCircle, Archive, RotateCcw } from "lucide-react";
import { getHelpRequestById, getHelpRequestComments } from "@/lib/crm/help-request-queries";
import { HelpRequestDetailHeader } from "@/components/crm/help-request-detail-header";
import { HelpRequestComments } from "@/components/crm/help-request-comments";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateBD, formatDateTimeBD } from "@/lib/format/datetime";

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
    <div className="container py-6">
      <HelpRequestDetailHeader helpRequest={helpRequest} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              {helpRequest.description ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {helpRequest.description}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}
            </CardContent>
          </Card>

          {helpRequest.resolution_note && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Resolution Note
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {helpRequest.resolution_note}
                </div>
                {helpRequest.resolved_profile && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Resolved by {helpRequest.resolved_profile.full_name ?? helpRequest.resolved_profile.email} on {formatDateTimeBD(helpRequest.resolved_at ?? "")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HelpRequestComments helpRequestId={id} comments={comments} />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Help Type</span>
                <span className="font-medium capitalize">{helpRequest.help_type.replace("_", " ")}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Priority</span>
                <span className="font-medium capitalize">{helpRequest.priority}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{helpRequest.status.replace("_", " ")}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Requested By</span>
                <span className="font-medium">
                  {helpRequest.requested_profile?.full_name ?? helpRequest.requested_profile?.email ?? "Unknown"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="font-medium">
                  {helpRequest.assigned_profile?.full_name ?? helpRequest.assigned_profile?.email ?? "Unassigned"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{formatDateBD(helpRequest.created_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
