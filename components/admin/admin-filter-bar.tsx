import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminFilterOptions, AdminFilters } from "@/lib/admin/queries";

type AdminFilterBarProps = {
  basePath: string;
  filters: AdminFilters;
  options: AdminFilterOptions;
  showStatus?: boolean;
  statusOptions?: Array<{ value: string; label: string }>;
};

export function AdminFilterBar({
  basePath,
  filters,
  options,
  showStatus = true,
  statusOptions = [
    { value: "", label: "All status" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
}: AdminFilterBarProps) {
  return (
    <form method="get" action={basePath} className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
          <input
            type="text"
            name="query"
            defaultValue={filters.query ?? ""}
            placeholder="Search users, workspaces, activity..."
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <select name="dateRange" defaultValue={filters.dateRange} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15">
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="365d">Last 365 days</option>
          <option value="all">All time</option>
        </select>

        <select name="workspaceId" defaultValue={filters.workspaceId ?? ""} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15">
          <option value="">All workspaces</option>
          {options.workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.label}
            </option>
          ))}
        </select>

        <select name="userId" defaultValue={filters.userId ?? ""} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15">
          <option value="">All users</option>
          {options.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>

        {showStatus ? (
          <select name="status" defaultValue={filters.status ?? ""} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15">
            {statusOptions.map((status) => (
              <option key={status.value || "all"} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="status" value={filters.status ?? ""} />
        )}

        <select name="pageSize" defaultValue={String(filters.pageSize)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15">
          <option value="10">10 / page</option>
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
        <Button type="submit" className="w-full sm:w-auto">Apply filters</Button>
        <Button type="submit" variant="outline" name="page" value="1" className="w-full sm:w-auto">
          Refresh
        </Button>
        <Button asChild variant="ghost" className="w-full sm:w-auto">
          <Link href={basePath}>Clear</Link>
        </Button>
      </div>
    </form>
  );
}
