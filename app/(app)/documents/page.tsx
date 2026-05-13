import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, FileCheck2, FileText, Plus, RefreshCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { DocumentTable } from "@/components/crm/document-table";
import { getDocumentsPaginated } from "@/lib/crm/document-queries";
import { getCompanyOptions, getTeamMembers } from "@/lib/crm/queries";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { WorkspaceHero, WorkspaceKpiCard, WorkspaceKpiGrid } from "@/components/shared/workspace-primitives";

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
  const documentPage = await getDocumentsPaginated(filters);
  const visibleDocuments = documentPage.rows;
  const now = getCurrentTimestamp();
  const awaitingAction = visibleDocuments.filter((doc) => doc.status === "draft" || doc.status === "revision_requested").length;
  const approved = visibleDocuments.filter((doc) => doc.status === "approved" || doc.status === "submitted").length;
  const expiringSoon = visibleDocuments.filter((doc) => {
    if (!doc.expiry_date) return false;
    const diff = new Date(doc.expiry_date).getTime() - now;
    return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const proposalLike = visibleDocuments.filter((doc) => doc.document_type.includes("Proposal") || doc.document_type === "Quotation").length;

  return (
    <div className="space-y-6" data-tour="tour-documents-overview">
      <WorkspaceHero
        eyebrow="Commercial File Workspace"
        title="Documents"
        description="Manage proposals, quotations, and supporting files with clear submission, revision, and expiry visibility."
        actions={
          <Button asChild>
            <Link href="/documents/new">
              <Plus className="w-4 h-4 mr-2" />
              Upload Document
            </Link>
          </Button>
        }
        highlights={[
          `${documentPage.total} documents in scope`,
          "Review revision and expiry risks early",
          "Keep every file tied to the right CRM record",
        ]}
      />
      <WorkspaceKpiGrid>
        <WorkspaceKpiCard title="Visible Documents" value={String(visibleDocuments.length)} description="Files currently shown in the active page scope." icon={FileText} tone="blue" />
        <WorkspaceKpiCard title="Awaiting Action" value={String(awaitingAction)} description="Draft or revision-requested files that still need work." icon={RefreshCcw} tone={awaitingAction > 0 ? "amber" : "slate"} />
        <WorkspaceKpiCard title="Submitted or Approved" value={String(approved)} description="Files already progressed beyond draft state." icon={FileCheck2} tone="teal" />
        <WorkspaceKpiCard title="Expiring Soon" value={String(expiringSoon)} description="Visible documents with an expiry inside the next 30 days." icon={TriangleAlert} tone={expiringSoon > 0 ? "rose" : "slate"} />
      </WorkspaceKpiGrid>
      <GuidanceStrip dismissible storageKey="crm-tip-documents">
        Keep commercial files linked to the right company, meeting, or follow-up so your history stays easy to review.
      </GuidanceStrip>

      <Suspense fallback={<LoadingSkeleton rows={5} />}>
        <DocumentListContainer filters={filters} initialPage={documentPage} />
      </Suspense>
    </div>
  );
}

async function DocumentListContainer({ filters, initialPage }: { filters: any; initialPage?: Awaited<ReturnType<typeof getDocumentsPaginated>> }) {
  const [documentPage, companies, teamMembers] = await Promise.all([
    initialPage ? Promise.resolve(initialPage) : getDocumentsPaginated(filters),
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

function getCurrentTimestamp() {
  return Date.now();
}
