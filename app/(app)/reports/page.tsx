import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { ReportFilterBar } from "@/components/crm/reports/report-filter-bar";
import { ReportTabs } from "@/components/crm/reports/report-tabs";
import { SalesOverviewReport } from "@/components/crm/reports/sales-overview-report";
import { LeadReport } from "@/components/crm/reports/lead-report";
import { PipelineReport } from "@/components/crm/reports/pipeline-report";
import { MeetingReport } from "@/components/crm/reports/meeting-report";
import { FollowupReport } from "@/components/crm/reports/followup-report";
import { DocumentReport } from "@/components/crm/reports/document-report";
import { HelpRequestReport } from "@/components/crm/reports/help-request-report";
import { TeamPerformanceReport } from "@/components/crm/reports/team-performance-report";
import { ReportLoadingFallback } from "@/components/crm/reports/report-visuals";
import {
  getIndustries,
  getCompanyCategories,
  getPipelineStages,
  getTeamMembers
} from "@/lib/crm/queries";
import {
  getSalesOverviewReport,
  getLeadReport,
  getPipelineReport,
  getMeetingReport,
  getFollowupReport,
  getDocumentReport,
  getHelpRequestReport,
  getTeamPerformanceReport,
  type ReportFilters
} from "@/lib/crm/report-queries";
import { requirePermission } from "@/lib/auth/session";

interface ReportsPageProps {
  searchParams: Promise<{
    tab?: string;
    dateRange?: string;
    assignedUserId?: string;
    industryId?: string;
    pipelineStageId?: string;
    leadTemperature?: string;
    companyCategoryId?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requirePermission("reports.view");
  const params = await searchParams;
  const currentTab = params.tab || "sales-overview";
  const lockedTabs: string[] = [];

  const filters: ReportFilters = {
    dateRange: (params.dateRange as any) || "this_month",
    assignedUserId: params.assignedUserId === "all" ? undefined : params.assignedUserId,
    industryId: params.industryId === "all" ? undefined : params.industryId,
    pipelineStageId: params.pipelineStageId === "all" ? undefined : params.pipelineStageId,
    leadTemperature: params.leadTemperature === "all" ? undefined : params.leadTemperature,
    companyCategoryId: params.companyCategoryId === "all" ? undefined : params.companyCategoryId,
  };

  const [industries, categories, stages, users] = await Promise.all([
    getIndustries(),
    getCompanyCategories(),
    getPipelineStages(),
    getTeamMembers(),
  ]);

  const tabDescriptions: Record<string, string> = {
    "sales-overview": "A quick snapshot of lead volume, pipeline value, activity, and support needs.",
    leads: "Understand lead quality, source momentum, owner balance, and missing nurturing signals.",
    pipeline: "Review deal movement, stage value, rating confidence, and funnel bottlenecks.",
    meetings: "Track discussion activity, meeting quality, and next-step discipline.",
    "follow-ups": "Measure execution consistency, overdue work, and workload balance.",
    documents: "Review submitted proposals, quotations, files, and contribution trends.",
    "help-requests": "Monitor internal support pressure, urgency, assignee load, and blocker patterns.",
    team: "Compare ownership, productivity, and pipeline contribution across the whole team.",
  };

  return (
    <div className="space-y-6" data-tour="tour-reports-overview">
      <PageHeader
        title="Reports & Analytics"
        description="Track sales health, team activity, pipeline momentum, and execution quality with richer visual analytics."
      />
      <GuidanceStrip dismissible storageKey="crm-tip-reports" className="py-2.5">
        Start with Sales Overview for a quick read, then switch tabs to inspect pipeline, meetings, follow-ups, and support trends.
      </GuidanceStrip>

      <ReportFilterBar
        users={users}
        industries={industries}
        stages={stages}
        categories={categories}
      />

      <ReportTabs currentTab={currentTab} lockedTabs={lockedTabs} description={tabDescriptions[currentTab] ?? tabDescriptions["sales-overview"]}>
        <Suspense fallback={<ReportLoadingFallback />}>
          <ActiveReportView currentTab={currentTab} filters={filters} lockedTabs={lockedTabs} />
        </Suspense>
      </ReportTabs>
    </div>
  );
}

async function ActiveReportView({
  currentTab,
  filters,
  lockedTabs,
}: {
  currentTab: string;
  filters: ReportFilters;
  lockedTabs: string[];
}) {
  switch (currentTab) {
    case "leads":
      return <LeadReportView filters={filters} />;
    case "pipeline":
      return <PipelineReportView filters={filters} />;
    case "meetings":
      return <MeetingReportView filters={filters} />;
    case "follow-ups":
      return <FollowupReportView filters={filters} />;
    case "documents":
      return <DocumentReportView filters={filters} />;
    case "help-requests":
      return <HelpRequestReportView filters={filters} />;
    case "team":
      return <TeamPerformanceReportView filters={filters} />;
    case "sales-overview":
    default:
      return <SalesOverviewReportView filters={filters} />;
  }
}

async function SalesOverviewReportView({ filters }: { filters: ReportFilters }) {
  const data = await getSalesOverviewReport(filters);
  return <SalesOverviewReport data={data} />;
}

async function LeadReportView({ filters }: { filters: ReportFilters }) {
  const data = await getLeadReport(filters);
  return <LeadReport data={data} />;
}

async function PipelineReportView({ filters }: { filters: ReportFilters }) {
  const data = await getPipelineReport(filters);
  return <PipelineReport data={data} />;
}

async function MeetingReportView({ filters }: { filters: ReportFilters }) {
  const data = await getMeetingReport(filters);
  return <MeetingReport data={data} />;
}

async function FollowupReportView({ filters }: { filters: ReportFilters }) {
  const data = await getFollowupReport(filters);
  return <FollowupReport data={data} />;
}

async function DocumentReportView({ filters }: { filters: ReportFilters }) {
  const data = await getDocumentReport(filters);
  return <DocumentReport data={data} />;
}

async function HelpRequestReportView({ filters }: { filters: ReportFilters }) {
  const data = await getHelpRequestReport(filters);
  return <HelpRequestReport data={data} />;
}

async function TeamPerformanceReportView({ filters }: { filters: ReportFilters }) {
  const data = await getTeamPerformanceReport(filters);
  return <TeamPerformanceReport data={data} />;
}
