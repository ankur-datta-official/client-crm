import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { HelpRequestTable } from "@/components/crm/help-request-table";
import { getHelpRequestsPaginated } from "@/lib/crm/help-request-queries";
import { getCompanyOptions, getTeamMembers } from "@/lib/crm/queries";
import type { HelpRequestFilters } from "@/lib/crm/types";

export default async function NeedHelpPage({
  searchParams,
}: {
  searchParams: Promise<HelpRequestFilters>;
}) {
  const filters = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Need Help"
        description="Escalate pricing, technical, proposal, or management support requests."
        actions={
          <Button asChild>
            <Link href="/need-help/new">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Link>
          </Button>
        }
      />
      <GuidanceStrip dismissible storageKey="crm-tip-need-help">
        Use this module when a deal is blocked and another teammate or manager needs to step in.
      </GuidanceStrip>

      <Suspense fallback={<LoadingSkeleton />}>
        <HelpRequestsList filters={filters} />
      </Suspense>
    </div>
  );
}

async function HelpRequestsList({ filters }: { filters: HelpRequestFilters }) {
  const [helpRequestPage, companies, teamMembers] = await Promise.all([
    getHelpRequestsPaginated(filters),
    getCompanyOptions(),
    getTeamMembers(),
  ]);

  return <HelpRequestTable helpRequests={helpRequestPage.rows} companies={companies} teamMembers={teamMembers} totalCount={helpRequestPage.total} />;
}
