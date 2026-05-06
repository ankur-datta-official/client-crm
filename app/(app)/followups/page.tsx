import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { FollowupTable } from "@/components/crm/followup-table";
import { getFollowupsPaginated } from "@/lib/crm/followup-queries";
import { getCompanyOptions, getTeamMembers } from "@/lib/crm/queries";
import type { FollowupFilters } from "@/lib/crm/types";

export default async function FollowupsPage({
  searchParams,
}: {
  searchParams: Promise<FollowupFilters>;
}) {
  const filters = await searchParams;

  return (
    <div className="space-y-6" data-tour="tour-followups-overview">
      <PageHeader
        title="Follow-ups"
        description="Stay on top of next calls, reminders, and overdue client actions."
        actions={
          <Button asChild>
            <Link href="/followups/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Follow-up
            </Link>
          </Button>
        }
      />
      <GuidanceStrip dismissible storageKey="crm-tip-followups">
        Use filters to focus on high-priority or overdue work so no client action is missed.
      </GuidanceStrip>

      <Suspense fallback={<LoadingSkeleton />}>
        <FollowupsList filters={filters} />
      </Suspense>
    </div>
  );
}

async function FollowupsList({ filters }: { filters: FollowupFilters }) {
  const [followupPage, companies, teamMembers] = await Promise.all([
    getFollowupsPaginated(filters),
    getCompanyOptions(),
    getTeamMembers(),
  ]);

  return <FollowupTable followups={followupPage.rows} companies={companies} teamMembers={teamMembers} totalCount={followupPage.total} />;
}
