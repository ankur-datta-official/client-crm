import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  Info,
  LifeBuoy,
  Target,
  TrendingUp,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { DashboardDateRangePicker } from "@/components/dashboard/dashboard-date-range-picker";
import { ActivityRow, DashboardCard, StatusPill } from "@/components/dashboard/dashboard-animations";
import { TeamDashboardExportButton } from "@/components/dashboard/team-dashboard-export-button";
import { TeamDashboardMemberFilter } from "@/components/dashboard/team-dashboard-member-filter";
import {
  TeamActivityHeatmap,
  TeamMemberRankings,
  TeamPipelineStageChart,
} from "@/components/dashboard/team-dashboard-panels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/crm/utils";
import type { TeamDashboardData } from "@/lib/dashboard/team-dashboard";
import { getTeamDashboardActivityLabel } from "@/lib/dashboard/team-dashboard";

function buildTeamDashboardParams(data: TeamDashboardData) {
  const params = new URLSearchParams({
    from: data.range.from,
    to: data.range.to,
  });

  if (data.scope.selectedManagerId) {
    params.set("managerId", data.scope.selectedManagerId);
  }

  if (data.scope.selectedTeamId) {
    params.set("teamId", data.scope.selectedTeamId);
  }

  return params;
}

function buildMemberDashboardHref(memberId: string, data: TeamDashboardData) {
  const params = buildTeamDashboardParams(data);
  params.set("memberId", memberId);
  return `/team-dashboard?${params.toString()}`;
}

function buildMemberReportsHref(memberId: string, data: TeamDashboardData) {
  const params = buildScopedReportParams(data);
  params.set("assignedUserId", memberId);

  return `/reports?${params.toString()}`;
}

function buildDrilldownClearHref(data: TeamDashboardData) {
  const params = buildTeamDashboardParams(data);
  return `/team-dashboard?${params.toString()}`;
}

function buildScopedReportParams(data: TeamDashboardData) {
  const params = new URLSearchParams({
    tab: "team",
    from: data.range.from,
    to: data.range.to,
  });

  if (data.scope.selectedManagerId) {
    params.set("managerId", data.scope.selectedManagerId);
  }

  if (data.scope.selectedTeamId) {
    params.set("teamId", data.scope.selectedTeamId);
  }

  return params;
}

function buildTeamReportsHref(data: TeamDashboardData) {
  return `/reports?${buildScopedReportParams(data).toString()}`;
}

function MetricProgress({
  label,
  actual,
  target,
  achievement,
  colorClassName,
}: {
  label: string;
  actual: number;
  target: number;
  achievement: number;
  colorClassName: string;
}) {
  return (
    <div className="space-y-2.5 rounded-[18px] border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm shadow-slate-200/30 dark:border-slate-700/80 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{achievement}%</p>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span>{actual} / {target || 0}</span>
        <span>{target > 0 ? `${achievement}%` : "No target set"}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/80">
        <div className={cn("h-full rounded-full", colorClassName)} style={{ width: `${achievement}%` }} />
      </div>
    </div>
  );
}

function getKpiMeta(data: TeamDashboardData) {
  const cards: Array<{
    title: string;
    value: string;
    description: string;
    accent: string;
    accentTone: "emerald" | "rose" | "sky";
    tone: "blue" | "green" | "violet" | "orange" | "teal" | "rose";
    href?: string;
    icon: ReactNode;
  }> = [
    {
      title: "Pipeline Value",
      value: formatCurrency(data.kpis.pipelineValue),
      description: "Total estimated value",
      accent: "",
      accentTone: "emerald",
      tone: "blue",
      href: "/pipeline",
      icon: <TrendingUp className="size-5" />,
    },
    {
      title: "Active Deals",
      value: String(data.kpis.activeDeals),
      description: "Deals still in progress",
      accent: `${data.insights.newDealsCount} new deals in range`,
      accentTone: "emerald",
      tone: "green",
      href: "/pipeline",
      icon: <BriefcaseBusiness className="size-5" />,
    },
    {
      title: data.range.defaultedToMonth ? "Today's Follow-ups" : "Scoped Follow-ups",
      value: String(data.kpis.dueFollowups),
      description: "Tasks to complete",
      accent: "",
      accentTone: "sky",
      tone: "violet",
      href: "/followups",
      icon: <CalendarClock className="size-5" />,
    },
    {
      title: "Open Help Requests",
      value: String(data.kpis.openHelpRequests),
      description: "Needs support in scope",
      accent: "",
      accentTone: "sky",
      tone: "orange",
      href: "/need-help",
      icon: <LifeBuoy className="size-5" />,
    },
    {
      title: "Team Achievement",
      value: `${data.kpis.targetAchievement}%`,
      description: "Combined activity performance",
      accent: `${data.metrics.filter((metric) => metric.achievement >= 70).length} metrics above 70%`,
      accentTone: "emerald",
      tone: "teal",
      href: undefined,
      icon: <Target className="size-5" />,
    },
    {
      title: "Low Performer Alert",
      value: String(data.kpis.lowPerformerCount),
      description: "Members under threshold",
      accent: data.kpis.lowPerformerCount > 0 ? "Needs follow-up attention" : "No critical alert right now",
      accentTone: data.kpis.lowPerformerCount > 0 ? "rose" : "emerald",
      tone: "rose",
      href: undefined,
      icon: <AlertTriangle className="size-5" />,
    },
  ];
  const pipelineDelta = data.insights.pipelineValueChangePct;
  const overdueCount = data.alerts.find((alert) => alert.id === "overdue-followups")?.count ?? 0;
  const openHelpCount = data.alerts.find((alert) => alert.id === "open-help-requests")?.count ?? 0;

  cards[0].accent = pipelineDelta >= 0 ? `+${pipelineDelta}% from previous range` : `-${Math.abs(pipelineDelta)}% from previous range`;
  cards[0].accentTone = pipelineDelta >= 0 ? "emerald" : "rose";
  cards[2].accent = `${overdueCount} overdue follow-ups`;
  cards[2].accentTone = overdueCount > 0 ? "rose" : "sky";
  cards[3].accent = `${openHelpCount} still open`;
  cards[3].accentTone = openHelpCount > 0 ? "rose" : "sky";

  return cards;
}

export function TeamDashboardView({ data }: { data: TeamDashboardData }) {
  const rangeLabel = getTeamDashboardActivityLabel(data.range);
  const kpiCards = getKpiMeta(data);
  const visibleCount = data.scope.availableMembers.length;
  const selectedMember = data.scope.selectedMember;
  const showingCount = data.memberRows.length;
  const topPerformer = data.topPerformers[0];

  return (
    <div className="space-y-7 pb-2">
      <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_58%,#f1fff9_100%)] px-5 py-6 shadow-[0_18px_55px_-32px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,#0f172a_0%,#111827_58%,#052e2b_100%)] sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <h1 className="text-[2rem] font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-[2.2rem]">
                Team Performance Dashboard
              </h1>
              <Info className="size-4 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Track your team&apos;s progress and performance in real-time.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:max-w-[36rem] xl:items-end">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
              <DashboardDateRangePicker />
              <TeamDashboardMemberFilter
                options={data.scope.availableTeams.map((team) => ({
                  id: team.id,
                  name: team.label,
                  meta: `${team.memberCount} members`,
                }))}
                selectedValue={data.scope.selectedTeamId}
                queryParam="teamId"
                compact
                allLabel="All Teams"
              />
              <TeamDashboardMemberFilter
                options={data.scope.availableManagers.map((manager) => ({
                  id: manager.id,
                  name: manager.name,
                  meta: `${manager.reportCount} reports`,
                }))}
                selectedValue={data.scope.selectedManagerId}
                queryParam="managerId"
                compact
                allLabel="All Managers"
              />
              <TeamDashboardExportButton
                filters={{
                  from: data.range.from,
                  to: data.range.to,
                  managerId: data.scope.selectedManagerId,
                  teamId: data.scope.selectedTeamId,
                  memberId: data.scope.selectedMemberId,
                }}
                className="h-11 rounded-full border-emerald-200 bg-emerald-50 px-5 text-emerald-700 shadow-sm shadow-emerald-100/70 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-6">
        {kpiCards.map((card) => (
          <KpiCard
            key={card.title}
            title={card.title}
            value={card.value}
            description={card.description}
            accent={card.accent}
            accentTone={card.accentTone}
            tone={card.tone}
            href={card.href}
            icon={card.icon}
          />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.78fr)]">
        <DashboardCard
          title="Team Performance Overview"
          description=""
          actionHref={buildTeamReportsHref(data)}
          actionLabel="View all"
          className="flex h-full min-h-[430px] flex-col"
          contentClassName="flex flex-1 flex-col pt-0"
          delay={0.08}
        >
          {data.memberRows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-400">
              No visible team members matched the current scope.
            </div>
          ) : (
            <div className="flex h-full flex-1 flex-col">
              <div className="flex-1 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:border-slate-800 dark:text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Member</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 pr-4 font-medium">Leads<br /><span className="normal-case tracking-normal text-[10px] text-slate-400">(Target)</span></th>
                    <th className="pb-3 pr-4 font-medium">Meetings<br /><span className="normal-case tracking-normal text-[10px] text-slate-400">(Target)</span></th>
                    <th className="pb-3 pr-4 font-medium">Follow-ups<br /><span className="normal-case tracking-normal text-[10px] text-slate-400">(Target)</span></th>
                    <th className="pb-3 pr-4 font-medium">Deal Value</th>
                    <th className="pb-3 pr-4 font-medium">Achievement</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.memberRows.slice(0, 6).map((row) => (
                    <tr key={row.userId} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800/70">
                      <td className="py-3.5 pr-4 align-top">
                        <Link href={buildMemberDashboardHref(row.userId, data)} className="block transition-colors hover:text-primary">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{row.name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{row.roleName ?? row.email}</p>
                        </Link>
                      </td>
                      <td className="py-3.5 pr-4 align-top text-[13px] text-slate-600 dark:text-slate-300">{row.roleName ?? "Unassigned"}</td>
                      <td className="py-3.5 pr-4 align-top text-slate-700 dark:text-slate-200">
                        <div>{row.leadsCreated}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">({row.targetLeads})</div>
                      </td>
                      <td className="py-3.5 pr-4 align-top text-slate-700 dark:text-slate-200">
                        <div>{row.meetingsLogged}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">({row.targetMeetings})</div>
                      </td>
                      <td className="py-3.5 pr-4 align-top text-slate-700 dark:text-slate-200">
                        <div>{row.followupsCompleted}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">({row.targetFollowups})</div>
                      </td>
                      <td className="py-3.5 pr-4 align-top text-slate-700 dark:text-slate-200">{formatCurrency(row.dealValueManaged)}</td>
                      <td className="py-3.5 pr-4 align-top">
                        <div className="min-w-[108px]">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{row.actualTotal}/{row.targetTotal || 0}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{row.achievement}%</span>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                row.statusTone === "emerald" && "bg-emerald-500",
                                row.statusTone === "amber" && "bg-amber-500",
                                row.statusTone === "rose" && "bg-rose-500",
                                row.statusTone === "slate" && "bg-slate-400",
                              )}
                              style={{ width: `${row.achievement}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 align-top">
                        <StatusPill tone={row.statusTone === "slate" ? "blue" : row.statusTone}>
                          {row.statusLabel}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Showing 1 to {Math.min(showingCount, 6)} of {showingCount} members</span>
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900">&lt;</span>
                  <span className="flex size-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 font-semibold text-primary">1</span>
                  <span className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900">2</span>
                  <span className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900">&gt;</span>
                </div>
              </div>
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          title="Member Rankings"
          description=""
          actionHref={buildTeamReportsHref(data)}
          actionLabel="View all"
          className="flex h-full min-h-[430px] flex-col"
          contentClassName="flex flex-1 flex-col pt-0"
          delay={0.16}
        >
          <div className="flex flex-1 flex-col">
            <TeamMemberRankings topPerformers={data.topPerformers} lowPerformers={data.lowPerformers} />
          </div>
        </DashboardCard>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.08fr)_minmax(300px,0.9fr)_minmax(340px,1.04fr)] 2xl:auto-rows-fr">
        <DashboardCard
          title="Pipeline by Stage"
          description="Active deals grouped by current pipeline stage."
          actionHref="/pipeline"
          actionLabel="View all"
          className="flex h-full min-h-[290px] flex-col"
          contentClassName="flex flex-1 items-center pt-0"
          delay={0.18}
        >
          <TeamPipelineStageChart data={data.pipelineStageDistribution} />
        </DashboardCard>

        <DashboardCard
          title="Activity Heatmap"
          description="Quickly see which days your team is most active."
          actionHref={buildTeamReportsHref(data)}
          actionLabel="View all"
          className="flex h-full min-h-[290px] flex-col"
          contentClassName="flex flex-1 items-center pt-0"
          delay={0.2}
        >
          <TeamActivityHeatmap labels={data.activityHeatmap.labels} rows={data.activityHeatmap.rows} />
        </DashboardCard>

        <DashboardCard
          title="Target vs Achievement"
          description=""
          actionHref={buildTeamReportsHref(data)}
          actionLabel="View all"
          className="flex h-full min-h-[290px] flex-col"
          contentClassName="flex flex-1 flex-col justify-center space-y-3 pt-0"
          delay={0.22}
        >
          {data.metrics.map((metric, index) => (
            <MetricProgress
              key={metric.key}
              label={metric.label}
              actual={metric.actual}
              target={metric.target}
              achievement={metric.achievement}
              colorClassName={index === 0 ? "bg-blue-500" : index === 1 ? "bg-cyan-500" : "bg-violet-500"}
            />
          ))}
        </DashboardCard>

        <DashboardCard
          title="Recent Team Activity"
          description="Latest logged actions from this scope."
          actionHref={buildTeamReportsHref(data)}
          actionLabel="View all"
          className="flex h-full min-h-[290px] flex-col"
          contentClassName="flex flex-1 flex-col justify-start space-y-3 pt-0"
          delay={0.24}
        >
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity matched the current filters.</p>
          ) : (
            data.recentActivity.slice(0, 3).map((item) => (
              <ActivityRow key={item.id} item={{ ...item, badge: item.timeLabel, tone: "blue" }} />
            ))
          )}
        </DashboardCard>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-5 py-5 shadow-sm shadow-slate-200/40 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_repeat(4,minmax(0,1fr))]">
          <div className="flex h-full flex-col justify-center rounded-[24px] border border-slate-100 bg-white/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Team Insights</p>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              A quick view of the trends that matter most for managers and higher authority roles.
            </p>
          </div>
          <InsightStat icon={<TrendingUp className="size-4" />} value={`${data.insights.pipelineValueChangePct}%`} label="Pipeline value change" sublabel="vs previous range" tone="emerald" />
          <InsightStat icon={<BriefcaseBusiness className="size-4" />} value={String(data.insights.newDealsCount)} label="New deals created" sublabel="inside selected range" tone="blue" />
          <InsightStat icon={<AlertTriangle className="size-4" />} value={String(data.insights.membersNeedAttention)} label="Members need attention" sublabel="based on achievement" tone="orange" />
          <InsightStat icon={<Trophy className="size-4" />} value={data.insights.topPerformerName ?? "No data"} label="Top performer" sublabel={data.insights.topPerformerName ? `${data.insights.topPerformerAchievement}% achievement` : "No target-backed member yet"} tone="violet" />
        </div>
      </section>

      {data.detailMember ? (
        <DashboardCard
          title={`${data.detailMember.name} Member Drilldown`}
          description="Focused snapshot for the selected teammate."
          headerRight={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <Link href={buildDrilldownClearHref(data)}>Clear filter</Link>
              </Button>
              <Button asChild className="rounded-full">
                <Link href={buildMemberReportsHref(data.detailMember.userId, data)}>
                  Open detailed report
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          }
          className="h-fit"
          contentClassName="pt-0"
          delay={0.28}
        >
          <div className="grid gap-4 md:grid-cols-4">
            <DrilldownStat label="Achievement" value={`${data.detailMember.achievement}%`} helper={`${data.detailMember.actualTotal}/${data.detailMember.targetTotal || 0} performance score`} />
            <DrilldownStat label="Active Deals" value={String(data.detailMember.activeDeals)} helper={`${formatCurrency(data.detailMember.dealValueManaged)} managed value`} />
            <DrilldownStat label="Help Requests" value={String(data.detailMember.openHelpRequests)} helper="currently unresolved in scope" />
            <DrilldownStat label="Documents" value={String(data.detailMember.documentsUploaded)} helper="uploaded during selected range" />
          </div>
        </DashboardCard>
      ) : null}

      <div className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {selectedMember ? `Filtered to ${selectedMember.name} | ${rangeLabel}` : `Showing ${visibleCount} visible members | ${rangeLabel}`}
      </div>
    </div>
  );
}

function DrilldownStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200/90 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 dark:border-slate-700/80 dark:bg-slate-950/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 text-[1.8rem] font-semibold tracking-tight text-slate-950 dark:text-slate-100">{value}</p>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  );
}

function InsightStat({
  icon,
  value,
  label,
  sublabel,
  tone,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  sublabel: string;
  tone: "emerald" | "blue" | "orange" | "violet";
}) {
  const toneClasses = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  };

  return (
    <div className="flex h-full items-start gap-3 rounded-[24px] border border-slate-100 bg-white/80 px-4 py-4 shadow-sm shadow-slate-200/25 dark:border-slate-800 dark:bg-slate-950/35">
      <span className={cn("mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl", toneClasses[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-100">{value}</p>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{label}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sublabel}</p>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  description,
  accent,
  accentTone,
  tone,
  href,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  accent: string;
  accentTone: "emerald" | "rose" | "sky";
  tone: "blue" | "green" | "violet" | "orange" | "teal" | "rose";
  href?: string;
  icon: ReactNode;
}) {
  const toneClasses = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    green: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  };

  const accentClasses = {
    emerald: "text-emerald-600 dark:text-emerald-300",
    rose: "text-rose-600 dark:text-rose-300",
    sky: "text-sky-600 dark:text-sky-300",
  };

  const content = (
    <div className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_32px_-18px_rgba(15,23,42,0.2)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400">{title}</p>
          <p className="mt-3 text-[1.95rem] font-semibold leading-none tracking-tight text-slate-950 dark:text-slate-100">{value}</p>
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", toneClasses[tone])}>
          {icon}
        </span>
      </div>
      <p className="mt-5 text-[13px] text-slate-500 dark:text-slate-400">{description}</p>
      <p className={cn("mt-2 text-[12px] font-medium", accentClasses[accentTone])}>{accent}</p>
    </div>
  );

  if (!href) {
    return content;
  }

  return <Link href={href} className="block">{content}</Link>;
}
