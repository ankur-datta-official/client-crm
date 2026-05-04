"use client";

import Link from "next/link";
import type React from "react";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  BriefcaseBusiness,
  CalendarClock,
  Flame,
  MoreHorizontal,
  Search,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { markCompanyLost, markCompanyWon, moveCompanyToPipelineStage } from "@/lib/crm/actions";
import { formatCurrency } from "@/lib/crm/utils";
import type { PipelineBoardCompany, PipelineBoardData, PipelineBoardSummary, PipelineStage } from "@/lib/crm/types";
import { cn, getDisplayName } from "@/lib/utils";

type PipelineBoardProps = PipelineBoardData;

type FilterState = {
  search: string;
  assigned: string;
  industry: string;
  category: string;
  temperature: string;
  priority: string;
  dateFrom: string;
  dateTo: string;
};

type FeedbackState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

const initialFilters: FilterState = {
  search: "",
  assigned: "",
  industry: "",
  category: "",
  temperature: "",
  priority: "",
  dateFrom: "",
  dateTo: "",
};

const INITIAL_STAGE_CARD_LIMIT = 4;

export function PipelineBoard({
  stages,
  companies: initialCompanies,
  teamMembers,
  industries,
  categories,
}: PipelineBoardProps) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [draggingCompanyId, setDraggingCompanyId] = useState<string | null>(null);
  const [hoverStageId, setHoverStageId] = useState<string | null>(null);
  const [expandedStageIds, setExpandedStageIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const stageMap = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);
  const wonStage = useMemo(() => stages.find((stage) => stage.is_won), [stages]);
  const lostStage = useMemo(() => stages.find((stage) => stage.is_lost), [stages]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      if (filters.search) {
        const search = filters.search.trim().toLowerCase();
        if (!company.name.toLowerCase().includes(search)) {
          return false;
        }
      }

      if (filters.assigned && company.assigned_user_id !== filters.assigned) {
        return false;
      }

      if (filters.industry && company.industry_id !== filters.industry) {
        return false;
      }

      if (filters.category && company.category_id !== filters.category) {
        return false;
      }

      if (filters.temperature && company.lead_temperature !== filters.temperature) {
        return false;
      }

      if (filters.priority && company.priority !== filters.priority) {
        return false;
      }

      if (filters.dateFrom) {
        if (!company.expected_closing_date || company.expected_closing_date < filters.dateFrom) {
          return false;
        }
      }

      if (filters.dateTo) {
        if (!company.expected_closing_date || company.expected_closing_date > filters.dateTo) {
          return false;
        }
      }

      return true;
    });
  }, [companies, filters]);

  const summary = useMemo(() => calculatePipelineSummary(filteredCompanies), [filteredCompanies]);
  const stageGroups = useMemo(() => groupCompaniesByStage(filteredCompanies, stages), [filteredCompanies, stages]);
  const hasAnyCompanies = companies.length > 0;
  const hasFilteredCompanies = filteredCompanies.length > 0;
  const hasUnassignedCompanies = stageGroups.some((group) => group.stage.id === "unassigned");

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(initialFilters);
  }

  function toggleStageExpansion(stageId: string) {
    setExpandedStageIds((current) =>
      current.includes(stageId) ? current.filter((id) => id !== stageId) : [...current, stageId],
    );
  }

  function applyStageLocally(currentCompanies: PipelineBoardCompany[], companyId: string, targetStage: PipelineStage) {
    return currentCompanies.map((company) =>
      company.id === companyId
        ? {
            ...company,
            pipeline_stage_id: targetStage.id,
            pipeline_stages: {
              id: targetStage.id,
              name: targetStage.name,
              color: targetStage.color,
              probability: targetStage.probability,
              is_won: targetStage.is_won,
              is_lost: targetStage.is_lost,
            },
            updated_at: new Date().toISOString(),
          }
        : company,
    );
  }

  function moveCompany(companyId: string, targetStageId: string, source: "drag" | "action") {
    const targetStage = stageMap.get(targetStageId);
    if (!targetStage) {
      setFeedback({ tone: "error", message: "That pipeline stage is no longer available." });
      return;
    }

    const currentCompany = companies.find((company) => company.id === companyId);
    if (!currentCompany || currentCompany.pipeline_stage_id === targetStageId) {
      return;
    }

    const previousCompanies = companies;
    setCompanies((current) => applyStageLocally(current, companyId, targetStage));
    setHoverStageId(null);
    setDraggingCompanyId(null);
    setFeedback(null);

    startTransition(async () => {
      const result = await moveCompanyToPipelineStage(companyId, targetStageId);
      if (!result.ok) {
        setCompanies(previousCompanies);
        setFeedback({
          tone: "error",
          message: result.error ?? "Unable to move the deal right now.",
        });
        return;
      }

      setFeedback({
        tone: "success",
        message:
          source === "drag"
            ? `${currentCompany.name} moved to ${targetStage.name}.`
            : `${currentCompany.name} updated to ${targetStage.name}.`,
      });
    });
  }

  function moveToOutcome(companyId: string, outcome: "won" | "lost") {
    const targetStage = outcome === "won" ? wonStage : lostStage;
    if (!targetStage) {
      setFeedback({
        tone: "error",
        message: `No active ${outcome === "won" ? "Won" : "Lost"} stage is configured for this workspace.`,
      });
      return;
    }

    const currentCompany = companies.find((company) => company.id === companyId);
    if (!currentCompany || currentCompany.pipeline_stage_id === targetStage.id) {
      return;
    }

    const previousCompanies = companies;
    setCompanies((current) => applyStageLocally(current, companyId, targetStage));
    setFeedback(null);

    startTransition(async () => {
      const result = outcome === "won" ? await markCompanyWon(companyId) : await markCompanyLost(companyId);
      if (!result.ok) {
        setCompanies(previousCompanies);
        setFeedback({
          tone: "error",
          message: result.error ?? `Unable to move the deal to ${outcome}.`,
        });
        return;
      }

      setFeedback({
        tone: "success",
        message: `${currentCompany.name} moved to ${targetStage.name}.`,
      });
    });
  }

  if (stages.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pipeline"
          description="Track deals by stage, monitor value, and move opportunities through the sales process."
          actions={
            <Button asChild variant="outline">
              <Link href="/settings/pipeline">Configure stages</Link>
            </Button>
          }
        />
        <EmptyState
          title="No pipeline stages found"
          description="Configure your sales stages in Settings before using the pipeline board."
          icon={ArrowRightLeft}
          actionLabel="Open Pipeline Settings"
          actionHref="/settings/pipeline"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Move deals across stages, spot bottlenecks, and keep follow-up momentum visible for the whole workspace."
        actions={
          <Button asChild>
            <Link href="/companies/new">Add Company</Link>
          </Button>
        }
      />
      <GuidanceStrip dismissible storageKey="crm-tip-pipeline">
        Drag a deal card into the next stage when progress happens, or use the actions menu to log a meeting, add a follow-up, or mark it won or lost.
      </GuidanceStrip>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total Pipeline Value"
          value={formatCurrency(summary.totalPipelineValue)}
          description="Open deal value across the filtered board"
          icon={<BdtIcon />}
          tone="emerald"
        />
        <SummaryCard
          title="Active Deals"
          value={String(summary.totalActiveDeals)}
          description="Deals not yet won or lost"
          icon={<BriefcaseBusiness className="size-5" />}
          tone="sky"
        />
        <SummaryCard
          title="Hot / Very Hot"
          value={String(summary.hotLeads)}
          description="High-temperature deals needing momentum"
          icon={<Flame className="size-5" />}
          tone="amber"
        />
        <SummaryCard
          title="Won Deals"
          value={String(summary.wonDeals)}
          description="Filtered deals already moved to won"
          icon={<Trophy className="size-5" />}
          tone="violet"
        />
        <SummaryCard
          title="Overdue Follow-ups"
          value={String(summary.overdueFollowups)}
          description="Deals with overdue next actions"
          icon={<CalendarClock className="size-5" />}
          tone="rose"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Board Filters</CardTitle>
          <CardDescription>Focus on assigned deals, lead quality, and expected closing windows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterInput
              label="Search company"
              placeholder="Search by company name"
              value={filters.search}
              onChange={(value) => updateFilter("search", value)}
              icon={<Search className="size-4 text-muted-foreground" />}
            />
            <FilterSelect
              label="Assigned user"
              value={filters.assigned}
              options={teamMembers.map((member) => ({
                value: member.id,
                label: getDisplayName(member.full_name, member.email, member.email),
              }))}
              onChange={(value) => updateFilter("assigned", value)}
            />
            <FilterSelect
              label="Industry"
              value={filters.industry}
              options={industries.map((industry) => ({ value: industry.id, label: industry.name }))}
              onChange={(value) => updateFilter("industry", value)}
            />
          </div>
          <details>
            <summary className="cursor-pointer list-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              More filters
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FilterSelect
                label="Company category"
                value={filters.category}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                onChange={(value) => updateFilter("category", value)}
              />
              <FilterSelect
                label="Lead temperature"
                value={filters.temperature}
                options={[
                  { value: "cold", label: "Cold" },
                  { value: "warm", label: "Warm" },
                  { value: "hot", label: "Hot" },
                  { value: "very_hot", label: "Very Hot" },
                ]}
                onChange={(value) => updateFilter("temperature", value)}
              />
              <FilterSelect
                label="Priority"
                value={filters.priority}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "urgent", label: "Urgent" },
                ]}
                onChange={(value) => updateFilter("priority", value)}
              />
              <FilterInput
                label="Closing from"
                type="date"
                value={filters.dateFrom}
                onChange={(value) => updateFilter("dateFrom", value)}
              />
              <FilterInput
                label="Closing to"
                type="date"
                value={filters.dateTo}
                onChange={(value) => updateFilter("dateTo", value)}
              />
            </div>
          </details>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
            <p className="text-sm text-muted-foreground">
              Showing {filteredCompanies.length} of {companies.length} deals
            </p>
            {isPending ? <p className="text-sm text-muted-foreground">Saving pipeline update...</p> : null}
          </div>
        </CardContent>
      </Card>

      {feedback ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {!hasAnyCompanies ? (
        <EmptyState
          title="No deals in your pipeline yet"
          description="Add your first company or lead to begin tracking movement across the sales stages."
          icon={Target}
          actionLabel="Add your first company or lead"
          actionHref="/companies/new"
        />
      ) : !hasFilteredCompanies ? (
        <EmptyState
          title="No deals match these filters"
          description="Adjust the filters to see more opportunities on the pipeline board."
          icon={Search}
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : null}

      <section className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <div className="flex min-h-[32rem] min-w-max items-start gap-4 p-4">
            {stageGroups.map((group) => (
              (() => {
                const isExpanded = expandedStageIds.includes(group.stage.id);
                const visibleCompanies =
                  group.companies.length > INITIAL_STAGE_CARD_LIMIT && !isExpanded
                    ? group.companies.slice(0, INITIAL_STAGE_CARD_LIMIT)
                    : group.companies;

                return (
                  <PipelineColumn
                    key={group.stage.id}
                    stage={group.stage}
                    companies={group.companies}
                    visibleCount={visibleCompanies.length}
                    isExpanded={isExpanded}
                    isHovering={hoverStageId === group.stage.id}
                    canDrop={group.stage.id !== "unassigned"}
                    onToggleExpanded={() => toggleStageExpansion(group.stage.id)}
                    onDragOver={() => {
                      if (group.stage.id !== "unassigned") {
                        setHoverStageId(group.stage.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (hoverStageId === group.stage.id) {
                        setHoverStageId(null);
                      }
                    }}
                    onDrop={() => {
                      if (draggingCompanyId && group.stage.id !== "unassigned") {
                        moveCompany(draggingCompanyId, group.stage.id, "drag");
                      }
                    }}
                  >
                    {group.companies.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        No deals in this stage yet. Move a deal here from another column or add a new lead to start the process.
                      </div>
                    ) : (
                      visibleCompanies.map((company) => (
                        <PipelineDealCard
                          key={company.id}
                          company={company}
                          isDragging={draggingCompanyId === company.id}
                          wonStageId={wonStage?.id ?? null}
                          lostStageId={lostStage?.id ?? null}
                          onDragStart={() => setDraggingCompanyId(company.id)}
                          onDragEnd={() => {
                            setDraggingCompanyId(null);
                            setHoverStageId(null);
                          }}
                          onMoveWon={() => moveToOutcome(company.id, "won")}
                          onMoveLost={() => moveToOutcome(company.id, "lost")}
                        />
                      ))
                    )}
                  </PipelineColumn>
                );
              })()
            ))}
          </div>
        </div>
      </section>

      {hasUnassignedCompanies ? (
        <p className="text-sm text-muted-foreground">
          Unassigned deals are shown in their own column until they are moved into an active pipeline stage.
        </p>
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  tone: "emerald" | "sky" | "amber" | "violet" | "rose";
}) {
  const toneStyles = {
    emerald: {
      card: "border-teal-200/80 bg-gradient-to-br from-white via-teal-50/70 to-emerald-50/90",
      glow: "bg-teal-400/10",
      iconWrap: "border-teal-200/80 bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-teal-200/60",
      value: "text-slate-950",
      accent: "bg-gradient-to-r from-teal-500 to-emerald-500",
      chip: "bg-teal-100 text-teal-700",
    },
    sky: {
      card: "border-cyan-200/80 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50/90",
      glow: "bg-cyan-400/10",
      iconWrap: "border-cyan-200/80 bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-cyan-200/60",
      value: "text-slate-950",
      accent: "bg-gradient-to-r from-sky-500 to-cyan-500",
      chip: "bg-sky-100 text-sky-700",
    },
    amber: {
      card: "border-orange-200/80 bg-gradient-to-br from-white via-amber-50/80 to-orange-50/90",
      glow: "bg-amber-400/10",
      iconWrap: "border-orange-200/80 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-200/60",
      value: "text-slate-950",
      accent: "bg-gradient-to-r from-amber-500 to-orange-500",
      chip: "bg-amber-100 text-amber-700",
    },
    violet: {
      card: "border-fuchsia-200/80 bg-gradient-to-br from-white via-violet-50/80 to-fuchsia-50/90",
      glow: "bg-violet-400/10",
      iconWrap: "border-fuchsia-200/80 bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-violet-200/60",
      value: "text-slate-950",
      accent: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
      chip: "bg-violet-100 text-violet-700",
    },
    rose: {
      card: "border-pink-200/80 bg-gradient-to-br from-white via-rose-50/80 to-pink-50/90",
      glow: "bg-rose-400/10",
      iconWrap: "border-pink-200/80 bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-rose-200/60",
      value: "text-slate-950",
      accent: "bg-gradient-to-r from-rose-500 to-pink-500",
      chip: "bg-rose-100 text-rose-700",
    },
  }[tone];

  return (
    <Card className={cn("group relative overflow-hidden border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl", toneStyles.card)}>
      <div className={cn("absolute inset-x-0 top-0 h-1.5", toneStyles.accent)} />
      <div className={cn("absolute -right-8 -top-10 size-28 rounded-full blur-3xl", toneStyles.glow)} />
      <CardContent className="relative flex min-h-[182px] flex-col justify-between gap-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-600">{title}</p>
          </div>
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-lg", toneStyles.iconWrap)}>
            {icon}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <p className={cn("text-4xl font-bold tracking-tight", toneStyles.value)}>{value}</p>
          </div>
          <p className="max-w-[20ch] text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", toneStyles.chip)}>
            Live pipeline
          </span>
          <span className="text-[11px] font-medium text-slate-500">Updated now</span>
        </div>
      </CardContent>
    </Card>
  );
}

function BdtIcon() {
  return (
    <span className="text-lg font-bold leading-none">
      {"\u09F3"}
    </span>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="relative">
        {icon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{icon}</span> : null}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn("crm-filter-input", icon ? "pl-9" : "")}
        />
      </div>
    </label>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="crm-filter-select"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PipelineColumn({
  stage,
  companies,
  visibleCount,
  isExpanded,
  isHovering,
  canDrop,
  onToggleExpanded,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  stage: PipelineStage;
  companies: PipelineBoardCompany[];
  visibleCount: number;
  isExpanded: boolean;
  isHovering: boolean;
  canDrop: boolean;
  onToggleExpanded: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  const totalEstimatedValue = companies.reduce((total, company) => total + Number(company.estimated_value ?? 0), 0);
  const probabilityLabel =
    stage.id === "unassigned" ? "Needs stage assignment" : `${Math.max(0, Number(stage.probability ?? 0))}% probability`;
  const hiddenCount = Math.max(0, companies.length - visibleCount);

  return (
    <div
      className={cn(
        "flex h-[calc(100vh-17rem)] min-h-[38rem] w-[19.5rem] shrink-0 flex-col rounded-2xl border bg-slate-50/70 shadow-sm",
        isHovering && canDrop && "border-primary bg-primary/5",
      )}
      onDragOver={(event) => {
        if (!canDrop) {
          return;
        }
        event.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        if (!canDrop) {
          return;
        }
        event.preventDefault();
        onDrop();
      }}
    >
      <div className="border-b bg-slate-50/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80">
        <div className="flex items-center gap-3">
          <span
            className="size-3 rounded-full"
            style={{ backgroundColor: stage.id === "unassigned" ? "#94a3b8" : stage.color }}
          />
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{stage.name}</h2>
            <p className="text-xs text-muted-foreground">{probabilityLabel}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
          <div className="rounded-xl border bg-white px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Deals</p>
            <p className="mt-1 font-semibold">{companies.length}</p>
          </div>
          <div className="rounded-xl border bg-white px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Value</p>
            <p className="mt-1 font-semibold">{formatCurrency(totalEstimatedValue)}</p>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3.5">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">{children}</div>
        {companies.length > INITIAL_STAGE_CARD_LIMIT ? (
          <div className="border-t pt-3">
            <Button type="button" variant="ghost" className="w-full justify-between rounded-xl text-sm" onClick={onToggleExpanded}>
              <span>
                {isExpanded ? "Show fewer deals" : `Show ${hiddenCount} more deal${hiddenCount === 1 ? "" : "s"}`}
              </span>
              {isExpanded ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PipelineDealCard({
  company,
  isDragging,
  wonStageId,
  lostStageId,
  onDragStart,
  onDragEnd,
  onMoveWon,
  onMoveLost,
}: {
  company: PipelineBoardCompany;
  isDragging: boolean;
  wonStageId: string | null;
  lostStageId: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMoveWon: () => void;
  onMoveLost: () => void;
}) {
  const assignedName = getDisplayName(
    company.assigned_profile?.full_name,
    company.assigned_profile?.email,
    "Unassigned",
  );
  const isWon = Boolean(company.pipeline_stages?.is_won);
  const isLost = Boolean(company.pipeline_stages?.is_lost);

  return (
    <Card
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", company.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-60",
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/companies/${company.id}`} className="block truncate text-[15px] font-semibold leading-5 hover:text-primary">
                {company.name}
              </Link>
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                {company.industries?.name ?? "No industry"}
                {company.company_categories?.name ? ` / ${company.company_categories.name}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-muted-foreground">Est. value</p>
              <p className="text-sm font-semibold">{formatCurrency(company.estimated_value)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RatingBadge rating={company.success_rating} />
            <LeadTemperatureBadge temperature={company.lead_temperature} />
            <span className="rounded-md border px-2 py-1 text-[11px] font-medium capitalize">
              {company.priority} priority
            </span>
          </div>
        </div>

        <dl className="space-y-2 text-sm">
          <DetailRow icon={<UserRound className="size-4 text-muted-foreground" />} label="Assigned" value={assignedName} />
          <DetailRow
            icon={<CalendarClock className="size-4 text-muted-foreground" />}
            label="Next follow-up"
            value={formatDate(company.next_followup_at)}
          />
          <DetailRow
            icon={<ArrowRightLeft className="size-4 text-muted-foreground" />}
            label="Last interaction"
            value={formatDate(company.last_interaction_at)}
          />
          <DetailRow
            icon={<Target className="size-4 text-muted-foreground" />}
            label="Primary contact"
            value={company.primary_contact?.name ?? "No primary contact"}
          />
        </dl>

        <div className="flex items-center gap-2 border-t pt-3">
          <Button asChild size="sm" variant="outline">
            <Link href={`/companies/${company.id}`}>Open</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/meetings/new?companyId=${company.id}`}>Add Meeting</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/followups/new?company=${company.id}`}>Add Follow-up</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMoveWon} disabled={!wonStageId || isWon}>
                Move to Won
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMoveLost} disabled={!lostStageId || isLost}>
                Move to Lost
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-white/90 px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/90">{label}</dt>
          <dd className="mt-1 break-words text-[13px] font-medium leading-5 text-slate-800">{value}</dd>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function calculatePipelineSummary(companies: PipelineBoardCompany[]): PipelineBoardSummary {
  const now = Date.now();
  return companies.reduce<PipelineBoardSummary>(
    (summary, company) => {
      const isWon = Boolean(company.pipeline_stages?.is_won);
      const isLost = Boolean(company.pipeline_stages?.is_lost);
      const isHot = company.lead_temperature === "hot" || company.lead_temperature === "very_hot";
      const overdueFollowup = Boolean(
        company.next_followup_at && new Date(company.next_followup_at).getTime() < now && !isWon && !isLost,
      );

      if (!isWon && !isLost) {
        summary.totalActiveDeals += 1;
        summary.totalPipelineValue += Number(company.estimated_value ?? 0);
      }

      if (isHot) {
        summary.hotLeads += 1;
      }

      if (isWon) {
        summary.wonDeals += 1;
      }

      if (isLost) {
        summary.lostDeals += 1;
      }

      if (overdueFollowup) {
        summary.overdueFollowups += 1;
      }

      return summary;
    },
    {
      totalPipelineValue: 0,
      totalActiveDeals: 0,
      hotLeads: 0,
      wonDeals: 0,
      lostDeals: 0,
      overdueFollowups: 0,
    },
  );
}

function groupCompaniesByStage(companies: PipelineBoardCompany[], stages: PipelineStage[]) {
  const columns = stages.map((stage) => ({
    stage,
    companies: [] as PipelineBoardCompany[],
  }));
  const unassigned: PipelineBoardCompany[] = [];

  for (const company of companies) {
    const stageIndex = columns.findIndex((column) => column.stage.id === company.pipeline_stage_id);
    if (stageIndex === -1) {
      unassigned.push(company);
      continue;
    }

    columns[stageIndex].companies.push(company);
  }

  const sortCompanies = (items: PipelineBoardCompany[]) =>
    items.sort((left, right) => {
      const leftValue = Number(left.estimated_value ?? 0);
      const rightValue = Number(right.estimated_value ?? 0);
      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }

      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });

  const grouped = columns.map((column) => ({
    ...column,
    companies: sortCompanies(column.companies),
  }));

  if (unassigned.length > 0) {
    grouped.unshift({
      stage: {
        id: "unassigned",
        organization_id: "",
        name: "Unassigned",
        color: "#94a3b8",
        probability: 0,
        position: -1,
        is_won: false,
        is_lost: false,
        is_active: true,
        created_at: "",
        updated_at: "",
      },
      companies: sortCompanies(unassigned),
    });
  }

  return grouped;
}
