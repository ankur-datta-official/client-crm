"use client";

import type React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { InteractionTypeBadge } from "@/components/crm/interaction-type-badge";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { archiveInteractionAction } from "@/lib/crm/actions";
import { interactionTypeOptions } from "@/lib/crm/schemas";
import type { Company, ContactPerson, Interaction } from "@/lib/crm/types";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

export function InteractionTable({ interactions, companies, contacts }: { interactions: Interaction[]; companies: Company[]; contacts: ContactPerson[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pageSizeParam = Number(searchParams.get("pageSize"));
  const resolvedPageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as (typeof PAGE_SIZE_OPTIONS)[number]) ? pageSizeParam : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(interactions.length / resolvedPageSize));
  const pageParam = Number(searchParams.get("page"));
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? Math.min(pageParam, totalPages) : 1;
  const pageStart = (currentPage - 1) * resolvedPageSize;
  const visibleInteractions = interactions.slice(pageStart, pageStart + resolvedPageSize);
  const rangeStart = interactions.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + visibleInteractions.length, interactions.length);

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
    router.push(query ? `/meetings?${query}` : "/meetings");
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
    router.push(query ? `/meetings?${query}` : "/meetings");
  }

  return (
    <div className="space-y-4">
      <form action={applyFilters} className="crm-filter-surface grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <InputLike name="search" placeholder="Search discussions..." defaultValue={searchParams.get("search") ?? ""} />
        <SelectLike name="company" label="Company" defaultValue={searchParams.get("company") ?? ""} options={companies.map((item) => [item.id, item.name])} />
        <SelectLike name="contact" label="Contact" defaultValue={searchParams.get("contact") ?? ""} options={contacts.map((item) => [item.id, item.name])} />
        <details className="md:col-span-3 xl:col-span-3">
          <summary className="crm-filter-summary">
            More filters
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SelectLike name="type" label="Type" defaultValue={searchParams.get("type") ?? ""} options={interactionTypeOptions.map((item) => [item, item])} />
            <SelectLike name="temperature" label="Temperature" defaultValue={searchParams.get("temperature") ?? ""} options={[["cold", "Cold"], ["warm", "Warm"], ["hot", "Hot"], ["very_hot", "Very Hot"]]} />
            <SelectLike name="status" label="Status" defaultValue={searchParams.get("status") ?? ""} options={[["active", "Active"], ["inactive", "Inactive"]]} />
            <InputLike name="ratingMin" type="number" placeholder="Min rating" defaultValue={searchParams.get("ratingMin") ?? ""} />
            <InputLike name="ratingMax" type="number" placeholder="Max rating" defaultValue={searchParams.get("ratingMax") ?? ""} />
            <InputLike name="dateFrom" type="date" defaultValue={searchParams.get("dateFrom") ?? ""} />
            <InputLike name="dateTo" type="date" defaultValue={searchParams.get("dateTo") ?? ""} />
          </div>
        </details>
        <div className="md:col-span-3 xl:col-span-6 flex flex-wrap gap-2">
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/meetings")}>Reset</Button>
        </div>
      </form>

      {interactions.length === 0 ? (
        <EmptyState title="No meetings logged yet" description="Record your first client discussion." icon={Plus} actionLabel="Log Meeting" actionHref="/meetings/new" />
      ) : (
        <div className="space-y-3 md:hidden">
          {visibleInteractions.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.9)]">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate font-medium text-slate-900 dark:text-slate-50">{item.companies?.name}</p>
                <InteractionTypeBadge type={item.interaction_type} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.discussion_details}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <RatingBadge rating={item.success_rating} />
                {item.lead_temperature ? <LeadTemperatureBadge temperature={item.lead_temperature} /> : null}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1"><Link href={`/meetings/${item.id}`}>Open</Link></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost"><MoreHorizontal /><span className="sr-only">More actions</span></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href={`/meetings/${item.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setArchiveId(item.id)} className="text-rose-600"><Trash2 className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {interactions.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.95)]">
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart}-{rangeEnd} of {interactions.length} meetings
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
              <table className="crm-table min-w-[840px] table-fixed">
                <thead className="crm-table-head">
                  <tr>
                    <th className="w-[13%] px-4 py-3">Date</th>
                    <th className="w-[16%] px-4 py-3">Company</th>
                    <th className="w-[13%] px-4 py-3">Contact</th>
                    <th className="w-[12%] px-4 py-3">Type</th>
                    <th className="w-[22%] px-4 py-3">Discussion Summary</th>
                    <th className="w-[8%] px-4 py-3">Rating</th>
                    <th className="w-[9%] px-4 py-3">Temp</th>
                    <th className="w-[16%] px-4 py-3">Next</th>
                    <th className="w-[10%] px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInteractions.map((item) => (
                    <tr key={item.id} className="border-b border-border/80 last:border-0 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/90">
                      <td className="crm-table-cell truncate">{new Date(item.meeting_datetime).toLocaleDateString()}</td>
                      <td className="crm-table-cell truncate font-medium text-slate-900 dark:text-slate-50">{item.companies?.name ?? "-"}</td>
                      <td className="crm-table-cell truncate">{item.contact_persons?.name ?? "-"}</td>
                      <td className="crm-table-cell"><InteractionTypeBadge type={item.interaction_type} /></td>
                      <td className="crm-table-cell truncate">{item.discussion_details}</td>
                      <td className="crm-table-cell"><RatingBadge rating={item.success_rating} /></td>
                      <td className="crm-table-cell">{item.lead_temperature ? <LeadTemperatureBadge temperature={item.lead_temperature} /> : "-"}</td>
                      <td className="crm-table-cell truncate">{item.next_action ?? "-"}</td>
                      <td className="crm-table-cell">
                        <div className="flex items-center gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={`/meetings/${item.id}`}>Open</Link></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal /><span className="sr-only">More actions</span></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild><Link href={`/meetings/${item.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setArchiveId(item.id)} className="text-rose-600"><Trash2 className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
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
        title="Archive meeting"
        description="This removes the interaction from active meeting history."
        confirmLabel="Archive"
        onConfirm={() => {
          if (!archiveId) return;
          startTransition(async () => {
            await archiveInteractionAction(archiveId);
            setArchiveId(null);
            router.refresh();
          });
        }}
      />
      {isPending ? <p className="text-sm text-muted-foreground">Updating meetings...</p> : null}
    </div>
  );
}

function InputLike(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="crm-filter-input" />;
}
function SelectLike({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[][] }) {
  return (
    <select {...props} className="crm-filter-select">
      <option value="">{label}</option>
      {options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
    </select>
  );
}
