"use server";

import { Prisma } from "@prisma/client";
import { requireOrganization } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type DateRangeFilter = "today" | "this_week" | "this_month" | "last_30_days" | "this_quarter" | "custom";

export type ReportFilters = {
  dateRange?: DateRangeFilter;
  startDate?: string;
  endDate?: string;
  assignedUserId?: string;
  industryId?: string;
  pipelineStageId?: string;
  leadTemperature?: string;
  companyCategoryId?: string;
};

function buildDateRange(filters: ReportFilters): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(now);

  switch (filters.dateRange) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "this_week":
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay());
      break;
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_30_days":
      start.setDate(start.getDate() - 30);
      break;
    case "this_quarter": {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    }
    case "custom":
      if (filters.startDate) {
        start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
      }
      if (filters.endDate) {
        end.setTime(new Date(filters.endDate).getTime());
        end.setHours(23, 59, 59, 999);
      }
      break;
    default:
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

function toNumber(value: bigint | number | string | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

function buildCompanyWhere(organizationId: string, filters: ReportFilters) {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`c.organization_id = ${organizationId}::uuid`,
    Prisma.sql`c.status <> 'archived'`,
  ];

  if (filters.industryId) clauses.push(Prisma.sql`c.industry_id = ${filters.industryId}::uuid`);
  if (filters.pipelineStageId) clauses.push(Prisma.sql`c.pipeline_stage_id = ${filters.pipelineStageId}::uuid`);
  if (filters.assignedUserId) clauses.push(Prisma.sql`c.assigned_user_id = ${filters.assignedUserId}::uuid`);
  if (filters.leadTemperature) clauses.push(Prisma.sql`c.lead_temperature = ${filters.leadTemperature}`);
  if (filters.companyCategoryId) clauses.push(Prisma.sql`c.category_id = ${filters.companyCategoryId}::uuid`);

  return Prisma.join(clauses, " and ");
}

export type SalesOverviewReport = {
  totalCompanies: number;
  newLeadsInPeriod: number;
  hotLeads: number;
  veryHotLeads: number;
  pipelineValue: number;
  wonDeals: number;
  lostDeals: number;
  meetingsCompleted: number;
  followupsDue: number;
  overdueFollowups: number;
  documentsSubmitted: number;
  openHelpRequests: number;
  leadTemperatureDistribution: { temperature: string; count: number }[];
  pipelineStageDistribution: { stage: string; count: number; color: string }[];
  monthlyLeadCreationTrend: { month: string; count: number }[];
  meetingActivityTrend: { date: string; count: number }[];
};

export async function getSalesOverviewReport(filters: ReportFilters = {}): Promise<SalesOverviewReport> {
  const organization = await requireOrganization();
  const { start, end } = buildDateRange(filters);
  const companyWhere = buildCompanyWhere(organization.id, filters);

  const [
    counts,
    temperatureRows,
    stageRows,
    monthlyRows,
    meetingRows,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{
      total_companies: bigint;
      new_leads_in_period: bigint;
      hot_leads: bigint;
      very_hot_leads: bigint;
      pipeline_value: string | number | null;
      won_deals: bigint;
      lost_deals: bigint;
      meetings_completed: bigint;
      followups_due: bigint;
      overdue_followups: bigint;
      documents_submitted: bigint;
      open_help_requests: bigint;
    }>>(Prisma.sql`
      select
        (select count(*) from public.companies c where ${companyWhere}) as total_companies,
        (select count(*) from public.companies c where ${companyWhere} and c.created_at >= ${start.toISOString()}::timestamptz and c.created_at <= ${end.toISOString()}::timestamptz) as new_leads_in_period,
        (select count(*) from public.companies c where ${companyWhere} and c.lead_temperature = 'hot') as hot_leads,
        (select count(*) from public.companies c where ${companyWhere} and c.lead_temperature = 'very_hot') as very_hot_leads,
        (select coalesce(sum(c.estimated_value), 0) from public.companies c where ${companyWhere}) as pipeline_value,
        (select count(*) from public.companies c left join public.pipeline_stages ps on ps.id = c.pipeline_stage_id where ${companyWhere} and ps.is_won = true) as won_deals,
        (select count(*) from public.companies c left join public.pipeline_stages ps on ps.id = c.pipeline_stage_id where ${companyWhere} and ps.is_lost = true) as lost_deals,
        (select count(*) from public.interactions i where i.organization_id = ${organization.id}::uuid and i.status <> 'archived' and i.meeting_datetime >= ${start.toISOString()}::timestamptz and i.meeting_datetime <= ${end.toISOString()}::timestamptz) as meetings_completed,
        (select count(*) from public.followups f where f.organization_id = ${organization.id}::uuid and f.status = 'pending' and f.scheduled_at >= ${start.toISOString()}::timestamptz and f.scheduled_at <= ${end.toISOString()}::timestamptz) as followups_due,
        (select count(*) from public.followups f where f.organization_id = ${organization.id}::uuid and f.status = 'pending' and f.scheduled_at < now()) as overdue_followups,
        (select count(*) from public.documents d where d.organization_id = ${organization.id}::uuid and d.status <> 'archived' and d.created_at >= ${start.toISOString()}::timestamptz and d.created_at <= ${end.toISOString()}::timestamptz) as documents_submitted,
        (select count(*) from public.help_requests hr where hr.organization_id = ${organization.id}::uuid and hr.status in ('open','in_progress')) as open_help_requests
    `),
    prisma.$queryRaw<Array<{ lead_temperature: string | null }>>(Prisma.sql`
      select c.lead_temperature
      from public.companies c
      where ${companyWhere}
    `),
    prisma.$queryRaw<Array<{ stage_name: string | null; stage_color: string | null }>>(Prisma.sql`
      select ps.name as stage_name, ps.color as stage_color
      from public.companies c
      left join public.pipeline_stages ps on ps.id = c.pipeline_stage_id
      where ${companyWhere}
    `),
    prisma.$queryRaw<Array<{ created_at: Date }>>(Prisma.sql`
      select c.created_at
      from public.companies c
      where ${companyWhere}
      order by c.created_at asc
    `),
    prisma.$queryRaw<Array<{ meeting_datetime: Date }>>(Prisma.sql`
      select i.meeting_datetime
      from public.interactions i
      where i.organization_id = ${organization.id}::uuid
        and i.status <> 'archived'
        and i.meeting_datetime >= ${start.toISOString()}::timestamptz
        and i.meeting_datetime <= ${end.toISOString()}::timestamptz
      order by i.meeting_datetime asc
    `),
  ]);

  const countRow = counts[0];
  const tempDist: Record<string, number> = { cold: 0, warm: 0, hot: 0, very_hot: 0 };
  for (const row of temperatureRows) {
    if (row.lead_temperature && row.lead_temperature in tempDist) {
      tempDist[row.lead_temperature] += 1;
    }
  }

  const stageDist: Record<string, { count: number; color: string }> = {};
  for (const row of stageRows) {
    const stageName = row.stage_name || "Unknown";
    const stageColor = row.stage_color || "#888";
    if (!stageDist[stageName]) {
      stageDist[stageName] = { count: 0, color: stageColor };
    }
    stageDist[stageName].count += 1;
  }

  const monthlyTrend: Record<string, number> = {};
  const currentMonth = new Date(start);
  while (currentMonth <= end) {
    const monthKey = currentMonth.toISOString().slice(0, 7);
    monthlyTrend[monthKey] = 0;
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }
  for (const row of monthlyRows) {
    const monthKey = row.created_at.toISOString().slice(0, 7);
    if (monthKey in monthlyTrend) monthlyTrend[monthKey] += 1;
  }

  const meetingTrend: Record<string, number> = {};
  for (const row of meetingRows) {
    const dateKey = row.meeting_datetime.toISOString().slice(0, 10);
    meetingTrend[dateKey] = (meetingTrend[dateKey] || 0) + 1;
  }

  return {
    totalCompanies: toNumber(countRow?.total_companies),
    newLeadsInPeriod: toNumber(countRow?.new_leads_in_period),
    hotLeads: toNumber(countRow?.hot_leads),
    veryHotLeads: toNumber(countRow?.very_hot_leads),
    pipelineValue: toNumber(countRow?.pipeline_value),
    wonDeals: toNumber(countRow?.won_deals),
    lostDeals: toNumber(countRow?.lost_deals),
    meetingsCompleted: toNumber(countRow?.meetings_completed),
    followupsDue: toNumber(countRow?.followups_due),
    overdueFollowups: toNumber(countRow?.overdue_followups),
    documentsSubmitted: toNumber(countRow?.documents_submitted),
    openHelpRequests: toNumber(countRow?.open_help_requests),
    leadTemperatureDistribution: Object.entries(tempDist).map(([temperature, count]) => ({ temperature, count })),
    pipelineStageDistribution: Object.entries(stageDist).map(([stage, data]) => ({ stage, ...data })),
    monthlyLeadCreationTrend: Object.entries(monthlyTrend).map(([month, count]) => ({ month, count })),
    meetingActivityTrend: Object.entries(meetingTrend).map(([date, count]) => ({ date, count })),
  };
}

export type LeadReportData = {
  leadsByIndustry: { industry: string; count: number }[];
  leadsByCategory: { category: string; count: number }[];
  leadsBySource: { source: string; count: number }[];
  leadsByAssignedUser: { user: string; count: number }[];
  hotLeads: any[];
  recentlyAddedLeads: any[];
  leadsWithoutFollowup: any[];
  leadsWithoutMeeting: any[];
};

export async function getLeadReport(filters: ReportFilters = {}): Promise<LeadReportData> {
  const organization = await requireOrganization();
  const { start, end } = buildDateRange(filters);
  const companyWhere = buildCompanyWhere(organization.id, filters);

  const leads = await prisma.$queryRaw<any[]>(Prisma.sql`
    select
      c.id::text as id,
      c.name,
      c.lead_source,
      c.lead_temperature,
      c.success_rating,
      c.estimated_value,
      c.created_at,
      case when i.id is null then null else jsonb_build_object('name', i.name) end as industries,
      case when cc.id is null then null else jsonb_build_object('name', cc.name) end as company_categories,
      case when ps.id is null then null else jsonb_build_object('name', ps.name, 'color', ps.color) end as pipeline_stages,
      case when p.id is null then null else jsonb_build_object('full_name', p.full_name, 'email', p.email) end as assigned_profile
    from public.companies c
    left join public.industries i on i.id = c.industry_id
    left join public.company_categories cc on cc.id = c.category_id
    left join public.pipeline_stages ps on ps.id = c.pipeline_stage_id
    left join public.profiles p on p.id = c.assigned_user_id
    where ${companyWhere}
  `);

  const industryMap: Record<string, number> = {};
  const categoryMap: Record<string, number> = {};
  const sourceMap: Record<string, number> = {};
  const userMap: Record<string, number> = {};

  leads.forEach((l: any) => {
    const industry = l.industries?.name || "Unassigned";
    industryMap[industry] = (industryMap[industry] || 0) + 1;

    const category = l.company_categories?.name || "Uncategorized";
    categoryMap[category] = (categoryMap[category] || 0) + 1;

    const source = l.lead_source || "Unknown";
    sourceMap[source] = (sourceMap[source] || 0) + 1;

    const user = l.assigned_profile?.full_name || l.assigned_profile?.email || "Unassigned";
    userMap[user] = (userMap[user] || 0) + 1;
  });

  const hotLeads = leads.filter((l: any) => l.lead_temperature === "hot" || l.lead_temperature === "very_hot");
  const recentlyAddedLeads = leads.filter((l: any) => {
    const created = new Date(l.created_at);
    return created >= start && created <= end;
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [leadsWithFollowups, leadsWithMeetings] = await Promise.all([
    prisma.$queryRaw<Array<{ company_id: string }>>(Prisma.sql`
      select distinct company_id::text as company_id
      from public.followups
      where organization_id = ${organization.id}::uuid
        and status <> 'archived'
        and created_at >= ${thirtyDaysAgo.toISOString()}::timestamptz
    `),
    prisma.$queryRaw<Array<{ company_id: string }>>(Prisma.sql`
      select distinct company_id::text as company_id
      from public.interactions
      where organization_id = ${organization.id}::uuid
        and status <> 'archived'
        and created_at >= ${thirtyDaysAgo.toISOString()}::timestamptz
    `),
  ]);

  const followupCompanyIds = new Set(leadsWithFollowups.map((f) => f.company_id));
  const meetingCompanyIds = new Set(leadsWithMeetings.map((m) => m.company_id));

  return {
    leadsByIndustry: Object.entries(industryMap).map(([industry, count]) => ({ industry, count })),
    leadsByCategory: Object.entries(categoryMap).map(([category, count]) => ({ category, count })),
    leadsBySource: Object.entries(sourceMap).map(([source, count]) => ({ source, count })),
    leadsByAssignedUser: Object.entries(userMap).map(([user, count]) => ({ user, count })),
    hotLeads,
    recentlyAddedLeads,
    leadsWithoutFollowup: leads.filter((l: any) => !followupCompanyIds.has(l.id)),
    leadsWithoutMeeting: leads.filter((l: any) => !meetingCompanyIds.has(l.id)),
  };
}

export type PipelineReportData = {
  companiesByStage: { stage: string; count: number; color: string }[];
  pipelineValueByStage: { stage: string; value: number; color: string }[];
  avgRatingByStage: { stage: string; avgRating: number }[];
  wonLostCount: { won: number; lost: number };
  stuckLeads: any[];
  negotiationStageLeads: any[];
};

export async function getPipelineReport(filters: ReportFilters = {}): Promise<PipelineReportData> {
  const organization = await requireOrganization();
  const companyWhere = buildCompanyWhere(organization.id, filters);

  const companies = await prisma.$queryRaw<any[]>(Prisma.sql`
    select
      c.id::text as id,
      c.estimated_value,
      c.success_rating,
      case when ps.id is null then null else jsonb_build_object(
        'id', ps.id,
        'name', ps.name,
        'color', ps.color,
        'is_won', ps.is_won,
        'is_lost', ps.is_lost,
        'position', ps.position
      ) end as pipeline_stages
    from public.companies c
    left join public.pipeline_stages ps on ps.id = c.pipeline_stage_id
    where ${companyWhere}
    order by ps.position asc nulls last
  `);

  const stageMap: Record<string, { count: number; value: number; color: string; ratings: number[] }> = {};
  let wonCount = 0;
  let lostCount = 0;

  companies.forEach((c: any) => {
    const stage = c.pipeline_stages;
    if (!stage) return;
    const stageName = stage.name;
    if (!stageMap[stageName]) {
      stageMap[stageName] = { count: 0, value: 0, color: stage.color || "#888", ratings: [] };
    }
    stageMap[stageName].count += 1;
    stageMap[stageName].value += Number(c.estimated_value || 0);
    if (c.success_rating) stageMap[stageName].ratings.push(Number(c.success_rating));
    if (stage.is_won) wonCount += 1;
    if (stage.is_lost) lostCount += 1;
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentInteractions = await prisma.$queryRaw<Array<{ company_id: string }>>(Prisma.sql`
    select distinct company_id::text as company_id
    from public.interactions
    where organization_id = ${organization.id}::uuid
      and status <> 'archived'
      and meeting_datetime >= ${thirtyDaysAgo.toISOString()}::timestamptz
  `);

  const recentCompanyIds = new Set(recentInteractions.map((i) => i.company_id));
  const stuckLeads = companies.filter((c: any) => !recentCompanyIds.has(c.id) && !c.pipeline_stages?.is_won && !c.pipeline_stages?.is_lost);
  const negotiationStageLeads = companies.filter((c: any) => {
    const stageName = c.pipeline_stages?.name?.toLowerCase() || "";
    return stageName.includes("negotiat") || stageName.includes("proposal");
  });

  return {
    companiesByStage: Object.entries(stageMap).map(([stage, data]) => ({ stage, count: data.count, color: data.color })),
    pipelineValueByStage: Object.entries(stageMap).map(([stage, data]) => ({ stage, value: data.value, color: data.color })),
    avgRatingByStage: Object.entries(stageMap)
      .filter(([, data]) => data.ratings.length > 0)
      .map(([stage, data]) => ({ stage, avgRating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length })),
    wonLostCount: { won: wonCount, lost: lostCount },
    stuckLeads,
    negotiationStageLeads,
  };
}

export type MeetingReportData = {
  totalMeetings: number;
  meetingsByType: { type: string; count: number }[];
  meetingsBySalesperson: { user: string; count: number }[];
  avgSuccessRating: number;
  hotMeetings: any[];
  meetingsWithNextAction: any[];
  meetingsWithoutFollowup: any[];
};

export async function getMeetingReport(filters: ReportFilters = {}): Promise<MeetingReportData> {
  const organization = await requireOrganization();
  const { start, end } = buildDateRange(filters);

  const meetings = await prisma.$queryRaw<any[]>(Prisma.sql`
    select
      i.id::text as id,
      i.meeting_datetime,
      i.interaction_type,
      i.success_rating,
      i.lead_temperature,
      i.next_action,
      i.next_followup_at,
      case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end as companies,
      case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name) end as contact_persons,
      case when p.id is null then null else jsonb_build_object('full_name', p.full_name, 'email', p.email) end as profiles
    from public.interactions i
    left join public.companies c on c.id = i.company_id
    left join public.contact_persons cp on cp.id = i.contact_person_id
    left join public.profiles p on p.id = i.created_by
    where i.organization_id = ${organization.id}::uuid
      and i.status <> 'archived'
      and i.meeting_datetime >= ${start.toISOString()}::timestamptz
      and i.meeting_datetime <= ${end.toISOString()}::timestamptz
    order by i.meeting_datetime desc
  `);

  const typeMap: Record<string, number> = {};
  const userMap: Record<string, number> = {};
  const ratings: number[] = [];

  meetings.forEach((m: any) => {
    typeMap[m.interaction_type] = (typeMap[m.interaction_type] || 0) + 1;
    const user = m.profiles?.full_name || m.profiles?.email || "Unknown";
    userMap[user] = (userMap[user] || 0) + 1;
    if (m.success_rating) ratings.push(Number(m.success_rating));
  });

  const meetingsWithFollowups = await prisma.$queryRaw<Array<{ interaction_id: string | null }>>(Prisma.sql`
    select interaction_id::text as interaction_id
    from public.followups
    where organization_id = ${organization.id}::uuid
      and status <> 'archived'
  `);
  const followupInteractionIds = new Set(meetingsWithFollowups.map((f) => f.interaction_id).filter(Boolean));

  return {
    totalMeetings: meetings.length,
    meetingsByType: Object.entries(typeMap).map(([type, count]) => ({ type, count })),
    meetingsBySalesperson: Object.entries(userMap).map(([user, count]) => ({ user, count })),
    avgSuccessRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    hotMeetings: meetings.filter((m: any) => m.lead_temperature === "hot" || m.lead_temperature === "very_hot"),
    meetingsWithNextAction: meetings.filter((m: any) => m.next_action),
    meetingsWithoutFollowup: meetings.filter((m: any) => !followupInteractionIds.has(m.id)),
  };
}

export type FollowupReportData = {
  todaysFollowups: any[];
  upcomingFollowups: any[];
  completedFollowups: any[];
  overdueFollowups: any[];
  completionRate: number;
  followupsByUser: { user: string; count: number }[];
  followupsByPriority: { priority: string; count: number }[];
  followupStatusDistribution: { status: string; count: number }[];
  followupCompletionTrend: { date: string; count: number }[];
};

export async function getFollowupReport(filters: ReportFilters = {}): Promise<FollowupReportData> {
  const organization = await requireOrganization();
  const { start, end } = buildDateRange(filters);

  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const followups = await prisma.$queryRaw<any[]>(Prisma.sql`
    select
      f.id::text as id,
      f.title,
      f.scheduled_at,
      f.completed_at,
      f.status,
      f.priority,
      f.followup_type,
      case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end as companies,
      case when ap.id is null then null else jsonb_build_object('full_name', ap.full_name, 'email', ap.email) end as assigned_profile,
      case when cp.id is null then null else jsonb_build_object('full_name', cp.full_name, 'email', cp.email) end as created_profile
    from public.followups f
    left join public.companies c on c.id = f.company_id
    left join public.profiles ap on ap.id = f.assigned_user_id
    left join public.profiles cp on cp.id = f.created_by
    where f.organization_id = ${organization.id}::uuid
      and f.status <> 'archived'
    order by f.scheduled_at asc
  `);

  const todaysFollowups = followups.filter((f: any) => {
    const sched = new Date(f.scheduled_at);
    return sched >= todayStart && sched <= todayEnd && f.status === "pending";
  });
  const upcomingFollowups = followups.filter((f: any) => {
    const sched = new Date(f.scheduled_at);
    return sched > todayEnd && sched <= end && f.status === "pending";
  });
  const completedFollowups = followups.filter((f: any) => {
    if (!f.completed_at) return false;
    const completed = new Date(f.completed_at);
    return completed >= start && completed <= end && f.status === "completed";
  });
  const overdueFollowups = followups.filter((f: any) => {
    const sched = new Date(f.scheduled_at);
    return sched < now && f.status === "pending";
  });

  const userMap: Record<string, number> = {};
  const priorityMap: Record<string, number> = {};
  const statusMap: Record<string, number> = {};
  const completionTrend: Record<string, number> = {};

  followups.forEach((f: any) => {
    const user = f.assigned_profile?.full_name || f.assigned_profile?.email || "Unassigned";
    userMap[user] = (userMap[user] || 0) + 1;
    priorityMap[f.priority] = (priorityMap[f.priority] || 0) + 1;
    statusMap[f.status] = (statusMap[f.status] || 0) + 1;
    if (f.completed_at) {
      const dateKey = new Date(f.completed_at).toISOString().slice(0, 10);
      completionTrend[dateKey] = (completionTrend[dateKey] || 0) + 1;
    }
  });

  const totalScheduled = followups.filter((f: any) => {
    const sched = new Date(f.scheduled_at);
    return sched >= start && sched <= end;
  }).length;
  const totalCompleted = completedFollowups.length;

  return {
    todaysFollowups,
    upcomingFollowups,
    completedFollowups,
    overdueFollowups,
    completionRate: totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0,
    followupsByUser: Object.entries(userMap).map(([user, count]) => ({ user, count })),
    followupsByPriority: Object.entries(priorityMap).map(([priority, count]) => ({ priority, count })),
    followupStatusDistribution: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    followupCompletionTrend: Object.entries(completionTrend).map(([date, count]) => ({ date, count })),
  };
}

export type DocumentReportData = {
  totalDocuments: number;
  documentsByType: { type: string; count: number }[];
  documentsByStatus: { status: string; count: number }[];
  documentsByUser: { user: string; count: number }[];
  recentDocuments: any[];
};

export async function getDocumentReport(filters: ReportFilters = {}): Promise<DocumentReportData> {
  const organization = await requireOrganization();
  const { start, end } = buildDateRange(filters);

  const documents = await prisma.$queryRaw<any[]>(Prisma.sql`
    select
      d.id::text as id,
      d.title,
      d.document_type,
      d.status,
      d.file_name,
      d.file_extension,
      d.file_size_mb,
      d.created_at,
      case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end as companies,
      case when up.id is null then null else jsonb_build_object('full_name', up.full_name, 'email', up.email) end as uploaded_profile
    from public.documents d
    left join public.companies c on c.id = d.company_id
    left join public.profiles up on up.id = d.uploaded_by
    where d.organization_id = ${organization.id}::uuid
      and d.status <> 'archived'
      and d.created_at >= ${start.toISOString()}::timestamptz
      and d.created_at <= ${end.toISOString()}::timestamptz
    order by d.created_at desc
  `);

  const typeMap: Record<string, number> = {};
  const statusMap: Record<string, number> = {};
  const userMap: Record<string, number> = {};

  documents.forEach((d: any) => {
    typeMap[d.document_type] = (typeMap[d.document_type] || 0) + 1;
    statusMap[d.status] = (statusMap[d.status] || 0) + 1;
    const user = d.uploaded_profile?.full_name || d.uploaded_profile?.email || "Unknown";
    userMap[user] = (userMap[user] || 0) + 1;
  });

  return {
    totalDocuments: documents.length,
    documentsByType: Object.entries(typeMap).map(([type, count]) => ({ type, count })),
    documentsByStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    documentsByUser: Object.entries(userMap).map(([user, count]) => ({ user, count })),
    recentDocuments: documents.slice(0, 20),
  };
}

export type HelpRequestReportData = {
  openHelpRequests: number;
  urgentHelpRequests: number;
  resolvedRequests: number;
  helpRequestsByType: { type: string; count: number }[];
  helpRequestsByAssignedUser: { user: string; count: number }[];
  helpRequestsByPriority: { priority: string; count: number }[];
  recentHelpRequests: any[];
};

export async function getHelpRequestReport(filters: ReportFilters = {}): Promise<HelpRequestReportData> {
  const organization = await requireOrganization();
  const { start, end } = buildDateRange(filters);

  const allRequests = await prisma.$queryRaw<any[]>(Prisma.sql`
    select
      hr.id::text as id,
      hr.title,
      hr.help_type,
      hr.priority,
      hr.status,
      hr.created_at,
      case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end as companies,
      case when rp.id is null then null else jsonb_build_object('full_name', rp.full_name, 'email', rp.email) end as requested_profile,
      case when ap.id is null then null else jsonb_build_object('full_name', ap.full_name, 'email', ap.email) end as assigned_profile
    from public.help_requests hr
    left join public.companies c on c.id = hr.company_id
    left join public.profiles rp on rp.id = hr.requested_by
    left join public.profiles ap on ap.id = hr.assigned_to
    where hr.organization_id = ${organization.id}::uuid
      and hr.status <> 'archived'
      and hr.created_at >= ${start.toISOString()}::timestamptz
      and hr.created_at <= ${end.toISOString()}::timestamptz
    order by hr.created_at desc
  `);

  const typeMap: Record<string, number> = {};
  const userMap: Record<string, number> = {};
  const priorityMap: Record<string, number> = {};
  let openCount = 0;
  let urgentCount = 0;
  let resolvedCount = 0;

  allRequests.forEach((r: any) => {
    typeMap[r.help_type] = (typeMap[r.help_type] || 0) + 1;
    priorityMap[r.priority] = (priorityMap[r.priority] || 0) + 1;
    const assignedUser = r.assigned_profile?.full_name || r.assigned_profile?.email || "Unassigned";
    userMap[assignedUser] = (userMap[assignedUser] || 0) + 1;
    if (r.status === "open" || r.status === "in_progress") openCount++;
    if (r.priority === "urgent") urgentCount++;
    if (r.status === "resolved") resolvedCount++;
  });

  return {
    openHelpRequests: openCount,
    urgentHelpRequests: urgentCount,
    resolvedRequests: resolvedCount,
    helpRequestsByType: Object.entries(typeMap).map(([type, count]) => ({ type, count })),
    helpRequestsByAssignedUser: Object.entries(userMap).map(([user, count]) => ({ user, count })),
    helpRequestsByPriority: Object.entries(priorityMap).map(([priority, count]) => ({ priority, count })),
    recentHelpRequests: allRequests.slice(0, 50),
  };
}

export type TeamPerformanceReportData = {
  teamStats: {
    userId: string;
    userName: string;
    userEmail: string;
    assignedCompanies: number;
    meetingsCreated: number;
    followupsCreated: number;
    followupsCompleted: number;
    overdueFollowups: number;
    documentsUploaded: number;
    helpRequestsCreated: number;
    helpRequestsResolved: number;
    hotLeadsManaged: number;
    pipelineValueManaged: number;
  }[];
};

export async function getTeamPerformanceReport(filters: ReportFilters = {}): Promise<TeamPerformanceReportData> {
  const organization = await requireOrganization();
  const companyWhere = buildCompanyWhere(organization.id, filters);

  const [profiles, companies, meetings, followups, documents, helpRequests] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; full_name: string | null; email: string }>>(Prisma.sql`
      select id::text as id, full_name, email
      from public.profiles
      where organization_id = ${organization.id}::uuid
    `),
    prisma.$queryRaw<Array<{ assigned_user_id: string | null; estimated_value: number | null; lead_temperature: string | null }>>(Prisma.sql`
      select assigned_user_id::text as assigned_user_id, estimated_value, lead_temperature
      from public.companies c
      where ${companyWhere}
    `),
    prisma.$queryRaw<Array<{ created_by: string | null }>>(Prisma.sql`
      select created_by::text as created_by
      from public.interactions
      where organization_id = ${organization.id}::uuid
        and status <> 'archived'
    `),
    prisma.$queryRaw<Array<{ assigned_user_id: string | null; status: string; created_by: string | null; scheduled_at: Date }>>(Prisma.sql`
      select assigned_user_id::text as assigned_user_id, status, created_by::text as created_by, scheduled_at
      from public.followups
      where organization_id = ${organization.id}::uuid
        and status <> 'archived'
    `),
    prisma.$queryRaw<Array<{ uploaded_by: string | null }>>(Prisma.sql`
      select uploaded_by::text as uploaded_by
      from public.documents
      where organization_id = ${organization.id}::uuid
        and status <> 'archived'
    `),
    prisma.$queryRaw<Array<{ requested_by: string | null; assigned_to: string | null; status: string }>>(Prisma.sql`
      select requested_by::text as requested_by, assigned_to::text as assigned_to, status
      from public.help_requests
      where organization_id = ${organization.id}::uuid
        and status <> 'archived'
    `),
  ]);

  const teamStats = profiles.map((profile) => {
    const userCompanies = companies.filter((c) => c.assigned_user_id === profile.id);
    const userMeetings = meetings.filter((m) => m.created_by === profile.id);
    const userFollowupsCreated = followups.filter((f) => f.created_by === profile.id);
    const userFollowupsCompleted = userFollowupsCreated.filter((f) => f.status === "completed");
    const userOverdueFollowups = userFollowupsCreated.filter((f) => f.status === "pending" && new Date(f.scheduled_at) < new Date());
    const userDocuments = documents.filter((d) => d.uploaded_by === profile.id);
    const userHelpRequestsCreated = helpRequests.filter((h) => h.requested_by === profile.id);
    const userHelpRequestsResolved = helpRequests.filter((h) => h.assigned_to === profile.id && h.status === "resolved");
    const userHotLeads = userCompanies.filter((c) => c.lead_temperature === "hot" || c.lead_temperature === "very_hot");
    const userPipelineValue = userCompanies.reduce((sum, c) => sum + Number(c.estimated_value || 0), 0);

    return {
      userId: profile.id,
      userName: profile.full_name || "Unknown",
      userEmail: profile.email,
      assignedCompanies: userCompanies.length,
      meetingsCreated: userMeetings.length,
      followupsCreated: userFollowupsCreated.length,
      followupsCompleted: userFollowupsCompleted.length,
      overdueFollowups: userOverdueFollowups.length,
      documentsUploaded: userDocuments.length,
      helpRequestsCreated: userHelpRequestsCreated.length,
      helpRequestsResolved: userHelpRequestsResolved.length,
      hotLeadsManaged: userHotLeads.length,
      pipelineValueManaged: userPipelineValue,
    };
  });

  return { teamStats };
}
