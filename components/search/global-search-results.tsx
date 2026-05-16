import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GlobalSearchResults as GlobalSearchResultsShape } from "@/lib/search/global-search";

type GlobalSearchResultsProps = {
  query: string;
  results: GlobalSearchResultsShape | null;
  isLoading: boolean;
  open: boolean;
  onResultClick?: () => void;
  className?: string;
};

const sections = [
  { key: "companies", label: "Companies" },
  { key: "contacts", label: "Contacts" },
  { key: "meetings", label: "Meetings" },
  { key: "followups", label: "Follow-ups" },
  { key: "documents", label: "Documents" },
  { key: "helpRequests", label: "Help Requests" },
] as const;

export function GlobalSearchResults({
  query,
  results,
  isLoading,
  open,
  onResultClick,
  className,
}: GlobalSearchResultsProps) {
  if (!open) {
    return null;
  }

  const totalResults = results
    ? sections.reduce((sum, section) => sum + results[section.key].length, 0)
    : 0;

  return (
    <div className={cn("absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-background shadow-soft dark:border-slate-800 dark:bg-slate-950", className)}>
      {isLoading ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching your CRM records...
        </div>
      ) : query.trim().length < 2 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Search className="h-4 w-4" />
          Type at least 2 characters to search your workspace.
        </div>
      ) : totalResults === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">No matching CRM records found.</div>
      ) : (
        <>
          <div className="max-h-[28rem] overflow-y-auto p-2">
            {sections.map((section) => {
              const items = results?.[section.key] ?? [];

              if (items.length === 0) {
                return null;
              }

              return (
                <div key={section.key} className="mb-3 last:mb-0">
                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={onResultClick}
                        className="flex items-start justify-between gap-3 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/20"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{item.subtitle}</p>
                        </div>
                        {item.badge ? (
                          <Badge variant="outline" className={cn("shrink-0 capitalize", item.status === "pending" && "border-amber-200 text-amber-700")}>
                            {item.badge}
                          </Badge>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <Link href={`/search?q=${encodeURIComponent(query.trim())}`} onClick={onResultClick} className="text-sm font-medium text-primary hover:underline">
              View all results
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
