import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  LifeBuoy,
  Plus,
  TimerOff,
} from "lucide-react";
import { DashboardLeadTargetChart } from "@/components/dashboard/dashboard-visuals";
import { DashboardDateRangePicker } from "@/components/dashboard/dashboard-date-range-picker";
import { DashboardKPIs } from "@/components/dashboard/dashboard-kpis";
import { DashboardTargetManager } from "@/components/dashboard/dashboard-target-manager";
import { 
  ActivityRow, 
  AlertCard, 
  AnimatedHeader, 
  CompletedTaskRow,
  CompactEmptyState, 
  DashboardCard,
  PipelineFunnel,
  ProgressMetric,
  TaskRow,
} from "@/components/dashboard/dashboard-animations";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth/session";
import { getFollowups } from "@/lib/crm/followup-queries";
import { getHelpRequests, getOpenHelpRequestsCount } from "@/lib/crm/help-request-queries";
import { getDashboardCompletedTasks, getDashboardTodoTasks, getInteractions, getPipelineCompanies, getPipelineStagesForBoard, getPipelineSummary, type DashboardTodoTask } from "@/lib/crm/queries";
import type { Followup, HelpRequest, Interaction, PipelineBoardCompany, PipelineStage } from "@/lib/crm/types";
import { formatCurrency } from "@/lib/crm/utils";
import { getCurrentUserPerformanceSnapshot } from "@/lib/team/performance-queries";
import { formatDateTimeBD } from "@/lib/format/datetime";
import { getDisplayName } from "@/lib/utils";

type DashboardActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  href: string;
  tone: "emerald" | "blue" | "amber";
};

type DashboardCompletedTaskItem = {
  id: string;
  title: string;
  context: string;
  completedAtLabel: string;
  href: string;
  badge: string;
  tone: "emerald" | "blue" | "amber";
};

type DashboardAlertItem = {
  id: string;
  title: string;
  count: number;
  description: string;
  href: string;
  tone: "rose" | "amber" | "teal";
  icon: typeof TimerOff;
};

const DEFAULT_STAGE_COLORS = ["#16a34a", "#86efac", "#facc15", "#fb923c", "#f87171"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const profile = await getCurrentProfile();
  const displayName = getDisplayName(profile?.full_name, profile?.email, "there");

  const [
    pendingFollowups,
    helpRequests,
    pipelineCompanies,
    pipelineStages,
    interactions,
    safeOpenHelpRequestsCount,
    yesterdayFollowups,
    performanceSnapshot,
    completedTaskRecords,
    todoTaskRecords,
  ] = await Promise.all([
    getFollowups({ 
      status: "pending",
      dateStart: from,
      dateEnd: to
    }),
    getHelpRequests({
      dateFrom: from,
      dateTo: to
    }),
    getPipelineCompanies(),
    getPipelineStagesForBoard(),
    getInteractions({
      dateFrom: from,
      dateTo: to
    }),
    getSafeOpenHelpRequestsCount(),
    getFollowups({
      dateStart: new Date(new Date().setHours(0, 0, 0, 0) - 86400000).toISOString(),
      dateEnd: new Date(new Date().setHours(23, 59, 59, 999) - 86400000).toISOString(),
    }),
    getCurrentUserPerformanceSnapshot(),
    getDashboardCompletedTasks(
      from ?? new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      to
        ? new Date(new Date(to).setHours(23, 59, 59, 999)).toISOString()
        : new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
      { limit: 4 },
    ),
    getDashboardTodoTasks(
      from ?? new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      to
        ? new Date(new Date(to).setHours(23, 59, 59, 999)).toISOString()
        : new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
      { limit: 3 },
    ),
  ]);

  // Filter pipeline companies by date range if provided
  const filteredPipelineCompanies = from && to 
    ? pipelineCompanies.filter(c => {
        const created = new Date(c.created_at);
        return created >= new Date(from) && created <= new Date(to);
      })
    : pipelineCompanies;

  const pipelineSummary = await getPipelineSummary(filteredPipelineCompanies);
  const dateBounds = getDateBounds();

  // If custom dates provided, use them for bounds
  if (from && to) {
    dateBounds.start = new Date(from);
    dateBounds.end = new Date(to);
    dateBounds.end.setHours(23, 59, 59, 999);
  }

  // Calculate Trends
  const thisMonthStart = new Date(dateBounds.now.getFullYear(), dateBounds.now.getMonth(), 1);
  
  const currentPipelineValue = pipelineSummary.totalPipelineValue;
  const lastMonthPipelineValue = pipelineCompanies
    .filter(c => new Date(c.created_at) < thisMonthStart && !c.pipeline_stages?.is_won && !c.pipeline_stages?.is_lost)
    .reduce((sum, c) => sum + Number(c.estimated_value || 0), 0);
  
  const pipelineValueTrend = calculateTrend(currentPipelineValue, lastMonthPipelineValue);

  const currentActiveDeals = pipelineSummary.totalActiveDeals;
  const lastMonthActiveDeals = pipelineCompanies
    .filter(c => new Date(c.created_at) < thisMonthStart && !c.pipeline_stages?.is_won && !c.pipeline_stages?.is_lost)
    .length;
  
  const dealsTrend = calculateTrend(currentActiveDeals, lastMonthActiveDeals);

  const overdueFollowups = pendingFollowups.filter((followup) =>
    isBeforeDay(followup.scheduled_at, dateBounds.start),
  );
  const todaysFollowups = pendingFollowups.filter((followup) =>
    isWithinDateRange(followup.scheduled_at, dateBounds.start, dateBounds.end),
  );
  
  const followupsTrend = {
    value: Math.abs(todaysFollowups.length - yesterdayFollowups.length),
    isPositive: todaysFollowups.length >= yesterdayFollowups.length,
    label: "from yesterday"
  };

  const openHelpRequests = helpRequests.filter(
    (request) => request.status === "open" || request.status === "in_progress",
  );
  const openHelpRequestsCount = safeOpenHelpRequestsCount ?? openHelpRequests.length;

  const yesterdayHelpRequests = helpRequests.filter(request => {
    const createdDate = new Date(request.created_at);
    const yesterdayStart = new Date(dateBounds.start);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(dateBounds.end);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    return createdDate >= yesterdayStart && createdDate <= yesterdayEnd;
  });

  const helpTrend = {
    value: Math.abs(openHelpRequests.filter(r => isWithinDateRange(r.created_at, dateBounds.start, dateBounds.end)).length - yesterdayHelpRequests.length),
    isPositive: openHelpRequests.filter(r => isWithinDateRange(r.created_at, dateBounds.start, dateBounds.end)).length >= yesterdayHelpRequests.length,
    label: "from yesterday"
  };

  const tasks: DashboardTodoTask[] = todoTaskRecords;
  const completedTasks: DashboardCompletedTaskItem[] = completedTaskRecords
    .map((task) => ({
      ...task,
      completedAtLabel: buildCompletedTaskLabel(task.completedAt),
    }))
    .slice(0, 4);

  const totalDailyTarget = performanceSnapshot.metrics.reduce((sum, metric) => sum + metric.dailyTarget, 0);
  const totalDailyAchievement = performanceSnapshot.metrics.reduce((sum, metric) => sum + metric.dailyActual, 0);
  const dailyProgress = totalDailyTarget > 0
    ? Math.min(100, Math.round((totalDailyAchievement / totalDailyTarget) * 100))
    : 0;

  const selectedFunnelStages = selectFunnelStages(pipelineStages);
  const funnelStages = selectedFunnelStages.map((stage, index) => ({
    id: stage.id,
    name: stage.name,
    count: pipelineCompanies.filter((company) => company.pipeline_stage_id === stage.id).length,
    color: stage.color || DEFAULT_STAGE_COLORS[index % DEFAULT_STAGE_COLORS.length],
    width: Math.max(50, 100 - index * 12),
  }));

  const recentActivity = buildRecentActivity({
    companies: pipelineCompanies,
    interactions,
    helpRequests,
  });

  const stuckDealsCount = pipelineCompanies.filter((company) => {
    const isClosed = company.pipeline_stages?.is_won || company.pipeline_stages?.is_lost;
    if (isClosed || !company.last_interaction_at) {
      return false;
    }
    const ageMs = dateBounds.now.getTime() - new Date(company.last_interaction_at).getTime();
    return ageMs > 7 * 24 * 60 * 60 * 1000;
  }).length;

  const alertCards = [
    {
      id: "overdue-followups",
      title: "Overdue Follow-ups",
      count: overdueFollowups.length,
      description:
        overdueFollowups.length > 0
          ? `${overdueFollowups.length} follow-up${overdueFollowups.length === 1 ? "" : "s"} need immediate attention.`
          : "No overdue follow-ups are blocking the team right now.",
      href: "/followups",
      tone: "rose" as const,
      iconName: "TimerOff",
    },
    {
      id: "deals-stuck",
      title: "Deals Stuck",
      count: stuckDealsCount,
      description:
        stuckDealsCount > 0
          ? `${stuckDealsCount} active deal${stuckDealsCount === 1 ? "" : "s"} have been quiet for more than 7 days.`
          : "No active deals look stuck based on recent interaction history.",
      href: "/pipeline",
      tone: "amber" as const,
      iconName: "FolderKanban",
    },
    {
      id: "open-help-requests",
      title: "Open Help Requests",
      count: openHelpRequestsCount,
      description:
        openHelpRequestsCount > 0
          ? `${openHelpRequestsCount} support request${openHelpRequestsCount === 1 ? "" : "s"} still need follow-through.`
          : "No open support requests are waiting on the team.",
      href: "/need-help",
      tone: "teal" as const,
      iconName: "LifeBuoy",
    },
  ];

  const hasCriticalAlerts = alertCards.some((item) => item.count > 0);

  return (
    <div className="space-y-6">
      <AnimatedHeader data-tour="tour-dashboard-overview">
        <div className="space-y-1">
          <h1 className="text-[1.9rem] font-semibold tracking-normal text-slate-900 dark:text-slate-100 sm:text-[2.15rem]">
            Welcome back, {displayName} <span aria-hidden="true">{"\u{1F44B}"}</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Here&apos;s what&apos;s happening with your sales today.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <DashboardDateRangePicker />
          <Button asChild className="w-full rounded-full px-4 sm:w-auto">
            <Link href="/companies/new">
              <Plus />
              Add Lead
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-full px-4 sm:w-auto">
            <Link href="/meetings/new">Log Meeting</Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-full px-4 sm:w-auto">
            <Link href="/followups/new">Create Follow-up</Link>
          </Button>
        </div>
      </AnimatedHeader>

      <DashboardKPIs 
        pipelineValue={formatCurrency(pipelineSummary.totalPipelineValue)}
        pipelineValueTrend={{
          value: `${pipelineValueTrend.value}%`,
          isPositive: pipelineValueTrend.isPositive,
          label: "from last month",
        }}
        activeDeals={String(pipelineSummary.totalActiveDeals)}
        dealsTrend={{
          value: `${dealsTrend.value}%`,
          isPositive: dealsTrend.isPositive,
          label: "from last month",
        }}
        todaysFollowupsCount={String(todaysFollowups.length)}
        followupsTrend={followupsTrend}
        openHelpRequestsCount={String(openHelpRequestsCount)}
        helpTrend={helpTrend}
      />

      <section className="grid gap-5 md:grid-cols-3">
        {alertCards.map((alert, index) => (
          <AlertCard key={alert.id} alert={alert} index={index} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-3 items-start">
        <DashboardCard
          title={getTodoTasksTitle(from, to, dateBounds)}
          description="The next actions worth tackling first."
          actionHref={buildTodoTasksHref(from, to)}
          actionLabel="View all"
          className="h-full"
          contentClassName="pt-0 pb-2"
          delay={0.15}
        >
          {tasks.length === 0 ? (
            <CompactEmptyState
              title="You're all caught up for today."
              description="No overdue follow-ups, help requests, or upcoming meetings need attention right now."
            />
          ) : (
            <div className="space-y-2.5">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          title={getCompletedTasksTitle(from, to, dateBounds)}
          description="Completed meetings, follow-ups, and resolved help requests for this date range."
          actionHref={buildCompletedTasksHref(from, to)}
          actionLabel="View all"
          className="h-full"
          contentClassName="pt-0 pb-2"
          delay={0.18}
        >
          {completedTasks.length === 0 ? (
            <CompactEmptyState
              title="No completed tasks yet."
              description="Completed meetings, follow-ups, and resolved help requests for this date range will appear here."
            />
          ) : (
            <div className="space-y-2.5">
              {completedTasks.map((task) => (
                <CompletedTaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          title="Today's Achievement"
          description="Daily sales activity performance."
          headerRight={
            <div className="flex flex-col items-end">
              <span className="text-2xl font-bold text-emerald-600">{dailyProgress}%</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Performance
              </span>
            </div>
          }
          className="h-full"
          delay={0.2}
        >
          <div className="space-y-4">
            <ProgressMetric
              label="Leads added"
              value={performanceSnapshot.metrics.find((metric) => metric.metric === "leads_created")?.dailyActual ?? 0}
              target={performanceSnapshot.metrics.find((metric) => metric.metric === "leads_created")?.dailyTarget ?? 0}
              colorClassName="bg-emerald-500"
            />
            <ProgressMetric
              label="Meetings logged"
              value={performanceSnapshot.metrics.find((metric) => metric.metric === "meetings_logged")?.dailyActual ?? 0}
              target={performanceSnapshot.metrics.find((metric) => metric.metric === "meetings_logged")?.dailyTarget ?? 0}
              colorClassName="bg-sky-500"
            />
            <ProgressMetric
              label="Follow-ups completed"
              value={performanceSnapshot.metrics.find((metric) => metric.metric === "followups_completed")?.dailyActual ?? 0}
              target={performanceSnapshot.metrics.find((metric) => metric.metric === "followups_completed")?.dailyTarget ?? 0}
              colorClassName="bg-amber-500"
            />
          </div>
        </DashboardCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-3 items-start">
        <DashboardLeadTargetChart leadTrend={performanceSnapshot.trend} />
        <DashboardCard
          title="Pipeline Overview"
          description="Track deal progression through stages."
          headerRight={
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href="/pipeline">
                View Pipeline
                <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          }
          className="h-full"
          contentClassName="pt-4"
          delay={0.25}
        >
          <PipelineFunnel stages={funnelStages} />
        </DashboardCard>

        <DashboardCard
          title="Recent Activity"
          description="Latest leads and deal progression."
          actionHref="/pipeline"
          actionLabel="View all"
          className="h-full"
          contentClassName="pt-0"
        >
          {recentActivity.length === 0 ? (
            <CompactEmptyState
              title="No recent activity"
              description="Your team's latest actions will appear here."
            />
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item, index) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </DashboardCard>
      </section>

      {profile ? (
        <DashboardTargetManager userId={profile.id} metrics={performanceSnapshot.metrics} />
      ) : null}
    </div>
  );
}

async function getSafeOpenHelpRequestsCount() {
  try {
    return await getOpenHelpRequestsCount();
  } catch (error) {
    return null;
  }
}

function buildRecentActivity({
  companies,
  interactions,
  helpRequests,
}: {
  companies: PipelineBoardCompany[];
  interactions: Interaction[];
  helpRequests: HelpRequest[];
}): DashboardActivityItem[] {
  const companyItems = [...companies]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 3)
    .map((company, index) => ({
      id: `company-${company.id}`,
      title: `#${1023 - index} - ${company.name}`,
      subtitle: company.estimated_value ? `৳ ${company.estimated_value.toLocaleString()}` : "No value",
      badge: company.pipeline_stages?.name || "Lead",
      href: `/companies/${company.id}`,
      tone: "emerald" as const,
      createdAt: new Date(company.created_at).getTime(),
    }));

  return companyItems;
}

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return { value: current > 0 ? 100 : 0, isPositive: current > 0 };
  const diff = current - previous;
  const percentage = Math.round((diff / previous) * 100);
  return {
    value: Math.abs(percentage),
    isPositive: diff >= 0,
  };
}

function getDateBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end, now: new Date() };
}

function getDaysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - now.getDate());
}

function getFunnelGradient(color: string, index: number) {
  const gradients = [
    "linear-gradient(135deg, #0f8f73 0%, #16997d 45%, #0f7f69 100%)",
    "linear-gradient(135deg, #86df91 0%, #67cf77 45%, #4bb55f 100%)",
    "linear-gradient(135deg, #ffe37b 0%, #ffd85a 46%, #ffcb38 100%)",
    "linear-gradient(135deg, #ffc254 0%, #ffaf2d 48%, #ff9808 100%)",
    "linear-gradient(135deg, #ff6356 0%, #ff4739 46%, #ef2f26 100%)",
  ];

  return gradients[index] ?? `linear-gradient(135deg, ${color} 0%, ${color} 100%)`;
}

function selectFunnelStages(stages: PipelineStage[]) {
  const orderedStages = [...stages].sort((left, right) => left.position - right.position);
  const wonStage = orderedStages.find((stage) => stage.is_won);
  const candidates = [
    orderedStages.find((stage) => matchesStage(stage.name, ["new lead", "new", "lead"])),
    orderedStages.find((stage) => matchesStage(stage.name, ["contacted", "contact"])),
    orderedStages.find((stage) => matchesStage(stage.name, ["proposal", "requirement", "meeting done", "meeting scheduled"])),
    orderedStages.find((stage) => matchesStage(stage.name, ["negotiation"])),
    wonStage,
  ].filter(Boolean) as PipelineStage[];

  const uniqueCandidates = candidates.filter(
    (stage, index, array) => array.findIndex((item) => item.id === stage.id) === index,
  );

  if (uniqueCandidates.length >= Math.min(5, orderedStages.length)) {
    return uniqueCandidates.slice(0, 5);
  }

  for (const stage of orderedStages) {
    if (!uniqueCandidates.some((candidate) => candidate.id === stage.id)) {
      uniqueCandidates.push(stage);
    }
    if (uniqueCandidates.length === 5) {
      break;
    }
  }

  return uniqueCandidates.slice(0, 5);
}

function matchesStage(name: string, variants: string[]) {
  const normalized = name.toLowerCase();
  return variants.some((variant) => normalized.includes(variant));
}

function isWithinDateRange(value: string, start: Date, end: Date) {
  const time = new Date(value).getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function isBeforeDay(value: string, dayStart: Date) {
  return new Date(value).getTime() < dayStart.getTime();
}

function formatDateTime(value: string) {
  return formatDateTimeBD(value);
}

function buildCompletedTaskLabel(value: string) {
  return `Completed ${formatDateTime(value)}`;
}

function getCompletedTasksTitle(
  from: string | undefined,
  to: string | undefined,
  dateBounds: { start: Date; end: Date },
) {
  if (!from && !to) {
    return "Today's Completed Tasks";
  }

  if (!from || !to) {
    return "Completed Tasks";
  }

  const rangeStart = new Date(from);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(to);
  rangeEnd.setHours(23, 59, 59, 999);

  const isTodayRange =
    rangeStart.getTime() === dateBounds.start.getTime() &&
    rangeEnd.getTime() === dateBounds.end.getTime();

  return isTodayRange ? "Today's Completed Tasks" : "Completed Tasks";
}

function getTodoTasksTitle(
  from: string | undefined,
  to: string | undefined,
  dateBounds: { start: Date; end: Date },
) {
  if (!from && !to) {
    return "Today's Tasks To Do";
  }

  if (!from || !to) {
    return "Tasks To Do";
  }

  const rangeStart = new Date(from);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(to);
  rangeEnd.setHours(23, 59, 59, 999);

  const isTodayRange =
    rangeStart.getTime() === dateBounds.start.getTime() &&
    rangeEnd.getTime() === dateBounds.end.getTime();

  return isTodayRange ? "Today's Tasks To Do" : "Tasks To Do";
}

function buildCompletedTasksHref(from?: string, to?: string) {
  const params = new URLSearchParams();

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  const query = params.toString();
  return query ? `/dashboard/completed-tasks?${query}` : "/dashboard/completed-tasks";
}

function buildTodoTasksHref(from?: string, to?: string) {
  const params = new URLSearchParams();

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  const query = params.toString();
  return query ? `/dashboard/todo-tasks?${query}` : "/dashboard/todo-tasks";
}
