import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, FileText, Handshake, LifeBuoy, Mail, Plus, Users } from "lucide-react";
import { ContactProfileCard } from "@/components/crm/contact-profile-card";
import { DocumentCard } from "@/components/crm/document-card";
import { FollowupCard } from "@/components/crm/followup-card";
import { HelpRequestCard } from "@/components/crm/help-request-card";
import { InteractionTimelineCard } from "@/components/crm/interaction-timeline-card";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { ScoringActivityPanel } from "@/components/scoring/scoring-ui";
import { ActionInfoCard } from "@/components/shared/action-info-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/crm/utils";
import { formatDateBD, formatDateTimeBD } from "@/lib/format/datetime";
import type { Company, ContactPerson, Document, Followup, HelpRequest, Interaction } from "@/lib/crm/types";
import type { ScoringActivityLog } from "@/lib/scoring/types";

type CompanyDetailWorkspaceProps = {
  company: Company;
  contacts: ContactPerson[];
  interactions: Interaction[];
  followups: Followup[];
  documents: Document[];
  helpRequests: HelpRequest[];
  scoringHistory: ScoringActivityLog[];
  nextFollowup: Followup | null;
  overdueFollowupCount: number;
  lastInteraction: Interaction | null;
  openHelpCount: number;
};

export function CompanyDetailWorkspace({
  company,
  contacts,
  interactions,
  followups,
  documents,
  helpRequests,
  scoringHistory,
  nextFollowup,
  overdueFollowupCount,
  lastInteraction,
  openHelpCount,
}: CompanyDetailWorkspaceProps) {
  const recentDocuments = documents.slice(0, 4);
  const recentInteractions = interactions.slice(0, 4);
  const recentFollowups = followups.slice(0, 4);
  const recentContacts = contacts.slice(0, 3);
  const recentHelpRequests = helpRequests.slice(0, 3);
  const latestDocument = documents[0] ?? null;
  const nextActionSummary = nextFollowup
    ? `${nextFollowup.title} on ${formatDateTimeBD(nextFollowup.scheduled_at)}`
    : overdueFollowupCount > 0
      ? `${overdueFollowupCount} overdue action${overdueFollowupCount > 1 ? "s" : ""}`
      : "No next action scheduled";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Estimated Value"
          value={formatCurrency(company.estimated_value)}
          description={company.pipeline_stages?.name ?? "Pipeline stage pending"}
          iconName="building"
          tone="teal"
        />
        <StatCard
          title="Lead Score"
          value={`${company.lead_score}`}
          description={company.lead_temperature === "very_hot" ? "Very hot lead" : `${company.lead_temperature} lead`}
          iconName="handshake"
          tone={company.lead_temperature === "hot" || company.lead_temperature === "very_hot" ? "rose" : "amber"}
        />
        <StatCard
          title="Last Interaction"
          value={lastInteraction ? formatDateBD(lastInteraction.meeting_datetime) : "No history yet"}
          description={lastInteraction?.interaction_type ?? "No meetings logged"}
          iconName="notebook"
          tone="blue"
        />
        <StatCard
          title="Next Action"
          value={overdueFollowupCount > 0 ? `${overdueFollowupCount} overdue` : nextFollowup ? formatDateBD(nextFollowup.scheduled_at) : "Not scheduled"}
          description={nextActionSummary}
          iconName="handshake"
          tone={overdueFollowupCount > 0 ? "rose" : "teal"}
        />
      </section>

      <Card className="border-slate-200/80">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>What Needs Attention</CardTitle>
            <CardDescription>Keep the next sales move clear without scrolling through the full record.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {overdueFollowupCount > 0 ? <Badge variant="destructive">{overdueFollowupCount} overdue follow-up{overdueFollowupCount > 1 ? "s" : ""}</Badge> : null}
            {openHelpCount > 0 ? <Badge variant="warning">{openHelpCount} open escalation{openHelpCount > 1 ? "s" : ""}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AttentionCard
            title="Next Follow-up"
            value={nextFollowup ? nextFollowup.title : "No follow-up scheduled"}
            meta={nextFollowup ? formatDateTimeBD(nextFollowup.scheduled_at) : "Create the next action to keep momentum"}
            icon={Handshake}
            tone={nextFollowup ? "default" : "muted"}
          />
          <AttentionCard
            title="Last Meeting"
            value={lastInteraction ? lastInteraction.interaction_type : "No meeting history yet"}
            meta={lastInteraction ? formatDateTimeBD(lastInteraction.meeting_datetime) : "Log the first client interaction"}
            icon={CalendarClock}
            tone={lastInteraction ? "default" : "muted"}
          />
          <AttentionCard
            title="Open Escalations"
            value={openHelpCount > 0 ? `${openHelpCount} active` : "No blockers"}
            meta={openHelpCount > 0 ? "Manager or support attention is pending" : "Deal is moving without help requests"}
            icon={LifeBuoy}
            tone={openHelpCount > 0 ? "warning" : "default"}
          />
          <AttentionCard
            title="Latest Document"
            value={latestDocument?.title ?? "No document uploaded"}
            meta={latestDocument ? latestDocument.document_type : "Upload proposal, quotation, or agreement"}
            icon={FileText}
            tone={latestDocument ? "default" : "muted"}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-500">
            <TabsTrigger value="overview" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="contacts" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              Contacts
              <TabCount count={contacts.length} />
            </TabsTrigger>
            <TabsTrigger value="meetings" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              Meetings
              <TabCount count={interactions.length} />
            </TabsTrigger>
            <TabsTrigger value="followups" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              Follow-ups
              <TabCount count={followups.length} />
            </TabsTrigger>
            <TabsTrigger value="documents" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              Documents
              <TabCount count={documents.length} />
            </TabsTrigger>
            <TabsTrigger value="escalations" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              Escalations
              <TabCount count={helpRequests.length} />
            </TabsTrigger>
            <TabsTrigger value="scoring" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              Scoring
              <TabCount count={scoringHistory.length} />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Company Identity</CardTitle>
                  <CardDescription>Core profile, pipeline placement, and business context.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <OverviewRows
                    rows={[
                      ["Industry", company.industries?.name],
                      ["Category", company.company_categories?.name],
                      ["Pipeline Stage", company.pipeline_stages?.name],
                      ["Lead Source", company.lead_source],
                      ["Website", company.website],
                      ["Address", [company.address, company.city, company.country].filter(Boolean).join(", ")],
                    ]}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Channels & Reach</CardTitle>
                  <CardDescription>Quick access to the company communication channels and main contact.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <ActionInfoCard
                    title="Email"
                    items={(company.email_addresses?.length ? company.email_addresses : company.email ? [company.email] : []).map((email) => ({
                      label: email,
                      href: `mailto:${email}`,
                    }))}
                  />
                  <ActionInfoCard
                    title="Phone"
                    items={(company.phone_numbers?.length ? company.phone_numbers : company.phone ? [company.phone] : []).map((phone) => ({
                      label: phone,
                      href: `tel:${phone}`,
                    }))}
                  />
                  <ActionInfoCard
                    title="WhatsApp"
                    items={(company.whatsapp ? [company.whatsapp] : []).map((value) => ({
                      label: value,
                      href: `https://wa.me/${value.replace(/\D/g, "")}`,
                    }))}
                  />
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Primary Contact</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-slate-900">{company.primary_contact?.name ?? "-"}</p>
                      <p className="text-sm text-slate-500">{company.primary_contact?.designation ?? "No role assigned yet"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Deal Pulse</CardTitle>
                  <CardDescription>Ownership, urgency, confidence, and close planning in one place.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <LeadTemperatureBadge temperature={company.lead_temperature} />
                    <RatingBadge rating={company.success_rating} />
                    <Badge variant="warning">Priority: {company.priority}</Badge>
                  </div>
                  <OverviewRows
                    rows={[
                      ["Assigned Owner", company.assigned_profile?.full_name ?? company.assigned_profile?.email],
                      ["Expected Closing Date", company.expected_closing_date ? formatDateBD(company.expected_closing_date) : null],
                      ["Estimated Value", formatCurrency(company.estimated_value)],
                      ["Open Escalations", String(openHelpCount)],
                    ]}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Recent Momentum</CardTitle>
                  <CardDescription>Latest activity snapshot so the team can continue smoothly.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <OverviewRows
                    rows={[
                      ["Last Meeting", lastInteraction ? `${lastInteraction.interaction_type} | ${formatDateTimeBD(lastInteraction.meeting_datetime)}` : null],
                      ["Next Follow-up", nextFollowup ? `${nextFollowup.title} | ${formatDateTimeBD(nextFollowup.scheduled_at)}` : null],
                      ["Latest Document", latestDocument ? `${latestDocument.title} | ${latestDocument.document_type}` : null],
                    ]}
                  />
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Notes</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{company.notes || "No strategic notes captured yet for this company."}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <DetailSection
            title="Contacts"
            description="Decision makers and relationship holders for this company."
            actionHref={`/contacts/new?companyId=${company.id}`}
            actionLabel="Add Contact"
            viewAllHref={`/contacts?company=${company.id}`}
            totalCount={contacts.length}
            emptyTitle="No contact persons added yet"
            emptyDescription="Add the right people so every meeting, follow-up, and quote stays tied to an owner."
            emptyIcon={Users}
          >
            <div className="space-y-3">
              {recentContacts.map((contact) => <ContactProfileCard key={contact.id} contact={contact} />)}
            </div>
          </DetailSection>
        </TabsContent>

        <TabsContent value="meetings">
          <DetailSection
            title="Meetings"
            description="Calls, demos, and client conversations that move the deal forward."
            actionHref={`/meetings/new?companyId=${company.id}`}
            actionLabel="Add Meeting"
            viewAllHref={`/meetings?company=${company.id}`}
            totalCount={interactions.length}
            emptyTitle="No meeting history yet"
            emptyDescription="Log the first interaction so your team knows what happened and what comes next."
            emptyIcon={CalendarClock}
          >
            <div className="space-y-3">
              {recentInteractions.map((interaction) => <InteractionTimelineCard key={interaction.id} interaction={interaction} />)}
            </div>
          </DetailSection>
        </TabsContent>

        <TabsContent value="followups">
          <DetailSection
            title="Follow-ups"
            description="Pending next actions, reminders, and overdue work for this relationship."
            actionHref={`/followups/new?company=${company.id}`}
            actionLabel="Add Follow-up"
            viewAllHref={`/followups?company=${company.id}`}
            totalCount={followups.length}
            statusBadge={overdueFollowupCount > 0 ? `${overdueFollowupCount} overdue` : undefined}
            emptyTitle="No follow-ups scheduled yet"
            emptyDescription="Create the next action now so the opportunity does not go cold."
            emptyIcon={Handshake}
          >
            <div className="space-y-3">
              {recentFollowups.map((followup) => <FollowupCard key={followup.id} followup={followup} />)}
            </div>
          </DetailSection>
        </TabsContent>

        <TabsContent value="documents">
          <DetailSection
            title="Documents"
            description="Commercial files, quotations, proposals, and agreements linked to this company."
            actionHref={`/documents/new?companyId=${company.id}`}
            actionLabel="Add Document"
            viewAllHref={`/documents?company=${company.id}`}
            totalCount={documents.length}
            emptyTitle="No documents submitted yet"
            emptyDescription="Upload proposals or quotations so commercial history stays easy to review."
            emptyIcon={FileText}
          >
            <div className="space-y-3">
              {recentDocuments.map((document) => <DocumentCard key={document.id} document={document} />)}
            </div>
          </DetailSection>
        </TabsContent>

        <TabsContent value="escalations">
          <DetailSection
            title="Need Help / Escalations"
            description="Blocked deal support requests, approvals, and manager escalations."
            actionHref={`/need-help/new?company=${company.id}`}
            actionLabel="Request Help"
            viewAllHref={`/need-help?company=${company.id}`}
            totalCount={helpRequests.length}
            statusBadge={openHelpCount > 0 ? `${openHelpCount} open` : undefined}
            emptyTitle="No help requests yet"
            emptyDescription="Raise a blocker here when pricing, technical, or management support is needed."
            emptyIcon={LifeBuoy}
          >
            <div className="space-y-3">
              {recentHelpRequests.map((request) => <HelpRequestCard key={request.id} helpRequest={request} />)}
            </div>
          </DetailSection>
        </TabsContent>

        <TabsContent value="scoring">
          <ScoringActivityPanel
            activities={scoringHistory}
            title="Lead Scoring History"
            description="See which actions on this lead awarded points and how the score has changed."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabCount({ count }: { count: number }) {
  return (
    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 data-[state=active]:bg-white/15 data-[state=active]:text-white">
      {count}
    </span>
  );
}

function AttentionCard({
  title,
  value,
  meta,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  meta: string;
  icon: typeof Handshake;
  tone?: "default" | "warning" | "muted";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50/70"
      : tone === "muted"
        ? "border-slate-200 bg-slate-50/80"
        : "border-emerald-100 bg-emerald-50/50";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        <Icon className="size-4" />
        <span>{title}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{meta}</p>
    </div>
  );
}

function OverviewRows({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`max-w-[65%] text-right text-sm ${value ? "text-slate-900" : "text-slate-400"}`}>{value || "-"}</p>
        </div>
      ))}
    </div>
  );
}

function DetailSection({
  title,
  description,
  actionHref,
  actionLabel,
  viewAllHref,
  totalCount,
  statusBadge,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon,
  children,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  viewAllHref: string;
  totalCount: number;
  statusBadge?: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: typeof Users;
  children: ReactNode;
}) {
  const hasItems = totalCount > 0;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{title}</CardTitle>
            <Badge variant="secondary">{totalCount}</Badge>
            {statusBadge ? <Badge variant="warning">{statusBadge}</Badge> : null}
          </div>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasItems ? (
            <Button asChild variant="outline">
              <Link href={viewAllHref}>View All</Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href={actionHref}>
              <Plus />
              {actionLabel}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {hasItems ? (
          children
        ) : (
          <CompactEmptyState title={emptyTitle} description={emptyDescription} icon={EmptyIcon} />
        )}
      </CardContent>
    </Card>
  );
}

function CompactEmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Mail;
}) {
  return (
    <div className="flex min-h-[13rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
