"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ReportSectionIntro } from "./report-visuals";

interface ReportTabsProps {
  currentTab: string;
  lockedTabs?: string[];
  description?: string;
  children: ReactNode;
}

const reportTabs = [
  { value: "sales-overview", label: "Sales Overview" },
  { value: "leads", label: "Leads" },
  { value: "pipeline", label: "Pipeline" },
  { value: "meetings", label: "Meetings" },
  { value: "follow-ups", label: "Follow-ups" },
  { value: "documents", label: "Documents" },
  { value: "help-requests", label: "Help Requests" },
  { value: "team", label: "Team Performance" },
] as const;

export function ReportTabs({ currentTab, lockedTabs = [], description, children }: ReportTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    if (lockedTabs.includes(value)) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
      <div className="overflow-x-auto pb-1 scrollbar-hide print:hidden">
        <TabsList className="inline-flex h-auto min-w-max gap-2 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-1.5 shadow-soft dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
          {reportTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={lockedTabs.includes(tab.value)}
              className={cn(
                "rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-600 transition dark:text-slate-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                lockedTabs.includes(tab.value) && "opacity-50",
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {description ? (
        <ReportSectionIntro
          text={description}
          dismissible
          storageKey={`crm-tip-reports-${currentTab}`}
        />
      ) : null}
      <div className="mt-6">
        {children}
      </div>
    </Tabs>
  );
}
