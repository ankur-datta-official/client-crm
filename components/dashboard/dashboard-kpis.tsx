"use client";

import { Handshake, CalendarClock, LifeBuoy } from "lucide-react";
import { AnimatedGridItem } from "./dashboard-animations";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";

function TakaIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-[21px] font-semibold leading-none",
        className,
      )}
    >
      {"\u09F3"}
    </span>
  );
}

type DashboardKPIsProps = {
  pipelineValue: string;
  pipelineValueTrend: { value: string; isPositive: boolean; label: string };
  activeDeals: string;
  dealsTrend: { value: string; isPositive: boolean; label: string };
  todaysFollowupsCount: string;
  followupsTrend: { value: number; isPositive: boolean; label: string };
  openHelpRequestsCount: string;
  helpTrend: { value: number; isPositive: boolean; label: string };
};

export function DashboardKPIs({
  pipelineValue,
  pipelineValueTrend,
  activeDeals,
  dealsTrend,
  todaysFollowupsCount,
  followupsTrend,
  openHelpRequestsCount,
  helpTrend,
}: DashboardKPIsProps) {
  const kpis = [
    {
      title: "Pipeline Value",
      value: pipelineValue,
      description: "Total estimated value",
      icon: TakaIcon,
      tone: "teal" as const,
      href: "/pipeline",
      trend: pipelineValueTrend,
    },
    {
      title: "Deals in Progress",
      value: activeDeals,
      description: "Active deals",
      icon: Handshake,
      tone: "blue" as const,
      href: "/pipeline",
      trend: dealsTrend,
    },
    {
      title: "Follow-ups Today",
      value: todaysFollowupsCount,
      description: "Tasks to complete",
      icon: CalendarClock,
      tone: "amber" as const,
      href: "/followups",
      trend: {
        ...followupsTrend,
        value: String(followupsTrend.value),
      },
    },
    {
      title: "Open Help Requests",
      value: openHelpRequestsCount,
      description: "Needs support",
      icon: LifeBuoy,
      tone: "rose" as const,
      href: "/need-help",
      trend: {
        ...helpTrend,
        value: String(helpTrend.value),
      },
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, index) => (
        <AnimatedGridItem key={kpi.title} index={index}>
          <StatCard {...kpi} className="h-full" />
        </AnimatedGridItem>
      ))}
    </section>
  );
}
