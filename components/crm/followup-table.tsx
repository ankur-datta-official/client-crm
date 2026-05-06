"use client";

import type React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Edit, Plus, CheckCircle2, XCircle, Archive, Calendar, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { FollowupStatusBadge, FollowupPriorityBadge, FollowupTypeBadge } from "@/components/crm/followup-badges";
import { completeFollowup, cancelFollowup, archiveFollowup } from "@/lib/crm/followup-actions";
import { followupTypeOptions, followupPriorityOptions, followupStatusOptions } from "@/lib/crm/schemas";
import type { Company, Followup, TeamMemberOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

export function FollowupTable({
  followups,
  companies,
  teamMembers,
  totalCount,
}: {
  followups: Followup[];
  companies: Pick<Company, "id" | "name">[];
  teamMembers: TeamMemberOption[];
  totalCount?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const pageSizeParam = Number(searchParams.get("pageSize"));
  const resolvedPageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as (typeof PAGE_SIZE_OPTIONS)[number]) ? pageSizeParam : DEFAULT_PAGE_SIZE;
  const totalItems = totalCount ?? followups.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / resolvedPageSize));
  const pageParam = Number(searchParams.get("page"));
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? Math.min(pageParam, totalPages) : 1;
  const pageStart = (currentPage - 1) * resolvedPageSize;
  const visibleFollowups = totalCount === undefined ? followups.slice(pageStart, pageStart + resolvedPageSize) : followups;
  const rangeStart = totalItems === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + visibleFollowups.length, totalItems);

  const [completeId, setCompleteId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);

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
    router.push(query ? `/followups?${query}` : "/followups");
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
    router.push(query ? `/followups?${query}` : "/followups");
  }

  const isOverdue = (followup: Followup) => {
    return followup.status === "pending" && new Date(followup.scheduled_at) < new Date();
  };

  return (
    <div className="space-y-4">
      <form action={applyFilters} className="crm-filter-surface grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <InputLike name="search" placeholder="Search follow-ups..." defaultValue={searchParams.get("search") ?? ""} />
        <SelectLike
          name="company"
          defaultValue={searchParams.get("company") ?? ""}
          label="Company"
          options={companies.map((c) => [c.id, c.name])}
        />
        <SelectLike
          name="type"
          defaultValue={searchParams.get("type") ?? ""}
          label="Type"
          options={followupTypeOptions.map((t) => [t, t])}
        />
        <SelectLike
          name="priority"
          defaultValue={searchParams.get("priority") ?? ""}
          label="Priority"
          options={followupPriorityOptions.map((p) => [p, p.charAt(0).toUpperCase() + p.slice(1)])}
        />
        <details className="md:col-span-3 xl:col-span-3">
          <summary className="crm-filter-summary">
            More filters
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SelectLike
              name="status"
              defaultValue={searchParams.get("status") ?? ""}
              label="Status"
              options={followupStatusOptions.map((s) => [s, s.charAt(0).toUpperCase() + s.slice(1)])}
            />
            <SelectLike
              name="assigned"
              defaultValue={searchParams.get("assigned") ?? ""}
              label="Assigned"
              options={teamMembers.map((m) => [m.id, m.full_name ?? m.email])}
            />
          </div>
        </details>
        <div className="md:col-span-3 xl:col-span-6 flex gap-2">
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/followups")}>Reset</Button>
        </div>
      </form>

      {totalItems === 0 ? (
        <EmptyState title="No follow-ups scheduled" description="Create next actions so no client is missed." icon={Calendar} actionLabel="Create Follow-up" actionHref="/followups/new" />
      ) : (
        <div className="space-y-3 md:hidden">
          {visibleFollowups.map((f) => (
            <div key={f.id} className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.9)]", isOverdue(f) && "border-destructive/30 bg-destructive/5 dark:bg-destructive/10")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{f.title}</p>
                    {isOverdue(f) && <span className="text-[10px] font-bold text-destructive uppercase">Overdue</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground truncate">{f.companies?.name}</p>
                </div>
                <FollowupStatusBadge status={f.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <FollowupTypeBadge type={f.followup_type} />
                <FollowupPriorityBadge priority={f.priority} />
                <span className="text-xs text-muted-foreground flex items-center">
                  <Calendar className="mr-1 h-3 w-3" />
                  {new Date(f.scheduled_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1"><Link href={`/followups/${f.id}`}>Open</Link></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">More actions</span></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href={`/followups/${f.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
                    {f.status === "pending" ? <DropdownMenuItem onClick={() => setCompleteId(f.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Complete</DropdownMenuItem> : null}
                    {f.status === "pending" ? <DropdownMenuItem onClick={() => setCancelId(f.id)} className="text-rose-600"><XCircle className="mr-2 h-4 w-4" />Cancel</DropdownMenuItem> : null}
                    {f.status !== "archived" ? <DropdownMenuItem onClick={() => setArchiveId(f.id)}><Archive className="mr-2 h-4 w-4" />Archive</DropdownMenuItem> : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalItems > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.95)]">
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart}-{rangeEnd} of {totalItems} follow-ups
            </p>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <select
                aria-label="Rows per page"
                className="rounded-full border border-input bg-background px-3 py-1.5 text-foreground outline-none transition focus:border-ring"
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
              <table className="crm-table min-w-[880px] table-fixed">
                <thead className="crm-table-head">
                  <tr>
                    <th className="w-[15%] px-4 py-3">Scheduled</th>
                    <th className="w-[20%] px-4 py-3">Title</th>
                    <th className="w-[15%] px-4 py-3">Company</th>
                    <th className="w-[12%] px-4 py-3">Type</th>
                    <th className="w-[10%] px-4 py-3">Priority</th>
                    <th className="w-[13%] px-4 py-3">Assigned To</th>
                    <th className="w-[11%] px-4 py-3">Status</th>
                    <th className="w-[9%] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFollowups.map((f) => (
                    <tr key={f.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", isOverdue(f) && "bg-destructive/5")}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className={cn("font-medium", isOverdue(f) && "text-destructive")}>
                            {new Date(f.scheduled_at).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(f.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 truncate font-medium">{f.title}</td>
                      <td className="px-4 py-3 truncate">{f.companies?.name}</td>
                      <td className="px-4 py-3"><FollowupTypeBadge type={f.followup_type} /></td>
                      <td className="px-4 py-3"><FollowupPriorityBadge priority={f.priority} /></td>
                      <td className="px-4 py-3 truncate text-muted-foreground">
                        {f.assigned_profile?.full_name ?? f.assigned_profile?.email ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3"><FollowupStatusBadge status={f.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={`/followups/${f.id}`}>Open</Link></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">More actions</span></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild><Link href={`/followups/${f.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
                              {f.status === "pending" ? <DropdownMenuItem onClick={() => setCompleteId(f.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Complete</DropdownMenuItem> : null}
                              {f.status === "pending" ? <DropdownMenuItem onClick={() => setCancelId(f.id)} className="text-rose-600"><XCircle className="mr-2 h-4 w-4" />Cancel</DropdownMenuItem> : null}
                              {f.status !== "archived" ? <DropdownMenuItem onClick={() => setArchiveId(f.id)}><Archive className="mr-2 h-4 w-4" />Archive</DropdownMenuItem> : null}
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
      )}

      <ConfirmModal
        open={Boolean(completeId)}
        onOpenChange={(open) => !open && setCompleteId(null)}
        title="Complete follow-up"
        description="Mark this follow-up as successfully completed."
        confirmLabel="Complete"
        onConfirm={() => {
          if (!completeId) return;
          startTransition(async () => {
            await completeFollowup(completeId);
            setCompleteId(null);
            router.refresh();
          });
        }}
      />

      <ConfirmModal
        open={Boolean(cancelId)}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancel follow-up"
        description="Are you sure you want to cancel this follow-up?"
        confirmLabel="Cancel Follow-up"
        onConfirm={() => {
          if (!cancelId) return;
          startTransition(async () => {
            await cancelFollowup(cancelId);
            setCancelId(null);
            router.refresh();
          });
        }}
      />

      <ConfirmModal
        open={Boolean(archiveId)}
        onOpenChange={(open) => !open && setArchiveId(null)}
        title="Archive follow-up"
        description="Archive this follow-up record. It will be hidden from active lists."
        confirmLabel="Archive"
        onConfirm={() => {
          if (!archiveId) return;
          startTransition(async () => {
            await archiveFollowup(archiveId);
            setArchiveId(null);
            router.refresh();
          });
        }}
      />
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
