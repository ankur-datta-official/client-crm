import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { ContactTable } from "@/components/crm/contact-table";
import { PageHeader } from "@/components/shared/page-header";
import { getCompanies, getContacts } from "@/lib/crm/queries";
import type { ContactFilters } from "@/lib/crm/types";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<ContactFilters> }) {
  const filters = await searchParams;
  const [contacts, companies] = await Promise.all([
    getContacts(filters),
    getCompanies({}),
  ]);

  return (
    <div data-tour="tour-contacts-overview">
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
      <ContactTable contacts={contacts} companies={companies} />
    </div>
  );
}
