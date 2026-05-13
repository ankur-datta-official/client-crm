import Link from "next/link";
import { AlertTriangle, CalendarClock, CircleHelp, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { InteractionTable } from "@/components/crm/interaction-table";
import { getCompanyOptions, getContactOptions, getInteractionsPaginated } from "@/lib/crm/queries";
import type { InteractionFilters } from "@/lib/crm/types";
import { WorkspaceHero, WorkspaceKpiCard, WorkspaceKpiGrid } from "@/components/shared/workspace-primitives";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<InteractionFilters> }) {
  const filters = await searchParams;
  const [interactionPage, companies, contacts] = await Promise.all([
    getInteractionsPaginated(filters),
    getCompanyOptions(),
    getContactOptions(),
  ]);
  const visibleMeetings = interactionPage.rows;
  const helpFlagged = visibleMeetings.filter((item) => item.need_help).length;
  const noNextAction = visibleMeetings.filter((item) => !item.next_action?.trim()).length;
  const highSignal = visibleMeetings.filter((item) => (item.success_rating ?? 0) >= 8 || item.lead_temperature === "hot" || item.lead_temperature === "very_hot").length;

  return (
    <div data-tour="tour-meetings-overview">
      <WorkspaceHero
        eyebrow="Activity Workspace"
        title="Meetings"
        description="Review client conversations, find missing next steps, and turn discussions into concrete follow-up work."
        actions={<Button asChild><Link href="/meetings/new"><Plus />Log Meeting</Link></Button>}
        highlights={[
          `${interactionPage.total} meetings in scope`,
          `${companies.length} companies selectable`,
          `${contacts.length} contacts available`,
        ]}
      />
      <WorkspaceKpiGrid className="mt-6">
        <WorkspaceKpiCard title="Visible Meetings" value={String(visibleMeetings.length)} description="Meetings currently shown in the active page scope." icon={CalendarClock} tone="teal" />
        <WorkspaceKpiCard title="Needs Help" value={String(helpFlagged)} description="Meetings already flagged as needing technical or manager support." icon={CircleHelp} tone={helpFlagged > 0 ? "rose" : "slate"} />
        <WorkspaceKpiCard title="Missing Next Step" value={String(noNextAction)} description="Discussions where the team still has not captured a next move." icon={AlertTriangle} tone={noNextAction > 0 ? "rose" : "slate"} />
        <WorkspaceKpiCard title="High-Signal Meetings" value={String(highSignal)} description="Strong rating or hot-temperature discussions worth moving forward fast." icon={Sparkles} tone="amber" />
      </WorkspaceKpiGrid>
      <GuidanceStrip dismissible storageKey="crm-tip-meetings">
        Capture the discussion, next action, and follow-up date so your team always knows what happened and what comes next.
      </GuidanceStrip>
      <InteractionTable interactions={interactionPage.rows} companies={companies} contacts={contacts} totalCount={interactionPage.total} />
    </div>
  );
}
