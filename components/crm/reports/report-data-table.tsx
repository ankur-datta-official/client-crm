"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Column<T> {
  header: string;
  accessorKey: keyof T | string;
  cell?: (item: T) => React.ReactNode;
}

interface ReportDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  exportFileName?: string;
  className?: string;
}

export function ReportDataTable<T extends Record<string, any>>({
  columns,
  data,
  title,
  exportFileName = "report-data",
  className,
}: ReportDataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");

  const parsedPageSize = Number(pageSize);
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / parsedPageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * parsedPageSize;
  const endIndex = Math.min(startIndex + parsedPageSize, totalItems);
  const paginatedData = useMemo(
    () => data.slice(startIndex, endIndex),
    [data, startIndex, endIndex],
  );

  const exportToCSV = () => {
    if (data.length === 0) return;

    const headers = columns.map((col) => col.header).join(",");
    const rows = data.map((item) =>
      columns
        .map((col) => {
          const val = col.accessorKey.toString().split(".").reduce((obj, key) => obj?.[key], item);
          const stringVal = val === null || val === undefined ? "" : String(val);
          // Escape quotes and wrap in quotes if contains comma
          return `"${stringVal.replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${exportFileName}-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-4 print:hidden">
        {title ? <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{title}</h3> : null}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={exportToCSV} disabled={data.length === 0}>
            <Download className="mr-2 size-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={handlePrint} disabled={data.length === 0}>
            <Printer className="mr-2 size-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-3 print:hidden sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {totalItems === 0
            ? "No rows to show."
            : `Showing ${startIndex + 1}-${endIndex} of ${totalItems} rows`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Rows</span>
            <Select
              value={pageSize}
              onValueChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[90px] rounded-xl bg-white text-sm dark:bg-slate-950">
                <SelectValue placeholder="10" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Page {safePage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <div className="crm-table-shell print:overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, i) => (
                <TableHead key={i} className="text-xs font-bold uppercase text-muted-foreground">
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalItems === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No data available for this report.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column, colIndex) => (
                    <TableCell key={colIndex} className="text-sm">
                      {column.cell
                        ? column.cell(item)
                        : (column.accessorKey.toString().split(".").reduce((obj, key) => obj?.[key], item) as any) || "-"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
