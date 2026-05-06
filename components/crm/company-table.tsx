"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type React from "react";
import { ChevronLeft, ChevronRight, Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { CompanyStatusBadge } from "@/components/crm/company-status-badge";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { archiveCompanyAction } from "@/lib/crm/actions";
import type { Company, CompanyCategory, Industry, PipelineStage, TeamMemberOption } from "@/lib/crm/types";

type CompanyTableProps = {
  companies: Company[];
  totalCount?: number;
  industries: Industry[];
  categories: CompanyCategory[];
  stages: PipelineStage[];
  teamMembers: TeamMemberOption[];
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

export function CompanyTable({ companies, totalCount, industries, categories, stages, teamMembers }: CompanyTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pageSizeParam = Number(searchParams.get("pageSize"));
  const resolvedPageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as (typeof PAGE_SIZE_OPTIONS)[number]) ? pageSizeParam : DEFAULT_PAGE_SIZE;
  const totalItems = totalCount ?? companies.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / resolvedPageSize));
  const pageParam = Number(searchParams.get("page"));
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? Math.min(pageParam, totalPages) : 1;
  const pageStart = (currentPage - 1) * resolvedPageSize;
  const visibleCompanies = totalCount === undefined ? companies.slice(pageStart, pageStart + resolvedPageSize) : companies;
  const rangeStart = totalItems === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + visibleCompanies.length, totalItems);

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const text = String(value);
      if (text) params.set(key, text);
    }
    const pageSize = searchParams.get("pageSize");
    if (pageSize) {
      params.set("pageSize", pageSize);
    }
    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  function updateListParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
        continue;
      }
      params.set(key, value);
    }

    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  return (
    <div className="space-y-4">
      <form action={applyFilters} className="crm-filter-surface grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        <InputLike name="search" placeholder="Search leads..." defaultValue={searchParams.get("search") ?? ""} />
        <SelectLike name="industry" defaultValue={searchParams.get("industry") ?? ""} options={industries.map((item) => [item.id, item.name])} label="Industry" />
        <SelectLike name="category" defaultValue={searchParams.get("category") ?? ""} options={categories.map((item) => [item.id, item.name])} label="Category" />
        <details className="md:col-span-3 xl:col-span-4">
          <summary className="crm-filter-summary">
            More filters
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SelectLike name="pipeline" defaultValue={searchParams.get("pipeline") ?? ""} options={stages.map((item) => [item.id, item.name])} label="Pipeline" />
            <SelectLike name="priority" defaultValue={searchParams.get("priority") ?? ""} options={[["low", "Low"], ["medium", "Medium"], ["high", "High"], ["urgent", "Urgent"]]} label="Priority" />
            <SelectLike name="temperature" defaultValue={searchParams.get("temperature") ?? ""} options={[["cold", "Cold"], ["warm", "Warm"], ["hot", "Hot"]]} label="Temperature" />
            <SelectLike name="assigned" defaultValue={searchParams.get("assigned") ?? ""} options={teamMembers.map((item) => [item.id, item.full_name ?? item.email])} label="Assigned" />
          </div>
        </details>
        <div className="md:col-span-3 xl:col-span-7 flex flex-wrap gap-2">
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/companies")}>Reset</Button>
        </div>
      </form>

      {totalItems === 0 ? (
        <EmptyState
          title="No companies yet"
          description="No companies yet. Add your first lead to start tracking meetings, follow-ups, and pipeline progress."
          icon={Plus}
          actionLabel="Add Company"
          actionHref="/companies/new"
        />
      ) : (
        <div className="space-y-3 md:hidden">
          {visibleCompanies.map((company) => (
            <div
              key={company.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.9)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-50">{company.name}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    Primary: {company.primary_contact?.name ?? "No primary contact"}
                  </p>
                </div>
                <CompanyStatusBadge status={company.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <RatingBadge rating={company.success_rating} />
                <LeadTemperatureBadge temperature={company.lead_temperature} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1"><Link href={`/companies/${company.id}`}>Open</Link></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost"><MoreHorizontal /><span className="sr-only">More actions</span></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href={`/companies/${company.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setArchiveId(company.id)} className="text-rose-600"><Trash2 className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalItems > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.95)]">
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart}-{rangeEnd} of {totalItems} companies
            </p>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <select
                aria-label="Rows per page"
                className="rounded-full border border-input bg-background px-3 py-1.5 text-foreground outline-none transition focus:border-ring dark:border-slate-800 dark:bg-slate-950/85 dark:[color-scheme:dark]"
                value={String(resolvedPageSize)}
                onChange={(event) => updateListParams({ pageSize: event.target.value, page: null })}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="crm-table-shell hidden max-w-full md:block">
            <div className="overflow-x-auto">
              <table className="crm-table min-w-[820px] table-fixed">
                <thead className="crm-table-head">
                  <tr>
                    <th className="w-[22%] px-4 py-3">Company Name</th>
                    <th className="w-[15%] px-4 py-3">Primary Contact</th>
                    <th className="w-[14%] px-4 py-3">Industry</th>
                    <th className="w-[14%] px-4 py-3">Stage</th>
                    <th className="w-[9%] px-4 py-3">Rating</th>
                    <th className="w-[11%] px-4 py-3">Temperature</th>
                    <th className="w-[13%] px-4 py-3">Assigned To</th>
                    <th className="w-[8%] px-4 py-3">Status</th>
                    <th className="w-[9%] px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCompanies.map((company) => (
                    <tr key={company.id} className="border-b border-border/80 last:border-0 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/90">
                      <td className="crm-table-cell truncate font-medium text-slate-900 dark:text-slate-50">{company.name}</td>
                      <td className="crm-table-cell truncate">{company.primary_contact?.name ?? "-"}</td>
                      <td className="crm-table-cell truncate">{company.industries?.name ?? "-"}</td>
                      <td className="crm-table-cell truncate">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          {company.pipeline_stages?.color ? <span className="size-3 shrink-0 rounded-full" style={{ background: company.pipeline_stages.color }} /> : null}
                          <span className="truncate">{company.pipeline_stages?.name ?? "-"}</span>
                        </span>
                      </td>
                      <td className="crm-table-cell"><RatingBadge rating={company.success_rating} /></td>
                      <td className="crm-table-cell"><LeadTemperatureBadge temperature={company.lead_temperature} /></td>
                      <td className="crm-table-cell truncate">{company.assigned_profile?.full_name ?? company.assigned_profile?.email ?? "Unassigned"}</td>
                      <td className="crm-table-cell"><CompanyStatusBadge status={company.status} /></td>
                      <td className="crm-table-cell">
                        <div className="flex items-center gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={`/companies/${company.id}`}>Open</Link></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal /><span className="sr-only">More actions</span></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild><Link href={`/companies/${company.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setArchiveId(company.id)} className="text-rose-600"><Trash2 className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.95)]">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => updateListParams({ page: currentPage > 2 ? String(currentPage - 1) : null })}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => updateListParams({ page: String(currentPage + 1) })}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(archiveId)}
        onOpenChange={(open) => !open && setArchiveId(null)}
        title="Archive company"
        description="This removes the company from active lists while preserving activity history."
        confirmLabel="Archive"
        onConfirm={() => {
          if (!archiveId) return;
          startTransition(async () => {
            await archiveCompanyAction(archiveId);
            setArchiveId(null);
            router.refresh();
          });
        }}
      />
      {isPending ? <p className="text-sm text-muted-foreground">Updating company list...</p> : null}
    </div>
  );
}

function InputLike(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="crm-filter-input" />;
}

function SelectLike({
  label,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[][] }) {
  return (
    <select {...props} className="crm-filter-select">
      <option value="">{label}</option>
      {options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
    </select>
  );
}
