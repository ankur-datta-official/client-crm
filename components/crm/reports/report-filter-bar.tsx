"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown, ChevronUp, Layers, Search, Thermometer, User, Building2, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { 
  TeamMemberOption, 
  Industry, 
  PipelineStage, 
  CompanyCategory 
} from "@/lib/crm/types";

interface ReportFilterBarProps {
  users: TeamMemberOption[];
  industries: Industry[];
  stages: PipelineStage[];
  categories: CompanyCategory[];
}

export function ReportFilterBar({ users, industries, stages, categories }: ReportFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dateRange, setDateRange] = useState(searchParams.get("dateRange") || "this_month");
  const [assignedUserId, setAssignedUserId] = useState(searchParams.get("assignedUserId") || "all");
  const [industryId, setIndustryId] = useState(searchParams.get("industryId") || "all");
  const [pipelineStageId, setPipelineStageId] = useState(searchParams.get("pipelineStageId") || "all");
  const [leadTemperature, setLeadTemperature] = useState(searchParams.get("leadTemperature") || "all");
  const [companyCategoryId, setCompanyCategoryId] = useState(searchParams.get("companyCategoryId") || "all");
  const [showMoreFilters, setShowMoreFilters] = useState(
    searchParams.get("pipelineStageId") !== null
      || searchParams.get("leadTemperature") !== null
      || searchParams.get("companyCategoryId") !== null,
  );

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams);
    
    if (dateRange && dateRange !== "all") params.set("dateRange", dateRange);
    else params.delete("dateRange");

    if (assignedUserId && assignedUserId !== "all") params.set("assignedUserId", assignedUserId);
    else params.delete("assignedUserId");

    if (industryId && industryId !== "all") params.set("industryId", industryId);
    else params.delete("industryId");

    if (pipelineStageId && pipelineStageId !== "all") params.set("pipelineStageId", pipelineStageId);
    else params.delete("pipelineStageId");

    if (leadTemperature && leadTemperature !== "all") params.set("leadTemperature", leadTemperature);
    else params.delete("leadTemperature");

    if (companyCategoryId && companyCategoryId !== "all") params.set("companyCategoryId", companyCategoryId);
    else params.delete("companyCategoryId");

    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    setDateRange("this_month");
    setAssignedUserId("all");
    setIndustryId("all");
    setPipelineStageId("all");
    setLeadTemperature("all");
    setCompanyCategoryId("all");
    router.push(pathname);
  };

  const advancedFilterCount = [pipelineStageId, leadTemperature, companyCategoryId].filter((value) => value !== "all").length;

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.08),_transparent_30%),linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] shadow-soft print:hidden">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Analytics Filters</p>
            <p className="text-xs text-slate-500">Refine every report chart with the same workspace-wide filters.</p>
          </div>
          <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
            {advancedFilterCount > 0 ? `${advancedFilterCount} advanced filter${advancedFilterCount > 1 ? "s" : ""} active` : "Base filters ready"}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(150px,170px)_minmax(170px,190px)_minmax(160px,180px)_auto]">
          <FilterField label="Date Range" icon={<Calendar className="size-3.5" />}>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
                <SelectItem value="custom" disabled>Custom range</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Assigned User" icon={<User className="size-3.5" />}>
            <Select value={assignedUserId} onValueChange={setAssignedUserId}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Industry" icon={<Building2 className="size-3.5" />}>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map((industry) => (
                  <SelectItem key={industry.id} value={industry.id}>
                    {industry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <div className="flex flex-wrap items-end gap-2 xl:justify-end">
            <Button onClick={applyFilters} size="sm" className="h-10 px-4">
              <Search className="mr-2 size-3.5" />
              Filter
            </Button>
            <Button onClick={clearFilters} variant="outline" size="sm" className="h-10 px-4">
              <X className="mr-2 size-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl bg-white/80"
            onClick={() => setShowMoreFilters((current) => !current)}
          >
            <Layers className="mr-2 size-3.5" />
            More filters
            {advancedFilterCount > 0 ? <span className="ml-1 text-xs text-primary">({advancedFilterCount})</span> : null}
            {showMoreFilters ? <ChevronUp className="ml-2 size-3.5" /> : <ChevronDown className="ml-2 size-3.5" />}
          </Button>
          <p className="text-xs text-slate-500">Use more filters for stage, temperature, and category slices.</p>
        </div>

        {showMoreFilters ? (
          <div className="grid gap-3 rounded-[24px] border border-slate-100 bg-white/70 p-3 md:grid-cols-3">
            <FilterField label="Pipeline Stage" icon={<Layers className="size-3.5" />}>
              <Select value={pipelineStageId} onValueChange={setPipelineStageId}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Temperature" icon={<Thermometer className="size-3.5" />}>
              <Select value={leadTemperature} onValueChange={setLeadTemperature}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="very_hot">Very Hot</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Category" icon={<Tag className="size-3.5" />}>
              <Select value={companyCategoryId} onValueChange={setCompanyCategoryId}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FilterField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
