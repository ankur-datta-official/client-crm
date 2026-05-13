import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CircleHelp, Mail, Phone, UserRoundCheck } from "lucide-react";
import { ActionInfoCard } from "@/components/shared/action-info-card";
import { ContactDetailHeader } from "@/components/crm/contact-detail-header";
import { FollowupCard } from "@/components/crm/followup-card";
import { InteractionTimelineCard } from "@/components/crm/interaction-timeline-card";
import { buildEmailHref, buildPhoneHref, buildWhatsAppHref } from "@/lib/crm/contact-channels";
import { formatDateBD } from "@/lib/format/datetime";
import { getContactById, getInteractions } from "@/lib/crm/queries";
import { getFollowups } from "@/lib/crm/followup-queries";
import { getHelpRequests } from "@/lib/crm/help-request-queries";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompactEmptyPanel, DetailRowList, RecordContextSidebar, RecordOverviewPanel, WorkspaceHero, WorkspaceKpiCard, WorkspaceKpiGrid, WorkspaceSection } from "@/components/shared/workspace-primitives";
import { HelpRequestCard } from "@/components/crm/help-request-card";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await getContactById(id);

  if (!contact) {
    notFound();
  }

  const [interactions, followups, helpRequests] = await Promise.all([
    getInteractions({ contact: contact.id }),
    getFollowups({ contact: contact.id }),
    getHelpRequests({ contact: contact.id }),
  ]);
  const lastInteraction = interactions[0] ?? null;
  const pendingFollowups = followups.filter((followup) => followup.status === "pending");
  const openHelp = helpRequests.filter((request) => request.status === "open" || request.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <ContactDetailHeader contact={contact} />
      <WorkspaceKpiGrid>
        <WorkspaceKpiCard title="Company" value={contact.companies?.name ?? "-"} description="The account this relationship belongs to." icon={UserRoundCheck} tone="teal" />
        <WorkspaceKpiCard title="Preferred Method" value={contact.preferred_contact_method ?? "Not set"} description="How this contact should be reached first." icon={Phone} tone="blue" />
        <WorkspaceKpiCard title="Last Meeting" value={lastInteraction ? formatDateBD(lastInteraction.meeting_datetime) : "No history"} description={lastInteraction?.interaction_type ?? "No meeting logged yet"} icon={CalendarClock} tone="amber" />
        <WorkspaceKpiCard title="Open Support" value={String(openHelp)} description="Help requests linked to this relationship that are still open." icon={CircleHelp} tone={openHelp > 0 ? "rose" : "slate"} />
      </WorkspaceKpiGrid>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
          <TabsTrigger value="overview" className="rounded-xl px-4 py-2.5">Overview</TabsTrigger>
          <TabsTrigger value="meetings" className="rounded-xl px-4 py-2.5">Meetings ({interactions.length})</TabsTrigger>
          <TabsTrigger value="followups" className="rounded-xl px-4 py-2.5">Follow-ups ({followups.length})</TabsTrigger>
          <TabsTrigger value="support" className="rounded-xl px-4 py-2.5">Support ({helpRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <RecordOverviewPanel title="Communication Channels" description="Reach this contact quickly using the preferred channel or available alternates.">
                <div className="grid gap-4 md:grid-cols-2">
                  <ActionInfoCard
                    title="Mobile"
                    items={(contact.mobile_numbers?.length ? contact.mobile_numbers : contact.mobile ? [contact.mobile] : []).map((mobile) => ({
                      label: mobile,
                      href: buildPhoneHref(mobile),
                    }))}
                  />
                  <ActionInfoCard
                    title="WhatsApp"
                    items={(contact.whatsapp ? [contact.whatsapp] : []).map((value) => ({
                      label: value,
                      href: buildWhatsAppHref(value),
                    }))}
                  />
                  <ActionInfoCard
                    title="Email"
                    items={(contact.email_addresses?.length ? contact.email_addresses : contact.email ? [contact.email] : []).map((email) => ({
                      label: email,
                      href: buildEmailHref(email),
                    }))}
                  />
                  <DetailRowList rows={[{ label: "LinkedIn", value: contact.linkedin }]} />
                </div>
              </RecordOverviewPanel>

              <RecordOverviewPanel title="Relationship Notes" description="Role clarity and relationship health for future handoffs.">
                <DetailRowList
                  rows={[
                    { label: "Designation", value: contact.designation },
                    { label: "Department", value: contact.department },
                    { label: "Decision Role", value: contact.decision_role },
                    { label: "Relationship Level", value: contact.relationship_level },
                    { label: "Preferred Method", value: contact.preferred_contact_method },
                    { label: "Remarks", value: contact.remarks },
                  ]}
                />
              </RecordOverviewPanel>
            </div>

            <div className="space-y-4">
              <RecordContextSidebar title="Current Context">
                <div className="space-y-3">
                  <DetailRowList
                    rows={[
                      { label: "Company", value: contact.companies?.name },
                      { label: "Primary Contact", value: contact.is_primary ? "Yes" : "No" },
                      { label: "Status", value: contact.status },
                      { label: "Created By", value: contact.created_profile?.full_name ?? contact.created_profile?.email },
                      { label: "Created Date", value: formatDateBD(contact.created_at) },
                    ]}
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild variant="outline">
                      <Link href={`/companies/${contact.company_id}`}>Open Company</Link>
                    </Button>
                    <Button asChild>
                      <Link href={`/meetings/new?companyId=${contact.company_id}&contactId=${contact.id}`}>Log Meeting</Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href={`/followups/new?company=${contact.company_id}&contact=${contact.id}`}>Add Follow-up</Link>
                    </Button>
                  </div>
                </div>
              </RecordContextSidebar>

              <RecordContextSidebar title="Next Attention">
                <DetailRowList
                  rows={[
                    { label: "Pending Follow-ups", value: String(pendingFollowups.length) },
                    { label: "Open Help Requests", value: String(openHelp) },
                    { label: "Latest Meeting", value: lastInteraction ? `${lastInteraction.interaction_type} on ${formatDateBD(lastInteraction.meeting_datetime)}` : null },
                  ]}
                />
              </RecordContextSidebar>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="meetings">
          <WorkspaceSection
            title="Related Meetings"
            description="Client discussions connected to this person."
            actions={<Button asChild><Link href={`/meetings/new?companyId=${contact.company_id}&contactId=${contact.id}`}>Log Meeting</Link></Button>}
          >
            {interactions.length === 0 ? (
              <CompactEmptyPanel icon={CalendarClock} title="No meetings linked yet" description="Log the first discussion to capture context and next steps around this contact." />
            ) : (
              <div className="space-y-3">
                {interactions.slice(0, 5).map((interaction) => <InteractionTimelineCard key={interaction.id} interaction={interaction} />)}
              </div>
            )}
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="followups">
          <WorkspaceSection
            title="Related Follow-ups"
            description="Pending and completed actions assigned through this relationship."
            actions={<Button asChild><Link href={`/followups/new?company=${contact.company_id}&contact=${contact.id}`}>Create Follow-up</Link></Button>}
          >
            {followups.length === 0 ? (
              <CompactEmptyPanel icon={Phone} title="No follow-ups linked yet" description="Create the next action here so this relationship keeps moving." />
            ) : (
              <div className="space-y-3">
                {followups.slice(0, 5).map((followup) => <FollowupCard key={followup.id} followup={followup} />)}
              </div>
            )}
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="support">
          <WorkspaceSection
            title="Support Context"
            description="Escalations raised around this contact."
            actions={<Button asChild><Link href={`/need-help/new?company=${contact.company_id}&contact=${contact.id}`}>Create Help Request</Link></Button>}
          >
            {helpRequests.length === 0 ? (
              <CompactEmptyPanel icon={CircleHelp} title="No support requests yet" description="Raise a help request here when this contact needs pricing, technical, or management support." />
            ) : (
              <div className="space-y-3">
                {helpRequests.slice(0, 5).map((request) => <HelpRequestCard key={request.id} helpRequest={request} />)}
              </div>
            )}
          </WorkspaceSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
