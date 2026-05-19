import "server-only";

import { Prisma } from "@prisma/client";
import { hasPermission, requireAuth, requireOrganization } from "@/lib/auth/session";
import { formatDateTimeBD, formatMonthDayBD } from "@/lib/format/datetime";
import { prisma } from "@/lib/prisma";
import { getTeamMembers } from "@/lib/team/team-queries";
import type { TeamMember } from "@/lib/team/types";

type ViewerMode = "self" | "team";

type ScopedMemberOption = {
  id: string;
  name: string;
  email: string;
  roleName: string | null;
  roleSlug: string | null;
  department: string | null;
  managerUserId: string | null;
};

export type TeamDashboardManagerOption = {
  id: string;
  name: string;
  email: string;
  reportCount: number;
};

export type TeamDashboardTeamOption = {
  id: string;
  label: string;
  memberCount: number;
};

type CompanyRow = {
  id: string;
  assigned_user_id: string | null;
  created_by: string | null;
  estimated_value: Prisma.Decimal | number | string | null;
  created_at: Date;
  is_won: boolean | null;
  is_lost: boolean | null;
  pipeline_stage_name: string | null;
  last_interaction_at: Date | null;
};

type InteractionRow = {
  id: string;
  created_by: string | null;
  assigned_user_id: string | null;
  meeting_datetime: Date;
};

type FollowupRow = {
  id: string;
  created_by: string | null;
  assigned_user_id: string | null;
  completed_by: string | null;
  status: string;
  scheduled_at: Date;
  completed_at: Date | null;
};

type DocumentRow = {
  id: string;
  uploaded_by: string | null;
  created_at: Date | null;
};

type HelpRequestRow = {
  id: string;
  requested_by: string | null;
  assigned_to: string | null;
  resolved_by: string | null;
  status: string | null;
  created_at: Date | null;
};

type ActivityLogRow = {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: Date;
};

type PerformanceTargetRow = {
  id: string;
  user_id: string;
  metric_key: TeamDashboardMetricKey;
  period_type: "daily" | "monthly";
  target_value: number;
  effective_date: string;
};

type TeamDashboardMetricKey = "leads_created" | "meetings_logged" | "followups_completed";

type TeamMetricSummary = {
  key: TeamDashboardMetricKey;
  label: string;
  actual: number;
  target: number;
  achievement: number;
};

export type TeamDashboardScope = {
  viewerMode: ViewerMode;
  currentUserId: string;
  visibleUserIds: string[];
  selectedUserIds: string[];
  selectedManagerId: string | null;
  selectedTeamId: string | null;
  selectedMemberId: string | null;
  selectedMember: ScopedMemberOption | null;
  availableMembers: ScopedMemberOption[];
  availableManagers: TeamDashboardManagerOption[];
  availableTeams: TeamDashboardTeamOption[];
  canFilterAllMembers: boolean;
};

export type TeamDashboardFilters = {
  from?: string;
  to?: string;
  managerId: string | null;
  teamId: string | null;
  memberId: string | null;
};

export type TeamDashboardMemberRow = {
  userId: string;
  name: string;
  email: string;
  roleName: string | null;
  roleSlug: string | null;
  leadsCreated: number;
  meetingsLogged: number;
  followupsCompleted: number;
  dealValueManaged: number;
  activeDeals: number;
  openHelpRequests: number;
  documentsUploaded: number;
  targetLeads: number;
  targetMeetings: number;
  targetFollowups: number;
  targetTotal: number;
  actualTotal: number;
  achievement: number;
  statusLabel: "Good" | "Average" | "Needs Attention" | "No Target";
  statusTone: "emerald" | "amber" | "rose" | "slate";
};

export type TeamDashboardAlert = {
  id: string;
  title: string;
  count: number;
  description: string;
  href: string;
  tone: "rose" | "amber" | "blue" | "emerald";
};

export type TeamDashboardActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  timeLabel: string;
};

export type TeamDashboardPipelineStagePoint = {
  name: string;
  count: number;
  color: string;
};

export type TeamDashboardHeatmapCell = {
  key: string;
  label: string;
  shortLabel: string;
  count: number;
  intensity: number;
};

export type TeamDashboardHeatmapRow = {
  userId: string;
  name: string;
  cells: TeamDashboardHeatmapCell[];
};

export type TeamDashboardInsights = {
  pipelineValueChangePct: number;
  newDealsCount: number;
  membersNeedAttention: number;
  topPerformerName: string | null;
  topPerformerAchievement: number;
};

export type TeamDashboardData = {
  scope: TeamDashboardScope;
  range: {
    from: string;
    to: string;
    defaultedToMonth: boolean;
  };
  kpis: {
    pipelineValue: number;
    activeDeals: number;
    dueFollowups: number;
    openHelpRequests: number;
    targetAchievement: number;
    lowPerformerCount: number;
  };
  metrics: TeamMetricSummary[];
  memberRows: TeamDashboardMemberRow[];
  topPerformers: TeamDashboardMemberRow[];
  lowPerformers: TeamDashboardMemberRow[];
  alerts: TeamDashboardAlert[];
  recentActivity: TeamDashboardActivityItem[];
  pipelineStageDistribution: TeamDashboardPipelineStagePoint[];
  activityHeatmap: {
    labels: string[];
    rows: TeamDashboardHeatmapRow[];
  };
  insights: TeamDashboardInsights;
  detailMember: TeamDashboardMemberRow | null;
};

const TEAM_METRIC_LABELS: Record<TeamDashboardMetricKey, string> = {
  leads_created: "Leads Created",
  meetings_logged: "Meetings Logged",
  followups_completed: "Follow-ups Completed",
};

const LOW_PERFORMER_THRESHOLD = 50;
const HEATMAP_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const STAGE_COLORS = ["#2f80ed", "#49d29a", "#ffd166", "#b06df9", "#2dc7c9", "#ff8a4c", "#fb7185"];

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildScopedMembers(members: TeamMember[]) {
  return members
    .filter((member) => member.is_active)
    .map<ScopedMemberOption>((member) => ({
      id: member.id,
      name: member.full_name ?? member.email,
      email: member.email,
      roleName: member.role_name ?? null,
      roleSlug: member.role_slug ?? null,
      department: member.department ?? null,
      managerUserId: member.manager_user_id ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function collectDescendantIds(currentUserId: string, members: ScopedMemberOption[]) {
  const directByManager = new Map<string, ScopedMemberOption[]>();

  for (const member of members) {
    if (!member.managerUserId) {
      continue;
    }

    const bucket = directByManager.get(member.managerUserId) ?? [];
    bucket.push(member);
    directByManager.set(member.managerUserId, bucket);
  }

  const seen = new Set<string>();
  const queue = [...(directByManager.get(currentUserId) ?? [])];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || seen.has(next.id)) {
      continue;
    }

    seen.add(next.id);

    for (const child of directByManager.get(next.id) ?? []) {
      if (!seen.has(child.id)) {
        queue.push(child);
      }
    }
  }

  return Array.from(seen);
}

function resolveRange(inputFrom?: string, inputTo?: string, fallbackToMonth = false) {
  if (inputFrom && inputTo) {
    const from = startOfDay(new Date(inputFrom));
    const to = endOfDay(new Date(inputTo));
    return {
      from,
      to,
      defaultedToMonth: false,
      fromParam: inputFrom,
      toParam: inputTo,
    };
  }

  const now = new Date();
  if (fallbackToMonth) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from,
      to: endOfDay(now),
      defaultedToMonth: true,
      fromParam: from.toISOString().slice(0, 10),
      toParam: now.toISOString().slice(0, 10),
    };
  }

  const from = startOfDay(now);
  return {
    from,
    to: endOfDay(now),
    defaultedToMonth: true,
    fromParam: from.toISOString().slice(0, 10),
    toParam: now.toISOString().slice(0, 10),
  };
}

function normalizeDateParam(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeScopedId(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeTeamDashboardFilters(input: {
  from?: string | null;
  to?: string | null;
  managerId?: string | null;
  teamId?: string | null;
  memberId?: string | null;
}): TeamDashboardFilters {
  const from = normalizeDateParam(input.from);
  const to = normalizeDateParam(input.to);

  return {
    from: from && to ? from : undefined,
    to: from && to ? to : undefined,
    managerId: normalizeScopedId(input.managerId),
    teamId: normalizeScopedId(input.teamId),
    memberId: normalizeScopedId(input.memberId),
  };
}

function formatStatus(achievement: number, targetTotal: number): TeamDashboardMemberRow["statusLabel"] {
  if (targetTotal <= 0) {
    return "No Target";
  }

  if (achievement >= 80) {
    return "Good";
  }

  if (achievement >= LOW_PERFORMER_THRESHOLD) {
    return "Average";
  }

  return "Needs Attention";
}

function getStatusTone(statusLabel: TeamDashboardMemberRow["statusLabel"]) {
  switch (statusLabel) {
    case "Good":
      return "emerald" as const;
    case "Average":
      return "amber" as const;
    case "Needs Attention":
      return "rose" as const;
    default:
      return "slate" as const;
  }
}

function resolveTargetValue(
  targets: PerformanceTargetRow[],
  metric: TeamDashboardMetricKey,
  periodType: "daily" | "monthly",
  pointDate: Date,
) {
  const pointTime = startOfDay(pointDate).getTime();

  return targets
    .filter((target) => target.metric_key === metric && target.period_type === periodType)
    .filter((target) => startOfDay(new Date(target.effective_date)).getTime() <= pointTime)
    .sort((left, right) => new Date(right.effective_date).getTime() - new Date(left.effective_date).getTime())[0]?.target_value ?? 0;
}

function buildMetricTargetTotals(
  targetsByUser: Map<string, PerformanceTargetRow[]>,
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const userTargets = targetsByUser.get(userId) ?? [];
  const totals: Record<TeamDashboardMetricKey, number> = {
    leads_created: 0,
    meetings_logged: 0,
    followups_completed: 0,
  };

  for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor.setDate(cursor.getDate() + 1)) {
    const pointDate = new Date(cursor);

    (Object.keys(TEAM_METRIC_LABELS) as TeamDashboardMetricKey[]).forEach((metric) => {
      const dailyTarget = resolveTargetValue(userTargets, metric, "daily", pointDate);
      if (dailyTarget > 0) {
        totals[metric] += dailyTarget;
        return;
      }

      const monthlyTarget = resolveTargetValue(userTargets, metric, "monthly", pointDate);
      if (monthlyTarget > 0) {
        totals[metric] += monthlyTarget / daysInMonth(pointDate);
      }
    });
  }

  return {
    leads_created: Math.round(totals.leads_created),
    meetings_logged: Math.round(totals.meetings_logged),
    followups_completed: Math.round(totals.followups_completed),
  };
}

function buildEntityHref(entityType: string | null, entityId: string | null) {
  if (!entityType || !entityId) {
    return "/dashboard";
  }

  switch (entityType) {
    case "company":
      return `/companies/${entityId}`;
    case "interaction":
      return `/meetings/${entityId}`;
    case "followup":
      return `/followups/${entityId}`;
    case "help_request":
      return `/need-help/${entityId}`;
    case "document":
      return `/documents/${entityId}`;
    default:
      return "/dashboard";
  }
}

function formatActivityAction(action: string) {
  return action
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildUuidJoin(ids: string[]) {
  return Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
}

function getPreviousRange(currentFrom: Date, currentTo: Date) {
  const diff = currentTo.getTime() - currentFrom.getTime();
  const previousTo = new Date(currentFrom.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - diff);

  return {
    from: startOfDay(previousFrom),
    to: endOfDay(previousTo),
  };
}

function buildHeatmapRows(input: {
  memberRows: TeamDashboardMemberRow[];
  companies: CompanyRow[];
  interactions: InteractionRow[];
  followups: FollowupRow[];
  documents: DocumentRow[];
}) {
  const countsByUser = new Map<string, number[]>();

  for (const row of input.memberRows) {
    countsByUser.set(row.userId, Array.from({ length: 7 }, () => 0));
  }

  const bump = (userId: string | null | undefined, date: Date | null | undefined) => {
    if (!userId || !date) {
      return;
    }

    const bucket = countsByUser.get(userId);
    if (!bucket) {
      return;
    }

    bucket[date.getDay()] += 1;
  };

  for (const company of input.companies) {
    bump(company.created_by, company.created_at);
  }

  for (const interaction of input.interactions) {
    bump(interaction.created_by, interaction.meeting_datetime);
  }

  for (const followup of input.followups) {
    bump(followup.completed_by ?? followup.created_by, followup.completed_at ?? followup.scheduled_at);
  }

  for (const document of input.documents) {
    bump(document.uploaded_by, document.created_at);
  }

  return input.memberRows.slice(0, 5).map<TeamDashboardHeatmapRow>((row) => {
    const counts = countsByUser.get(row.userId) ?? Array.from({ length: 7 }, () => 0);
    const rowMax = Math.max(...counts, 0);

    return {
      userId: row.userId,
      name: row.name,
      cells: counts.map((count, index) => ({
        key: `${row.userId}-${index}`,
        label: `${row.name} on ${HEATMAP_DAY_LABELS[index]}`,
        shortLabel: HEATMAP_DAY_LABELS[index],
        count,
        intensity: rowMax > 0 ? count / rowMax : 0,
      })),
    };
  });
}

function buildManagerOptions(members: ScopedMemberOption[]) {
  const reportCountByManager = new Map<string, number>();
  const memberById = new Map(members.map((member) => [member.id, member] as const));

  for (const member of members) {
    if (!member.managerUserId || !memberById.has(member.managerUserId)) {
      continue;
    }

    reportCountByManager.set(member.managerUserId, (reportCountByManager.get(member.managerUserId) ?? 0) + 1);
  }

  return Array.from(reportCountByManager.entries())
    .map<TeamDashboardManagerOption>(([id, reportCount]) => {
      const manager = memberById.get(id)!;
      return {
        id,
        name: manager.name,
        email: manager.email,
        reportCount,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildTeamOptions(members: ScopedMemberOption[]) {
  const countByDepartment = new Map<string, number>();

  for (const member of members) {
    const department = member.department?.trim();
    if (!department) {
      continue;
    }

    countByDepartment.set(department, (countByDepartment.get(department) ?? 0) + 1);
  }

  return Array.from(countByDepartment.entries())
    .map<TeamDashboardTeamOption>(([label, memberCount]) => ({
      id: label,
      label,
      memberCount,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export async function resolveTeamDashboardScope(input: TeamDashboardFilters): Promise<TeamDashboardScope> {
  const user = await requireAuth();
  const [canManageAll, canManageHierarchy, canViewActivity, canManageTargets, members] = await Promise.all([
    hasPermission("settings.manage"),
    hasPermission("team.manage_hierarchy"),
    hasPermission("team.view_activity"),
    hasPermission("team.manage_targets"),
    getTeamMembers(),
  ]);

  const scopedMembers = buildScopedMembers(members);
  const currentUserMember = scopedMembers.find((member) => member.id === user.id) ?? null;
  const canSeeManagedTeam = canManageHierarchy || canViewActivity || canManageTargets;

  let viewerMode: ViewerMode = "self";
  let baseVisibleMembers: ScopedMemberOption[] = currentUserMember ? [currentUserMember] : [];
  let canFilterAllMembers = false;

  if (canManageAll) {
    viewerMode = "team";
    baseVisibleMembers = scopedMembers;
    canFilterAllMembers = true;
  } else if (canSeeManagedTeam) {
    const descendantIds = collectDescendantIds(user.id, scopedMembers);
    if (descendantIds.length > 0) {
      viewerMode = "team";
      baseVisibleMembers = scopedMembers.filter((member) => descendantIds.includes(member.id));
    }
  }

  const availableManagers = buildManagerOptions(baseVisibleMembers);
  const availableTeams = buildTeamOptions(baseVisibleMembers);

  let filteredMembers = baseVisibleMembers;
  const selectedManagerId = availableManagers.some((manager) => manager.id === input.managerId) ? input.managerId : null;
  if (selectedManagerId) {
    const managerScopedIds = new Set<string>([
      selectedManagerId,
      ...collectDescendantIds(selectedManagerId, baseVisibleMembers),
    ]);
    filteredMembers = filteredMembers.filter((member) => managerScopedIds.has(member.id));
  }

  const selectedTeamId = availableTeams.some((team) => team.id === input.teamId) ? input.teamId : null;
  if (selectedTeamId) {
    filteredMembers = filteredMembers.filter((member) => member.department?.trim() === selectedTeamId);
  }

  const availableMembers = filteredMembers;
  const selectedMember = availableMembers.find((member) => member.id === input.memberId) ?? null;

  return {
    viewerMode,
    currentUserId: user.id,
    visibleUserIds: availableMembers.map((member) => member.id),
    selectedUserIds: selectedMember ? [selectedMember.id] : availableMembers.map((member) => member.id),
    selectedManagerId,
    selectedTeamId,
    selectedMemberId: selectedMember?.id ?? null,
    selectedMember,
    availableMembers,
    availableManagers,
    availableTeams,
    canFilterAllMembers,
  };
}

export async function getTeamDashboardData(
  scope: TeamDashboardScope,
  filters: Pick<TeamDashboardFilters, "from" | "to">,
): Promise<TeamDashboardData> {
  const organization = await requireOrganization();
  const range = resolveRange(filters.from, filters.to, true);
  const previousRange = getPreviousRange(range.from, range.to);
  const scopedMembers = scope.availableMembers.filter((member) => scope.selectedUserIds.includes(member.id));

  const emptyMetrics = (Object.keys(TEAM_METRIC_LABELS) as TeamDashboardMetricKey[]).map((key) => ({
    key,
    label: TEAM_METRIC_LABELS[key],
    actual: 0,
    target: 0,
    achievement: 0,
  }));

  if (scope.selectedUserIds.length === 0 || scopedMembers.length === 0) {
    return {
      scope,
      range: {
        from: range.fromParam,
        to: range.toParam,
        defaultedToMonth: range.defaultedToMonth,
      },
      kpis: {
        pipelineValue: 0,
        activeDeals: 0,
        dueFollowups: 0,
        openHelpRequests: 0,
        targetAchievement: 0,
        lowPerformerCount: 0,
      },
      metrics: emptyMetrics,
      memberRows: [],
      topPerformers: [],
      lowPerformers: [],
      alerts: [],
      recentActivity: [],
      pipelineStageDistribution: [],
      activityHeatmap: {
        labels: HEATMAP_DAY_LABELS,
        rows: [],
      },
      insights: {
        pipelineValueChangePct: 0,
        newDealsCount: 0,
        membersNeedAttention: 0,
        topPerformerName: null,
        topPerformerAchievement: 0,
      },
      detailMember: null,
    };
  }

  const selectedUserIdsSql = buildUuidJoin(scope.selectedUserIds);
  const [companies, previousCompanies, interactions, followups, documents, helpRequests, targets, activityLogs] = await Promise.all([
    prisma.$queryRaw<CompanyRow[]>(Prisma.sql`
      select
        c.id::text as id,
        c.assigned_user_id::text as assigned_user_id,
        c.created_by::text as created_by,
        c.estimated_value,
        c.created_at,
        ps.is_won,
        ps.is_lost,
        ps.name as pipeline_stage_name,
        latest_interaction.last_interaction_at
      from public.companies c
      left join public.pipeline_stages ps
        on ps.id = c.pipeline_stage_id
      left join lateral (
        select max(i.meeting_datetime) as last_interaction_at
        from public.interactions i
        where i.organization_id = c.organization_id
          and i.company_id = c.id
          and i.status <> 'archived'
      ) latest_interaction on true
      where c.organization_id = ${organization.id}::uuid
        and c.status <> 'archived'
        and (
          c.assigned_user_id in (${selectedUserIdsSql})
          or c.created_by in (${selectedUserIdsSql})
        )
        and c.created_at >= ${range.from}
        and c.created_at <= ${range.to}
    `),
    prisma.$queryRaw<CompanyRow[]>(Prisma.sql`
      select
        c.id::text as id,
        c.assigned_user_id::text as assigned_user_id,
        c.created_by::text as created_by,
        c.estimated_value,
        c.created_at,
        ps.is_won,
        ps.is_lost,
        ps.name as pipeline_stage_name,
        null::timestamp as last_interaction_at
      from public.companies c
      left join public.pipeline_stages ps
        on ps.id = c.pipeline_stage_id
      where c.organization_id = ${organization.id}::uuid
        and c.status <> 'archived'
        and (
          c.assigned_user_id in (${selectedUserIdsSql})
          or c.created_by in (${selectedUserIdsSql})
        )
        and c.created_at >= ${previousRange.from}
        and c.created_at <= ${previousRange.to}
    `),
    prisma.$queryRaw<InteractionRow[]>(Prisma.sql`
      select
        i.id::text as id,
        i.created_by::text as created_by,
        i.assigned_user_id::text as assigned_user_id,
        i.meeting_datetime
      from public.interactions i
      where i.organization_id = ${organization.id}::uuid
        and i.status <> 'archived'
        and (
          i.created_by in (${selectedUserIdsSql})
          or i.assigned_user_id in (${selectedUserIdsSql})
        )
        and i.meeting_datetime >= ${range.from}
        and i.meeting_datetime <= ${range.to}
    `),
    prisma.$queryRaw<FollowupRow[]>(Prisma.sql`
      select
        f.id::text as id,
        f.created_by::text as created_by,
        f.assigned_user_id::text as assigned_user_id,
        f.completed_by::text as completed_by,
        f.status,
        f.scheduled_at,
        f.completed_at
      from public.followups f
      where f.organization_id = ${organization.id}::uuid
        and f.status <> 'archived'
        and (
          f.created_by in (${selectedUserIdsSql})
          or f.assigned_user_id in (${selectedUserIdsSql})
          or f.completed_by in (${selectedUserIdsSql})
        )
        and (
          (f.completed_at is not null and f.completed_at >= ${range.from} and f.completed_at <= ${range.to})
          or (f.completed_at is null and f.scheduled_at >= ${range.from} and f.scheduled_at <= ${range.to})
          or (f.status = 'pending' and f.scheduled_at < ${range.from})
        )
    `),
    prisma.$queryRaw<DocumentRow[]>(Prisma.sql`
      select
        d.id::text as id,
        d.uploaded_by::text as uploaded_by,
        d.created_at
      from public.documents d
      where d.organization_id = ${organization.id}::uuid
        and d.status <> 'archived'
        and d.uploaded_by in (${selectedUserIdsSql})
        and d.created_at >= ${range.from}
        and d.created_at <= ${range.to}
    `),
    prisma.$queryRaw<HelpRequestRow[]>(Prisma.sql`
      select
        hr.id::text as id,
        hr.requested_by::text as requested_by,
        hr.assigned_to::text as assigned_to,
        hr.resolved_by::text as resolved_by,
        hr.status,
        hr.created_at
      from public.help_requests hr
      where hr.organization_id = ${organization.id}::uuid
        and hr.status <> 'archived'
        and (
          hr.requested_by in (${selectedUserIdsSql})
          or hr.assigned_to in (${selectedUserIdsSql})
          or hr.resolved_by in (${selectedUserIdsSql})
        )
        and hr.created_at >= ${range.from}
        and hr.created_at <= ${range.to}
    `),
    prisma.$queryRaw<PerformanceTargetRow[]>(Prisma.sql`
      select
        upt.id::text as id,
        upt.user_id::text as user_id,
        upt.metric_key,
        upt.period_type,
        upt.target_value,
        upt.effective_date::text as effective_date
      from public.user_performance_targets upt
      where upt.organization_id = ${organization.id}::uuid
        and upt.user_id in (${selectedUserIdsSql})
        and upt.effective_date <= ${range.to.toISOString().slice(0, 10)}::date
      order by upt.effective_date desc
    `),
    prisma.$queryRaw<ActivityLogRow[]>(Prisma.sql`
      select
        al.id::text as id,
        al.actor_user_id::text as actor_user_id,
        actor.full_name as actor_name,
        actor.email as actor_email,
        al.action,
        al.entity_type,
        al.entity_id::text as entity_id,
        al.created_at
      from public.activity_logs al
      left join public.profiles actor
        on actor.id = al.actor_user_id
      where al.organization_id = ${organization.id}::uuid
        and al.actor_user_id in (${selectedUserIdsSql})
        and al.created_at >= ${range.from}
        and al.created_at <= ${range.to}
      order by al.created_at desc
      limit 5
    `),
  ]);

  const targetsByUser = new Map<string, PerformanceTargetRow[]>();
  for (const target of targets) {
    const bucket = targetsByUser.get(target.user_id) ?? [];
    bucket.push(target);
    targetsByUser.set(target.user_id, bucket);
  }

  const memberRows = scopedMembers.map<TeamDashboardMemberRow>((member) => {
    const leadsCreated = companies.filter((company) => company.created_by === member.id).length;
    const meetingsLogged = interactions.filter((interaction) => interaction.created_by === member.id).length;
    const followupsCompleted = followups.filter(
      (followup) => followup.completed_by === member.id && followup.status === "completed",
    ).length;
    const assignedCompanies = companies.filter((company) => company.assigned_user_id === member.id);
    const activeDeals = assignedCompanies.filter((company) => !company.is_won && !company.is_lost).length;
    const dealValueManaged = assignedCompanies
      .filter((company) => !company.is_won && !company.is_lost)
      .reduce((sum, company) => sum + toNumber(company.estimated_value), 0);
    const openHelpRequests = helpRequests.filter(
      (helpRequest) => helpRequest.assigned_to === member.id && helpRequest.status !== "resolved",
    ).length;
    const documentsUploaded = documents.filter((document) => document.uploaded_by === member.id).length;
    const targetTotals = buildMetricTargetTotals(targetsByUser, member.id, range.from, range.to);
    const targetTotal = targetTotals.leads_created + targetTotals.meetings_logged + targetTotals.followups_completed;
    const actualTotal = leadsCreated + meetingsLogged + followupsCompleted;
    const achievement = targetTotal > 0 ? clampPercent((actualTotal / targetTotal) * 100) : 0;
    const statusLabel = formatStatus(achievement, targetTotal);

    return {
      userId: member.id,
      name: member.name,
      email: member.email,
      roleName: member.roleName,
      roleSlug: member.roleSlug,
      leadsCreated,
      meetingsLogged,
      followupsCompleted,
      dealValueManaged,
      activeDeals,
      openHelpRequests,
      documentsUploaded,
      targetLeads: targetTotals.leads_created,
      targetMeetings: targetTotals.meetings_logged,
      targetFollowups: targetTotals.followups_completed,
      targetTotal,
      actualTotal,
      achievement,
      statusLabel,
      statusTone: getStatusTone(statusLabel),
    };
  });

  const metrics = (Object.keys(TEAM_METRIC_LABELS) as TeamDashboardMetricKey[]).map<TeamMetricSummary>((key) => {
    const actual = memberRows.reduce((sum, row) => {
      if (key === "leads_created") return sum + row.leadsCreated;
      if (key === "meetings_logged") return sum + row.meetingsLogged;
      return sum + row.followupsCompleted;
    }, 0);
    const target = memberRows.reduce((sum, row) => {
      if (key === "leads_created") return sum + row.targetLeads;
      if (key === "meetings_logged") return sum + row.targetMeetings;
      return sum + row.targetFollowups;
    }, 0);

    return {
      key,
      label: TEAM_METRIC_LABELS[key],
      actual,
      target,
      achievement: target > 0 ? clampPercent((actual / target) * 100) : 0,
    };
  });

  const activeCompanies = companies.filter((company) => !company.is_won && !company.is_lost);
  const dueFollowups = followups.filter(
    (followup) => followup.status === "pending" && followup.scheduled_at >= range.from && followup.scheduled_at <= range.to,
  ).length;
  const openHelpRequests = helpRequests.filter((request) => request.status === "open" || request.status === "in_progress").length;
  const lowPerformers = memberRows
    .filter((row) => row.targetTotal > 0 && row.achievement < LOW_PERFORMER_THRESHOLD)
    .sort((left, right) => left.achievement - right.achievement || left.name.localeCompare(right.name));
  const topPerformers = [...memberRows]
    .filter((row) => row.targetTotal > 0)
    .sort((left, right) => right.achievement - left.achievement || right.dealValueManaged - left.dealValueManaged)
    .slice(0, 5);

  const stageMap = new Map<string, number>();
  for (const company of activeCompanies) {
    const stageName = company.pipeline_stage_name?.trim() || "Open";
    stageMap.set(stageName, (stageMap.get(stageName) ?? 0) + 1);
  }

  const pipelineStageDistribution = Array.from(stageMap.entries())
    .map<TeamDashboardPipelineStagePoint>(([name, count], index) => ({
      name,
      count,
      color: STAGE_COLORS[index % STAGE_COLORS.length],
    }))
    .sort((left, right) => right.count - left.count);

  const alerts: TeamDashboardAlert[] = [
    {
      id: "overdue-followups",
      title: "Overdue Follow-ups",
      count: followups.filter((followup) => followup.status === "pending" && followup.scheduled_at < new Date()).length,
      description: "Pending follow-ups that already crossed their scheduled time.",
      href: "/followups",
      tone: "rose",
    },
    {
      id: "stuck-deals",
      title: "Deals stuck > 7 days",
      count: activeCompanies.filter((company) => {
        if (!company.last_interaction_at) {
          return true;
        }

        return new Date().getTime() - company.last_interaction_at.getTime() > 7 * 24 * 60 * 60 * 1000;
      }).length,
      description: "Active deals with no recent meeting activity in the last week.",
      href: "/pipeline",
      tone: "amber",
    },
    {
      id: "no-activity",
      title: "No activity today",
      count: memberRows.filter((row) => {
        const today = startOfDay(new Date()).getTime();
        const memberHasActivityToday =
          companies.some((company) => company.created_by === row.userId && startOfDay(company.created_at).getTime() === today)
          || interactions.some((interaction) => interaction.created_by === row.userId && startOfDay(interaction.meeting_datetime).getTime() === today)
          || followups.some((followup) => followup.completed_by === row.userId && followup.completed_at && startOfDay(followup.completed_at).getTime() === today);

        return !memberHasActivityToday;
      }).length,
      description: "Members with no lead, meeting, or follow-up completion recorded today.",
      href: "/reports?tab=team",
      tone: "blue",
    },
    {
      id: "open-help-requests",
      title: "Open help requests",
      count: openHelpRequests,
      description: "Support requests in scope that still need follow-through.",
      href: "/need-help",
      tone: "emerald",
    },
  ];

  const recentActivity = activityLogs.map<TeamDashboardActivityItem>((item) => ({
    id: item.id,
    title: item.actor_name ?? item.actor_email ?? "Unknown teammate",
    subtitle: `${formatActivityAction(item.action)}${item.entity_type ? ` on ${item.entity_type.replaceAll("_", " ")}` : ""}`,
    href: buildEntityHref(item.entity_type, item.entity_id),
    timeLabel: formatDateTimeBD(item.created_at.toISOString()),
  }));

  const totalActual = metrics.reduce((sum, metric) => sum + metric.actual, 0);
  const totalTarget = metrics.reduce((sum, metric) => sum + metric.target, 0);
  const currentPipelineValue = activeCompanies.reduce((sum, company) => sum + toNumber(company.estimated_value), 0);
  const previousPipelineValue = previousCompanies
    .filter((company) => !company.is_won && !company.is_lost)
    .reduce((sum, company) => sum + toNumber(company.estimated_value), 0);
  const pipelineValueChangePct = previousPipelineValue > 0
    ? Math.round(((currentPipelineValue - previousPipelineValue) / previousPipelineValue) * 1000) / 10
    : currentPipelineValue > 0 ? 100 : 0;

  return {
    scope,
    range: {
      from: range.fromParam,
      to: range.toParam,
      defaultedToMonth: range.defaultedToMonth,
    },
    kpis: {
      pipelineValue: currentPipelineValue,
      activeDeals: activeCompanies.length,
      dueFollowups,
      openHelpRequests,
      targetAchievement: totalTarget > 0 ? clampPercent((totalActual / totalTarget) * 100) : 0,
      lowPerformerCount: lowPerformers.length,
    },
    metrics,
    memberRows,
    topPerformers,
    lowPerformers: lowPerformers.slice(0, 5),
    alerts,
    recentActivity,
    pipelineStageDistribution,
    activityHeatmap: {
      labels: HEATMAP_DAY_LABELS,
      rows: buildHeatmapRows({
        memberRows,
        companies,
        interactions,
        followups,
        documents,
      }),
    },
    insights: {
      pipelineValueChangePct,
      newDealsCount: companies.length,
      membersNeedAttention: lowPerformers.length,
      topPerformerName: topPerformers[0]?.name ?? null,
      topPerformerAchievement: topPerformers[0]?.achievement ?? 0,
    },
    detailMember: scope.selectedMemberId ? memberRows.find((row) => row.userId === scope.selectedMemberId) ?? null : null,
  };
}

export function getTeamDashboardActivityLabel(range: { from: string; to: string; defaultedToMonth: boolean }) {
  if (range.defaultedToMonth) {
    return "This Month";
  }

  if (range.from === range.to) {
    return formatMonthDayBD(range.from);
  }

  return `${formatMonthDayBD(range.from)} - ${formatMonthDayBD(range.to)}`;
}
