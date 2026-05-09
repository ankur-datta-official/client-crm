import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { ContactTable } from "@/components/crm/contact-table";
import { PageHeader } from "@/components/shared/page-header";
import { getCompanyOptions, getContactsPaginated } from "@/lib/crm/queries";
import type { ContactFilters } from "@/lib/crm/types";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<ContactFilters> }) {
  const filters = await searchParams;
  const [contactPage, companies] = await Promise.all([
    getContactsPaginated(filters),
    getCompanyOptions(),
  ]);

  return (
    <div data-tour="tour-contacts-overview" className="flex min-h-full flex-col">
      <PageHeader
        title="Contacts"
        description="Keep track of decision makers, influencers, and day-to-day contact details."
        actions={
          <Button asChild>
            <Link href="/contacts/new">
              <Plus />
              Add Contact
            </Link>
          </Button>
        }
      />
      <GuidanceStrip dismissible storageKey="crm-tip-contacts">
        Add contacts under your companies so every meeting, follow-up, and document stays tied to the right people.
      </GuidanceStrip>
      <div className="flex-1">
        <ContactTable contacts={contactPage.rows} companies={companies} totalCount={contactPage.total} />
      </div>
    </div>
  );
}
