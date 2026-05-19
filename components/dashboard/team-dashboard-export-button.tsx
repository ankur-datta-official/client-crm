"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type TeamDashboardExportButtonProps = {
  filters: {
    from: string;
    to: string;
    managerId: string | null;
    teamId: string | null;
    memberId: string | null;
  };
  className?: string;
};

function parseDownloadFileName(header: string | null) {
  if (!header) {
    return null;
  }

  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}

export function TeamDashboardExportButton({ filters, className }: TeamDashboardExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);

    try {
      const response = await fetch("/api/export/team-dashboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? "Export failed.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const fileName = parseDownloadFileName(response.headers.get("Content-Disposition")) ?? "team-dashboard-export.xlsx";

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success("Team dashboard export downloaded.");
    } catch {
      toast.error("Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={isExporting}
      onClick={() => void handleExport()}
    >
      {isExporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
      Export Report
    </Button>
  );
}
