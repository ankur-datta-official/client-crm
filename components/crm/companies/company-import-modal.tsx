"use client";

import { useState } from "react";
import { Download, FileUp, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ImportApiResponse = {
  success?: boolean;
  companiesImported?: number;
  contactsImported?: number;
  errors?: string[];
  error?: string;
};

export function CompanyImportModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [importResult, setImportResult] = useState<{
    companiesImported: number;
    contactsImported: number;
    errors: string[];
  } | null>(null);

  const downloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch("/api/import/companies", { method: "GET" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? "Unable to download template.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "crm-import-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded.");
    } catch {
      toast.error("Unable to download template.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      toast.error("Please upload a .csv, .xlsx, or .xls file.");
      setIsImporting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/companies", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as ImportApiResponse;

      if (!res.ok) {
        toast.error(data.error ?? "Import failed.");
        if (data.errors?.length) {
          setImportResult({ companiesImported: 0, contactsImported: 0, errors: data.errors });
        }
        return;
      }

      const companiesImported = data.companiesImported ?? 0;
      const contactsImported = data.contactsImported ?? 0;
      const errors = data.errors ?? [];

      setImportResult({ companiesImported, contactsImported, errors });

      if (errors.length === 0) {
        toast.success(`${companiesImported} companies and ${contactsImported} contacts imported.`);
      } else {
        toast.warning(`Imported with ${errors.length} issue(s)`, {
          description: `${companiesImported} companies, ${contactsImported} contacts.`,
        });
      }
    } catch {
      toast.error("Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-full border-slate-200 bg-white shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900"
        >
          <FileUp className="mr-2 size-4 text-primary" />
          Import from CSV/Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[28px] border-slate-200/60 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-[0_24px_80px_-32px_rgba(2,6,23,0.95)]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-50">
            Bulk Import Companies &amp; Contacts
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500 dark:text-slate-400">
            Use an Excel workbook with two sheets - <span className="font-semibold text-slate-700 dark:text-slate-200">Companies</span> and{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">Contacts</span> - or a CSV file with the Companies columns only
            (row 1 headers exactly as in the template).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 pb-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-full font-semibold"
            disabled={isDownloading}
            onClick={() => void downloadTemplate()}
          >
            {isDownloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
            Download Template
          </Button>
        </div>

        <div className="py-4">
          {!importResult ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 transition-all hover:border-primary/30 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-primary/40 dark:hover:bg-slate-900">
              {isImporting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-10 animate-spin text-primary" />
                  <p className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-100">Uploading and importing...</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex size-14 items-center justify-center rounded-[20px] bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-950 dark:ring-slate-800">
                    <FileSpreadsheet className="size-7 text-primary" />
                  </div>
                  <label className="group cursor-pointer">
                    <span className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 group-hover:bg-primary/90">
                      Choose CSV/Excel File
                    </span>
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => void handleFileUpload(e)} />
                  </label>
                  <p className="mt-4 text-center text-[11px] font-bold uppercase leading-relaxed tracking-widest text-slate-400 dark:text-slate-500">
                    Sheet &quot;Companies&quot;: industry, sl, company_name, address, city, primary_phone, phone_2, phone_3,
                    primary_email, email_2, website, notes
                    <br />
                    Sheet &quot;Contacts&quot;: company_name, contact_name, designation, primary_phone, phone_2, primary_email,
                    email_2, is_primary_contact
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <CheckCircle2 className="size-6 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    {importResult.companiesImported} companies and {importResult.contactsImported} contacts imported
                  </p>
                  <p className="text-xs font-medium text-emerald-700/80 dark:text-emerald-200/80">
                    {importResult.errors.length === 0
                      ? "All rows were processed without reported issues."
                      : "Some rows were skipped - see details below."}
                  </p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="flex items-start gap-4 rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
                  <AlertCircle className="mt-0.5 size-6 shrink-0 text-rose-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-rose-900 dark:text-rose-100">{importResult.errors.length} issue(s)</p>
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-2">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="break-words text-[11px] font-medium text-rose-800 dark:text-rose-200">
                          {err}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button
                className="mt-2 h-11 w-full rounded-xl font-bold shadow-lg shadow-primary/10"
                onClick={() => {
                  setIsOpen(false);
                  setImportResult(null);
                }}
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
