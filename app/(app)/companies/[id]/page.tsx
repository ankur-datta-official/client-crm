import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, FileText, Handshake, LifeBuoy, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyProfileHeader } from "@/components/crm/company-profile-header";
import { ScoringActivityPanel } from "@/components/scoring/scoring-ui";
import { ContactProfileCard } from "@/components/crm/contact-profile-card";
import { InteractionTimelineCard } from "@/components/crm/interaction-timeline-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { getCompanyById, getContactsByCompany, getInteractionsByCompany } from "@/lib/crm/queries";
import { getFollowupsByCompany } from "@/lib/crm/followup-queries";
import { getDocumentsByCompany } from "@/lib/crm/document-queries";
import { getHelpRequestsByCompany } from "@/lib/crm/help-request-queries";
import { formatCurrency } from "@/lib/crm/utils";
import { FollowupCard } from "@/components/crm/followup-card";
import { DocumentCard } from "@/components/crm/document-card";
import { HelpRequestCard } from "@/components/crm/help-request-card";
import { DocumentTypeBadge, DocumentStatusBadge } from "@/components/crm/document-badges";
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

  return (
    <div className="space-y-5">
      <CompanyProfileHeader company={company} />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Estimated Value" value={formatCurrency(company.estimated_value)} iconName="building" tone="teal" />
        <StatCard title="Success Rating" value={company.success_rating ? `${company.success_rating}/10` : "Not rated"} iconName="notebook" tone="amber" />
        <StatCard title="Lead Temperature" value={company.lead_temperature} iconName="handshake" tone={company.lead_temperature === "hot" ? "rose" : "blue"} />
        <StatCard title="Lead Score" value={String(company.lead_score)} iconName="handshake" tone="amber" />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>Core company profile information, ownership, and relationship details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Info label="Email" value={company.email} />
          <Info label="Phone" value={company.phone} />
          <Info label="WhatsApp" value={company.whatsapp} />
          <Info label="Website" value={company.website} />
          <Info label="Address" value={[company.address, company.city, company.country].filter(Boolean).join(", ")} />
          <Info label="Lead source" value={company.lead_source} />
          <Info label="Priority" value={company.priority} />
          <Info label="Expected closing date" value={company.expected_closing_date} />
          <Info
            label="Primary contact"
            value={company.primary_contact ? `${company.primary_contact.name}${company.primary_contact.mobile ? ` - ${company.primary_contact.mobile}` : ""}` : null}
          />
          <div className="md:col-span-2">
            <Info label="Notes" value={company.notes} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>Decision makers and communication points for this company.</CardDescription>
          </div>
          <Button asChild>
            <Link href={`/contacts/new?companyId=${company.id}`}>Add Contact</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <EmptyState
              title="No contact persons added yet"
              description="Add decision makers and communication points for this company."
              icon={Users}
            />
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => <ContactProfileCard key={contact.id} contact={contact} />)}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Meetings</CardTitle>
            <CardDescription>Calls, meetings, demos, and sales interaction history.</CardDescription>
          </div>
          <Button asChild><Link href={`/meetings/new?companyId=${company.id}`}>Add Meeting</Link></Button>
        </CardHeader>
        <CardContent>
          {interactions.length === 0 ? (
            <EmptyState title="No meeting history yet" description="Add your first client interaction to start tracking progress." icon={CalendarClock} />
          ) : (
            <div className="space-y-3">{interactions.map((interaction) => <InteractionTimelineCard key={interaction.id} interaction={interaction} />)}</div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Follow-ups</CardTitle>
            <CardDescription>Scheduled actions and reminders for this client.</CardDescription>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/followups/new?company=${company.id}`}>Add Follow-up</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {followups.length === 0 ? (
            <EmptyState 
              title="No follow-ups scheduled yet" 
              description="Create the next action to keep this client moving." 
              icon={Handshake} 
            />
          ) : (
            <div className="space-y-3">
              {followups.map((followup) => (
                <FollowupCard key={followup.id} followup={followup} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Quotations, proposals, brochures, and agreements for this company.</CardDescription>
          </div>
          <Button asChild>
            <Link href={`/documents/new?companyId=${company.id}`}>
              <Plus className="w-4 h-4 mr-2" />
              Add Document
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <EmptyState
              title="No documents submitted yet"
              description="Upload quotations, proposals, brochures, or agreements for this company."
              icon={FileText}
            />
          ) : (
            <div className="space-y-3">
              {documents.slice(0, 5).map((doc) => (
                <DocumentCard key={doc.id} document={doc} />
              ))}
              {documents.length > 5 && (
                <div className="pt-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/documents?company=${company.id}`}>
                      View all {documents.length} documents
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Need Help / Escalations</CardTitle>
            <CardDescription>Support requests and blocked deal escalations for this company.</CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href={`/need-help/new?company=${company.id}`}>
              <Plus className="w-4 h-4 mr-2" />
              Request Help
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {helpRequests.length === 0 ? (
            <EmptyState
              title="No help requests yet"
              description="Surface blocked deals or request manager support for this company."
              icon={LifeBuoy}
            />
          ) : (
            <div className="space-y-3">
              {helpRequests.map((request) => (
                <HelpRequestCard key={request.id} helpRequest={request} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ScoringActivityPanel
        activities={scoringHistory}
        title="Lead Scoring History"
        description="See which actions on this lead awarded points and how the score has changed."
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || "-"}</p>
    </div>
  );
}
