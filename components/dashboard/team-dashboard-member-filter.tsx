"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Filter, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TeamDashboardFilterQueryParam = "memberId" | "managerId" | "teamId";

type TeamDashboardMemberFilterProps = {
  options: Array<{
    id: string;
    name: string;
    meta?: string | null;
  }>;
  selectedValue: string | null;
  queryParam?: TeamDashboardFilterQueryParam;
  label?: string;
  allLabel?: string;
  compact?: boolean;
};

export function TeamDashboardMemberFilter({
  options,
  selectedValue,
  queryParam = "memberId",
  label = "Member Scope",
  allLabel = "All visible members",
  compact = false,
}: TeamDashboardMemberFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeValue = selectedValue ?? "all";
  const hasActiveFilter = Boolean(selectedValue);
  const sortedOptions = useMemo(
    () => [...options].sort((left, right) => left.name.localeCompare(right.name)),
    [options],
  );
  const isTeamFilter = queryParam === "teamId";

  function updateFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      params.delete(queryParam);
    } else {
      params.set(queryParam, value);
    }

    if (queryParam !== "memberId") {
      params.delete("memberId");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[15rem]">
      {compact ? null : (
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          <Filter className="size-3.5" />
          {label}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Select value={activeValue} onValueChange={updateFilter}>
          <SelectTrigger className={compact
            ? "h-11 min-w-[12.5rem] rounded-full border-slate-200 bg-white pr-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            : "h-11 min-w-0 rounded-full border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"}>
            <SelectValue placeholder={allLabel} />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">
              <span className="inline-flex items-center gap-2">
                {isTeamFilter ? <Building2 className="size-3.5" /> : <Users className="size-3.5" />}
                {allLabel}
              </span>
            </SelectItem>
            {sortedOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}{option.meta ? ` - ${option.meta}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilter ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-full border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
            onClick={() => updateFilter("all")}
            aria-label="Clear dashboard filter"
          >
            <RotateCcw className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
