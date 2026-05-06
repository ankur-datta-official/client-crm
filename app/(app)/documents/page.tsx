import { Suspense } from "react";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentTable } from "@/components/crm/document-table";
import { getDocumentsPaginated } from "@/lib/crm/document-queries";
import { getCompanyOptions, getTeamMembers } from "@/lib/crm/queries";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

export const metadata = {
  title: "Documents | CRM",
};

type PageProps = {
  searchParams: Promise<{
    search?: string;
    company?: string;
    type?: string;
    status?: string;
    uploadedBy?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
};

export default async function DocumentsPage({ searchParams }: PageProps) {
  const filters = await searchParams;

  return (
    <div className="space-y-6" data-tour="tour-documents-overview">
      <PageHeader
        title="Documents"
        description="Manage quotations, proposals, brochures, and submitted files."
        actions={
          <Button asChild>
            <Link href="/documents/new">
              <Plus className="w-4 h-4 mr-2" />
              Upload Document
            </Link>
          </Button>
        }
      />
      <GuidanceStrip dismissible storageKey="crm-tip-documents">
        Keep commercial files linked to the right company, meeting, or follow-up so your history stays easy to review.
      </GuidanceStrip>

      <Suspense fallback={<LoadingSkeleton rows={5} />}>
        <DocumentListContainer filters={filters} />
      </Suspense>
    </div>
  );
}

async function DocumentListContainer({ filters }: { filters: any }) {
  const [documentPage, companies, teamMembers] = await Promise.all([
    getDocumentsPaginated(filters),
    getCompanyOptions(),
    getTeamMembers(),
  ]);

  return (
    <DocumentTable 
      documents={documentPage.rows} 
      companies={companies} 
      teamMembers={teamMembers} 
      totalCount={documentPage.total}
    />
  );
}
