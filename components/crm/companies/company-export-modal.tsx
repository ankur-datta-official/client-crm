"use client";

import { useState } from "react";
import { Archive, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function parseDownloadFileName(header: string | null) {
  if (!header) {
    return null;
  }

  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}

export function CompanyExportModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [includeFiles, setIncludeFiles] = useState(false);

  async function handleExport() {
    setIsExporting(true);

    try {
      const response = await fetch("/api/export/workspace-crm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ includeFiles }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? "Export failed.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const fileName =
        parseDownloadFileName(response.headers.get("Content-Disposition"))
        ?? `workspace-crm-export.${includeFiles ? "zip" : "xlsx"}`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success(includeFiles ? "CRM export ZIP downloaded." : "CRM export workbook downloaded.");
      setIsOpen(false);
    } catch {
      toast.error("Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-full border-slate-200 bg-white shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900"
        >
          <Download className="mr-2 size-4 text-primary" />
          Export Workspace CRM
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] rounded-[28px] border-slate-200/60 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-[0_24px_80px_-32px_rgba(2,6,23,0.95)]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-50">
            Export Workspace CRM Backup
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500 dark:text-slate-400">
            Download a business-readable backup of this workspace’s CRM data to your device. The workbook includes companies,
            contacts, meetings, follow-ups, documents metadata, help requests, and help request comments.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-[18px] bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-950 dark:ring-slate-800">
              {includeFiles ? <Archive className="size-6 text-primary" /> : <FileSpreadsheet className="size-6 text-primary" />}
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {includeFiles ? "ZIP export with workbook and local document files" : "Excel workbook export"}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Auth/session, admin, team-role, notification, and audit tables are excluded from this CRM-only backup.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950/80">
            <Checkbox
              id="include-files"
              checked={includeFiles}
              onCheckedChange={(checked) => setIncludeFiles(Boolean(checked))}
              disabled={isExporting}
            />
            <div className="space-y-1">
              <Label htmlFor="include-files" className="cursor-pointer text-sm font-semibold">
                Include local document files in a ZIP archive
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                External file URLs stay metadata-only. Missing local files are skipped without breaking the export.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" disabled={isExporting} onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" disabled={isExporting} onClick={() => void handleExport()}>
            {isExporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
            {includeFiles ? "Export ZIP" : "Export Excel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
