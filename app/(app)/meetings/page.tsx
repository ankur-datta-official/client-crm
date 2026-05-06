import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { InteractionTable } from "@/components/crm/interaction-table";
import { PageHeader } from "@/components/shared/page-header";
import { getCompanyOptions, getContactOptions, getInteractionsPaginated } from "@/lib/crm/queries";
import type { InteractionFilters } from "@/lib/crm/types";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<InteractionFilters> }) {
  const filters = await searchParams;
  const [interactionPage, companies, contacts] = await Promise.all([
    getInteractionsPaginated(filters),
    getCompanyOptions(),
    getContactOptions(),
  ]);

  return (
    <div data-tour="tour-meetings-overview">
      <PageHeader
        title="Meetings"
        description="Log client conversations and turn discussions into next actions."
        actions={<Button asChild><Link href="/meetings/new"><Plus />Log Meeting</Link></Button>}
      />
      <GuidanceStrip dismissible storageKey="crm-tip-meetings">
        Capture the discussion, next action, and follow-up date so your team always knows what happened and what comes next.
      </GuidanceStrip>
      <InteractionTable interactions={interactionPage.rows} companies={companies} contacts={contacts} totalCount={interactionPage.total} />
    </div>
  );
}
