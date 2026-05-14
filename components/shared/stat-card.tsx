"use client";

import type { ComponentType } from "react";
import { Building2, Handshake, LucideIcon, NotebookTabs, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { motion } from "framer-motion";

type StatCardProps = {
  title: string;
  value: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  iconName?: "building" | "notebook" | "handshake";
  tone?: "teal" | "amber" | "rose" | "blue" | "slate";
  href?: string;
  className?: string;
  trend?: {
    value: string | number;
    label: string;
    isPositive: boolean;
  };
};

const toneClasses = {
  teal: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
};

const trendToneClasses = {
  teal: "text-teal-600 dark:text-teal-300",
  amber: "text-amber-600 dark:text-amber-300",
  rose: "text-rose-600 dark:text-rose-300",
  blue: "text-sky-600 dark:text-sky-300",
  slate: "text-slate-600 dark:text-slate-300",
};

const toneSurfaceClasses = {
  teal: "dark:border-teal-500/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.12),transparent_30%),linear-gradient(180deg,rgba(17,24,39,0.98)_0%,rgba(15,23,42,0.96)_100%)]",
  amber: "dark:border-amber-500/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_30%),linear-gradient(180deg,rgba(17,24,39,0.98)_0%,rgba(15,23,42,0.96)_100%)]",
  rose: "dark:border-rose-500/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.1),transparent_30%),linear-gradient(180deg,rgba(17,24,39,0.98)_0%,rgba(15,23,42,0.96)_100%)]",
  blue: "dark:border-sky-500/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,rgba(17,24,39,0.98)_0%,rgba(15,23,42,0.96)_100%)]",
  slate: "dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.98)_0%,rgba(15,23,42,0.96)_100%)]",
};

export function StatCard({
  title,
  value,
  description,
  icon,
  tone = "teal",
  iconName,
  href,
  className,
  trend,
}: StatCardProps) {
  const iconMap: Record<NonNullable<StatCardProps["iconName"]>, LucideIcon> = {
    building: Building2,
    notebook: NotebookTabs,
    handshake: Handshake,
  };
  const ResolvedIcon = icon ?? (iconName ? iconMap[iconName] : Building2);

  const content = (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Card
        className={cn(
          "rounded-[24px] border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 dark:shadow-[0_12px_30px_-18px_rgba(2,6,23,0.9)]",
          toneSurfaceClasses[tone],
          href && "hover:border-slate-300 hover:shadow-[0_8px_16px_rgba(0,0,0,0.06)] hover:bg-slate-50/30 dark:hover:border-slate-700 dark:hover:bg-slate-900/80",
          className,
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
              <p className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
              <div className="mt-2 flex flex-col gap-1">
                {description ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    {description}
                  </p>
                ) : null}
                {trend ? (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-[11px] font-bold",
                      trendToneClasses[tone],
                    )}
                  >
                    {trend.isPositive ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    <span>
                      {trend.value} {trend.label}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
                toneClasses[tone],
              )}
            >
              <ResolvedIcon className="size-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
