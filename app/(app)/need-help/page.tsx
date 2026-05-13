import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CircleHelp, Plus, ShieldAlert, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { HelpRequestTable } from "@/components/crm/help-request-table";
import { getHelpRequestsPaginated, getOpenHelpRequestsCount, getUrgentHelpRequestsCount } from "@/lib/crm/help-request-queries";
import { getCompanyOptions, getTeamMembers } from "@/lib/crm/queries";
import type { HelpRequestFilters } from "@/lib/crm/types";
import { WorkspaceHero, WorkspaceKpiCard, WorkspaceKpiGrid } from "@/components/shared/workspace-primitives";

export default async function NeedHelpPage({
  searchParams,
}: {
  searchParams: Promise<HelpRequestFilters>;
}) {
  const filters = await searchParams;
  const [helpRequestPage, openCount, urgentCount] = await Promise.all([
    getHelpRequestsPaginated(filters),
    getOpenHelpRequestsCount(),
    getUrgentHelpRequestsCount(),
  ]);
  const visibleRequests = helpRequestPage.rows;
  const unassigned = visibleRequests.filter((request) => !request.assigned_to).length;
  const blocked = visibleRequests.filter((request) => request.status === "open" || request.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Blocker Workspace"
        title="Need Help"
        description="Track blocked deals, support requests, and escalation ownership before momentum is lost."
        actions={
          <Button asChild>
            <Link href="/need-help/new">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Link>
          </Button>
        }
        highlights={[
          `${helpRequestPage.total} requests in scope`,
          `${openCount} open across workspace`,
          "Use this page to surface stuck deals early",
        ]}
      />
      <WorkspaceKpiGrid>
        <WorkspaceKpiCard title="Open or In Progress" value={String(blocked)} description="Visible blockers still needing follow-through." icon={CircleHelp} tone={blocked > 0 ? "rose" : "slate"} />
        <WorkspaceKpiCard title="Urgent Workspace Requests" value={String(urgentCount)} description="Urgent help requests across the workspace, regardless of current filter." icon={ShieldAlert} tone={urgentCount > 0 ? "amber" : "slate"} />
        <WorkspaceKpiCard title="Unassigned Visible" value={String(unassigned)} description="Requests in view that still have no owner assigned." icon={UserRoundX} tone={unassigned > 0 ? "rose" : "slate"} />
        <WorkspaceKpiCard title="Visible Requests" value={String(visibleRequests.length)} description="Help requests currently shown in the active page scope." icon={AlertTriangle} tone="blue" />
      </WorkspaceKpiGrid>
      <GuidanceStrip dismissible storageKey="crm-tip-need-help">
        Use this module when a deal is blocked and another teammate or manager needs to step in.
      </GuidanceStrip>

      <Suspense fallback={<LoadingSkeleton />}>
        <HelpRequestsList filters={filters} initialPage={helpRequestPage} />
      </Suspense>
    </div>
  );
}

async function HelpRequestsList({
  filters,
  initialPage,
}: {
  filters: HelpRequestFilters;
  initialPage?: Awaited<ReturnType<typeof getHelpRequestsPaginated>>;
}) {
  const [helpRequestPage, companies, teamMembers] = await Promise.all([
    initialPage ? Promise.resolve(initialPage) : getHelpRequestsPaginated(filters),
    getCompanyOptions(),
    getTeamMembers(),
  ]);

  return <HelpRequestTable helpRequests={helpRequestPage.rows} companies={companies} teamMembers={teamMembers} totalCount={helpRequestPage.total} />;
}
