import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminPaginationProps = {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  query: Record<string, string | undefined>;
};

export function AdminPagination({ basePath, page, pageSize, total, query }: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function href(nextPage: number) {
    const params = new URLSearchParams();
    Object.entries({ ...query, page: String(nextPage), pageSize: String(pageSize) }).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200/80 bg-white/95 px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/80 dark:bg-slate-950/95">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Page {page} of {totalPages} · {total} total item{total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
          <Link href={href(Math.max(1, page - 1))}>
            <ChevronLeft className="size-4" />
            Previous
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" aria-disabled={page >= totalPages} className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
          <Link href={href(Math.min(totalPages, page + 1))}>
            Next
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
