import { Suspense } from "react";
import Link from "next/link";
import { AlarmClock, CalendarClock, CheckCircle2, Plus, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { FollowupTable } from "@/components/crm/followup-table";
import { getFollowupsPaginated } from "@/lib/crm/followup-queries";
import { getCompanyOptions, getTeamMembers } from "@/lib/crm/queries";
import type { FollowupFilters } from "@/lib/crm/types";
import { WorkspaceHero, WorkspaceKpiCard, WorkspaceKpiGrid } from "@/components/shared/workspace-primitives";

export default async function FollowupsPage({
  searchParams,
}: {
  searchParams: Promise<FollowupFilters>;
}) {
  const filters = await searchParams;
  const followupPage = await getFollowupsPaginated(filters);
  const visibleFollowups = followupPage.rows;
  const now = getCurrentTimestamp();
  const overdue = visibleFollowups.filter((item) => item.status === "pending" && new Date(item.scheduled_at).getTime() < now).length;
  const completed = visibleFollowups.filter((item) => item.status === "completed").length;
  const dueToday = visibleFollowups.filter((item) => {
    if (item.status !== "pending") return false;
    const date = new Date(item.scheduled_at);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  }).length;
  const upcoming = visibleFollowups.filter((item) => item.status === "pending" && new Date(item.scheduled_at).getTime() >= now).length;

  return (
    <div className="space-y-6" data-tour="tour-followups-overview">
      <WorkspaceHero
        eyebrow="Execution Workspace"
        title="Follow-ups"
        description="Use this page as the team's action queue for overdue work, today's commitments, and the next client move."
        actions={
          <Button asChild>
            <Link href="/followups/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Follow-up
            </Link>
          </Button>
        }
        highlights={[
          `${followupPage.total} follow-ups in scope`,
          "Review overdue work first",
          "Capture the next action before leaving a deal",
        ]}
      />
      <WorkspaceKpiGrid>
        <WorkspaceKpiCard title="Overdue" value={String(overdue)} description="Pending follow-ups already past their scheduled time." icon={TimerOff} tone={overdue > 0 ? "rose" : "slate"} />
        <WorkspaceKpiCard title="Due Today" value={String(dueToday)} description="Follow-ups that should be completed before the day ends." icon={CalendarClock} tone="amber" />
        <WorkspaceKpiCard title="Upcoming" value={String(upcoming)} description="Pending follow-ups that are still scheduled ahead." icon={AlarmClock} tone="blue" />
        <WorkspaceKpiCard title="Completed" value={String(completed)} description="Visible follow-ups already completed in the current scope." icon={CheckCircle2} tone="teal" />
      </WorkspaceKpiGrid>
      <GuidanceStrip dismissible storageKey="crm-tip-followups">
        Use filters to focus on high-priority or overdue work so no client action is missed.
      </GuidanceStrip>

      <Suspense fallback={<LoadingSkeleton />}>
        <FollowupsList filters={filters} initialPage={followupPage} />
      </Suspense>
    </div>
  );
}

async function FollowupsList({ filters, initialPage }: { filters: FollowupFilters; initialPage?: Awaited<ReturnType<typeof getFollowupsPaginated>> }) {
  const [followupPage, companies, teamMembers] = await Promise.all([
    initialPage ? Promise.resolve(initialPage) : getFollowupsPaginated(filters),
    getCompanyOptions(),
    getTeamMembers(),
  ]);

  return <FollowupTable followups={followupPage.rows} companies={companies} teamMembers={teamMembers} totalCount={followupPage.total} />;
}

function getCurrentTimestamp() {
  return Date.now();
}
