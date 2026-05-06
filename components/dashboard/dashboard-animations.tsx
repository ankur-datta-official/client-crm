"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  ArrowRight, 
  ChevronRight, 
  TrendingUp, 
  TimerOff, 
  FolderKanban, 
  LifeBuoy,
  Clock3,
  CircleHelp,
  CalendarClock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

// --- Components ---

export function StatusPill({
  tone,
  children,
}: {
  tone: "rose" | "amber" | "blue" | "emerald";
  children: React.ReactNode;
}) {
  const classes = {
    rose: "bg-rose-50 text-rose-700 dark:border dark:border-rose-300/18 dark:bg-[linear-gradient(180deg,rgba(136,19,55,0.92)_0%,rgba(103,12,42,0.95)_100%)] dark:text-rose-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_-12px_rgba(225,29,72,0.55)]",
    amber: "bg-amber-50 text-amber-700 dark:border dark:border-amber-300/18 dark:bg-[linear-gradient(180deg,rgba(133,77,14,0.92)_0%,rgba(113,63,18,0.95)_100%)] dark:text-amber-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_-12px_rgba(245,158,11,0.45)]",
    blue: "bg-sky-50 text-sky-700 dark:border dark:border-sky-300/18 dark:bg-[linear-gradient(180deg,rgba(12,74,110,0.92)_0%,rgba(8,47,73,0.96)_100%)] dark:text-sky-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_-12px_rgba(14,165,233,0.45)]",
    emerald: "bg-emerald-50 text-emerald-700 dark:border dark:border-emerald-300/18 dark:bg-[linear-gradient(180deg,rgba(6,78,59,0.92)_0%,rgba(6,58,46,0.96)_100%)] dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_-12px_rgba(16,185,129,0.42)]",
  };

  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium tracking-[0.01em]", classes[tone])}>{children}</span>;
}

export function ActivityRow({ item }: { item: any }) {
  return (
    <Link
      href={item.href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-primary/25 hover:bg-slate-50/70 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(17,24,39,0.95)_100%)] dark:shadow-[inset_0_1px_0_rgba(148,163,184,0.06)] dark:hover:border-primary/30 dark:hover:bg-[linear-gradient(180deg,rgba(15,23,42,1)_0%,rgba(30,41,59,0.96)_100%)]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-300">{item.subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusPill tone={item.tone}>{item.badge}</StatusPill>
        <ChevronRight className="size-4 text-slate-400 dark:text-slate-500" />
      </div>
    </Link>
  );
}

export function DashboardCard({
  title,
  description,
  actionHref,
  actionLabel,
  headerRight,
  className,
  contentClassName,
  children,
  delay = 0.2,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  headerRight?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="h-full"
    >
      <Card className={cn("border-slate-200/80 bg-white/95 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(17,24,39,0.96)_100%)]", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-[1.02rem]">{title}</CardTitle>
              <CardDescription className="mt-2">{description}</CardDescription>
            </div>
            {headerRight ? (
              headerRight
            ) : actionHref && actionLabel ? (
              <Button asChild variant="ghost" size="sm" className="rounded-full">
                <Link href={actionHref}>
                  {actionLabel}
                  <ArrowRight className="ml-1 size-3" />
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

export function CompactEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center dark:border-slate-800 dark:bg-slate-900/75">
      <div className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-400">
        <TrendingUp className="size-4" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

const ICON_MAP = {
  TimerOff,
  FolderKanban,
  LifeBuoy,
  Clock3,
  CircleHelp,
  CalendarClock
};

export function AlertCard({ alert, index = 0 }: { alert: any; index?: number }) {
  const toneClasses = {
    rose: "border-rose-100 bg-rose-50/50 text-rose-950 hover:bg-rose-50 hover:border-rose-200 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/15",
    amber: "border-amber-100 bg-amber-50/50 text-amber-950 hover:bg-amber-50 hover:border-amber-200 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/15",
    teal: "border-sky-100 bg-sky-50/50 text-sky-950 hover:bg-sky-50 hover:border-sky-200 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:border-sky-500/30 dark:hover:bg-sky-500/15",
  };
  const iconToneClasses = {
    rose: "bg-rose-500 text-white shadow-sm shadow-rose-200 dark:shadow-rose-950/70",
    amber: "bg-amber-500 text-white shadow-sm shadow-amber-200 dark:shadow-amber-950/70",
    teal: "bg-sky-500 text-white shadow-sm shadow-sky-200 dark:shadow-sky-950/70",
  };
  
  // Use icon mapping to avoid passing function from server
  const Icon = ICON_MAP[alert.iconName as keyof typeof ICON_MAP] || TimerOff;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        href={alert.href}
        className={cn(
          "flex items-center justify-between rounded-[24px] border p-4 transition-all duration-200",
          toneClasses[alert.tone as keyof typeof toneClasses]
        )}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl",
            iconToneClasses[alert.tone as keyof typeof iconToneClasses]
          )}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-bold tracking-tight">{alert.count}</p>
              <p className="text-sm font-bold tracking-tight truncate">{alert.title}</p>
            </div>
            <p className="mt-0.5 text-xs opacity-70 truncate">{alert.description}</p>
          </div>
        </div>
        <ChevronRight className="size-4 opacity-40 shrink-0 ml-2" />
      </Link>
    </motion.div>
  );
}

export function TaskRow({ task }: { task: any }) {
  const toneClasses = {
    rose: "bg-rose-50 text-rose-700 dark:border dark:border-rose-300/18 dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_58%),linear-gradient(180deg,rgba(136,19,55,0.92)_0%,rgba(103,12,42,0.96)_100%)] dark:text-rose-100 dark:shadow-[0_10px_24px_-16px_rgba(225,29,72,0.55)]",
    amber: "bg-amber-50 text-amber-700 dark:border dark:border-amber-300/18 dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_58%),linear-gradient(180deg,rgba(133,77,14,0.92)_0%,rgba(113,63,18,0.96)_100%)] dark:text-amber-100 dark:shadow-[0_10px_24px_-16px_rgba(245,158,11,0.5)]",
    blue: "bg-sky-50 text-sky-700 dark:border dark:border-sky-300/18 dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_58%),linear-gradient(180deg,rgba(12,74,110,0.92)_0%,rgba(8,47,73,0.96)_100%)] dark:text-sky-100 dark:shadow-[0_10px_24px_-16px_rgba(14,165,233,0.5)]",
  };
  
  // Use icon mapping to avoid passing function from server
  const Icon = ICON_MAP[task.iconName as keyof typeof ICON_MAP] || TimerOff;

  return (
    <Link
      href={task.href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition-colors hover:border-primary/25 hover:bg-slate-50/70 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(17,24,39,0.95)_100%)] dark:shadow-[inset_0_1px_0_rgba(148,163,184,0.06)] dark:hover:border-primary/30 dark:hover:bg-[linear-gradient(180deg,rgba(15,23,42,1)_0%,rgba(30,41,59,0.96)_100%)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${toneClasses[task.tone as keyof typeof toneClasses]}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{task.title}</p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-300">{task.subtitle}</p>
        </div>
      </div>
      <StatusPill tone={task.tone}>{task.badge}</StatusPill>
    </Link>
  );
}

export function ProgressMetric({
  label,
  value,
  target,
  colorClassName,
}: {
  label: string;
  value: number;
  target: number;
  colorClassName: string;
}) {
  const progress = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(17,24,39,0.95)_100%)] dark:shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          {value}/{target}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/80">
        <div className={`h-full rounded-full ${colorClassName}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function getFunnelGradient(color: string, index: number) {
  const gradients = [
    "linear-gradient(135deg, #0f8f73 0%, #16997d 45%, #0f7f69 100%)",
    "linear-gradient(135deg, #86df91 0%, #67cf77 45%, #4bb55f 100%)",
    "linear-gradient(135deg, #ffe37b 0%, #ffd85a 46%, #ffcb38 100%)",
    "linear-gradient(135deg, #ffc254 0%, #ffaf2d 48%, #ff9808 100%)",
    "linear-gradient(135deg, #ff6356 0%, #ff4739 46%, #ef2f26 100%)",
  ];

  return gradients[index] ?? `linear-gradient(135deg, ${color} 0%, ${color} 100%)`;
}

export function PipelineFunnel({ stages }: { stages: any[] }) {
  return (
    <div className="flex flex-col items-center w-full px-2 py-1">
      {stages.map((stage, index) => (
        <motion.div
          key={stage.id}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.8, delay: index * 0.1 }}
          className="relative flex h-10 w-full items-center justify-between overflow-hidden px-4 text-white shadow-sm"
          style={{
            background: getFunnelGradient(stage.color, index),
            width: `${stage.width}%`,
            borderBottom: index !== stages.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
            borderRadius: index === 0 ? "12px 12px 4px 4px" : index === stages.length - 1 ? "4px 4px 12px 12px" : "4px",
            marginBottom: "2px"
          }}
        >
          <span className="text-[12px] font-bold tracking-wide drop-shadow-sm truncate pr-2">
            {stage.name}
          </span>
          <span className="text-[13px] font-black drop-shadow-md">
            {stage.count}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// --- Animated Layout Wrappers ---

export function AnimatedHeader({ children }: { children: React.ReactNode }) {
  return (
    <motion.section 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 px-1 py-1 lg:flex-row lg:items-end lg:justify-between"
    >
      {children}
    </motion.section>
  );
}

export function AnimatedGridItem({ children, index = 0, delay = 0.05 }: { children: React.ReactNode; index?: number; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * delay }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedList({ items, renderItem }: { items: any[]; renderItem: (item: any, index: number) => React.ReactNode }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <motion.div
          key={item.id || index}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </div>
  );
}
