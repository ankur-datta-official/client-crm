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
        <Button variant="outline" className="rounded-full bg-white shadow-sm border-slate-200 hover:bg-slate-50 transition-all">
          <FileUp className="mr-2 size-4 text-primary" />
          Import from CSV/Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[28px] border-slate-200/60 shadow-2xl backdrop-blur-xl bg-white/95">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-900">Bulk Import Companies &amp; Contacts</DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
            Use an Excel workbook with two sheets — <span className="font-semibold text-slate-700">Companies</span> and{" "}
            <span className="font-semibold text-slate-700">Contacts</span> — or a CSV file with the Companies columns only
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
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[24px] p-10 bg-slate-50/50 transition-all hover:border-primary/30 hover:bg-slate-50">
              {isImporting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-10 text-primary animate-spin" />
                  <p className="text-sm font-bold text-slate-700 tracking-tight">Uploading and importing…</p>
                </div>
              ) : (
                <>
                  <div className="size-14 rounded-[20px] bg-white shadow-sm flex items-center justify-center mb-4 ring-1 ring-slate-100">
                    <FileSpreadsheet className="size-7 text-primary" />
                  </div>
                  <label className="cursor-pointer group">
                    <span className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 group-hover:bg-primary/90">
                      Choose CSV/Excel File
                    </span>
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => void handleFileUpload(e)} />
                  </label>
                  <p className="mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center leading-relaxed">
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
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <CheckCircle2 className="size-6 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">
                    {importResult.companiesImported} companies and {importResult.contactsImported} contacts imported
                  </p>
                  <p className="text-xs text-emerald-700/80 font-medium">
                    {importResult.errors.length === 0
                      ? "All rows were processed without reported issues."
                      : "Some rows were skipped — see details below."}
                  </p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-rose-50 border border-rose-100">
                  <AlertCircle className="size-6 text-rose-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-rose-900">{importResult.errors.length} issue(s)</p>
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1 pr-2">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-[11px] text-rose-800 font-medium break-words">
                          {err}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button
                className="w-full rounded-xl h-11 font-bold shadow-lg shadow-primary/10 mt-2"
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
