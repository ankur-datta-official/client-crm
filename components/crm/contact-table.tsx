"use client";

import type React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { DecisionRoleBadge } from "@/components/crm/decision-role-badge";
import { PrimaryContactBadge } from "@/components/crm/primary-contact-badge";
import { RelationshipLevelBadge } from "@/components/crm/relationship-level-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { archiveContactAction } from "@/lib/crm/actions";
import { decisionRoleOptions, preferredContactMethodOptions, relationshipLevelOptions } from "@/lib/crm/schemas";
import type { Company, ContactPerson } from "@/lib/crm/types";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

export function ContactTable({ contacts, companies, totalCount }: { contacts: ContactPerson[]; companies: Pick<Company, "id" | "name">[]; totalCount?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pageSizeParam = Number(searchParams.get("pageSize"));
  const resolvedPageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as (typeof PAGE_SIZE_OPTIONS)[number]) ? pageSizeParam : DEFAULT_PAGE_SIZE;
  const totalItems = totalCount ?? contacts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / resolvedPageSize));
  const pageParam = Number(searchParams.get("page"));
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? Math.min(pageParam, totalPages) : 1;
  const pageStart = (currentPage - 1) * resolvedPageSize;
  const visibleContacts = totalCount === undefined ? contacts.slice(pageStart, pageStart + resolvedPageSize) : contacts;
  const rangeStart = totalItems === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + visibleContacts.length, totalItems);

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
    router.push(query ? `/contacts?${query}` : "/contacts");
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
    router.push(query ? `/contacts?${query}` : "/contacts");
  }

  return (
    <div className="space-y-4">
      <form action={applyFilters} className="crm-filter-surface grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <InputLike name="search" placeholder="Search contacts..." defaultValue={searchParams.get("search") ?? ""} />
        <SelectLike name="company" defaultValue={searchParams.get("company") ?? ""} label="Company" options={companies.map((company) => [company.id, company.name])} />
        <SelectLike name="decisionRole" defaultValue={searchParams.get("decisionRole") ?? ""} label="Decision role" options={decisionRoleOptions.map((item) => [item, item])} />
        <details className="md:col-span-3 xl:col-span-3">
          <summary className="crm-filter-summary">
            More filters
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SelectLike name="relationshipLevel" defaultValue={searchParams.get("relationshipLevel") ?? ""} label="Relationship" options={relationshipLevelOptions.map((item) => [item, item])} />
            <SelectLike name="preferredMethod" defaultValue={searchParams.get("preferredMethod") ?? ""} label="Method" options={preferredContactMethodOptions.map((item) => [item, item])} />
            <SelectLike name="status" defaultValue={searchParams.get("status") ?? ""} label="Status" options={[["active", "Active"], ["inactive", "Inactive"]]} />
          </div>
        </details>
        <div className="md:col-span-3 xl:col-span-6 flex flex-wrap gap-2">
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/contacts")}>Reset</Button>
        </div>
      </form>

      {totalItems === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="No contacts yet. Add decision makers under your companies."
          icon={Plus}
          actionLabel="Add Contact"
          actionHref="/contacts/new"
        />
      ) : (
        <div className="space-y-3 md:hidden">
          {visibleContacts.map((contact) => (
            <div key={contact.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.9)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{contact.name}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{contact.companies?.name ?? "No company"}</p>
                </div>
                <PrimaryContactBadge primary={contact.is_primary} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <DecisionRoleBadge role={contact.decision_role} />
                <RelationshipLevelBadge level={contact.relationship_level} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1"><Link href={`/contacts/${contact.id}`}>Open</Link></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost"><MoreHorizontal /><span className="sr-only">More actions</span></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href={`/contacts/${contact.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setArchiveId(contact.id)} className="text-rose-600"><Trash2 className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
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
              Showing {rangeStart}-{rangeEnd} of {totalItems} contacts
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
              <table className="crm-table min-w-[820px] table-fixed">
                <thead className="crm-table-head">
                  <tr>
                    <th className="w-[16%] px-4 py-3">Contact Name</th>
                    <th className="w-[15%] px-4 py-3">Company</th>
                    <th className="w-[13%] px-4 py-3">Designation</th>
                    <th className="w-[12%] px-4 py-3">Decision Role</th>
                    <th className="w-[12%] px-4 py-3">Mobile</th>
                    <th className="w-[16%] px-4 py-3">Email</th>
                    <th className="w-[12%] px-4 py-3">Relationship</th>
                    <th className="w-[9%] px-4 py-3">Primary</th>
                    <th className="w-[10%] px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleContacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-border/80 last:border-0 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/90">
                      <td className="crm-table-cell truncate font-medium text-slate-900 dark:text-slate-50">{contact.name}</td>
                      <td className="crm-table-cell truncate">{contact.companies?.name ?? "-"}</td>
                      <td className="crm-table-cell truncate">{contact.designation ?? "-"}</td>
                      <td className="crm-table-cell"><DecisionRoleBadge role={contact.decision_role} /></td>
                      <td className="crm-table-cell truncate">{contact.mobile ?? "-"}</td>
                      <td className="crm-table-cell truncate">{contact.email ?? "-"}</td>
                      <td className="crm-table-cell"><RelationshipLevelBadge level={contact.relationship_level} /></td>
                      <td className="crm-table-cell"><PrimaryContactBadge primary={contact.is_primary} /></td>
                      <td className="crm-table-cell">
                        <div className="flex items-center gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={`/contacts/${contact.id}`}>Open</Link></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal /><span className="sr-only">More actions</span></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild><Link href={`/contacts/${contact.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setArchiveId(contact.id)} className="text-rose-600"><Trash2 className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
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
        title="Archive contact"
        description="This removes the contact from active lists while preserving activity history."
        confirmLabel="Archive"
        onConfirm={() => {
          if (!archiveId) return;
          startTransition(async () => {
            await archiveContactAction(archiveId);
            setArchiveId(null);
            router.refresh();
          });
        }}
      />
      {isPending ? <p className="text-sm text-muted-foreground">Updating contacts...</p> : null}
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
