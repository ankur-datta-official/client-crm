import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CrmSettingsCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  ctaLabel?: string;
  badge?: string;
  meta?: string;
  disabled?: boolean;
};

export function CrmSettingsCard({
  title,
  description,
  href,
  icon: Icon,
  ctaLabel = "Manage",
  badge,
  meta,
  disabled = false,
}: CrmSettingsCardProps) {
  return (
    <Card
      className={cn(
        "group relative h-full overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_20px_70px_-56px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_28px_80px_-52px_rgba(13,148,136,0.28)] dark:border-slate-800/80 dark:bg-slate-950/80 dark:shadow-[0_20px_70px_-56px_rgba(2,6,23,0.9)] dark:hover:border-teal-500/30 dark:hover:shadow-[0_28px_80px_-52px_rgba(20,184,166,0.18)]",
        "group relative h-full overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_20px_70px_-56px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_28px_80px_-52px_rgba(13,148,136,0.28)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.95),rgba(15,23,42,0.92))] dark:shadow-[0_20px_70px_-56px_rgba(2,6,23,0.9)] dark:hover:border-teal-500/30 dark:hover:shadow-[0_28px_80px_-52px_rgba(20,184,166,0.18)]",
        disabled && "hover:translate-y-0 hover:shadow-soft",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 opacity-90" />
      <CardContent className="flex h-full flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-emerald-200/70 dark:shadow-emerald-950/60">
            <Icon className="size-5" />
          </div>
          {badge ? (
            <Badge
              variant={disabled ? "outline" : "secondary"}
              className={cn(
                "max-w-full shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold",
                !disabled && "border-teal-100 bg-teal-50 text-teal-700 dark:border-teal-400/35 dark:bg-teal-950 dark:text-white dark:shadow-[0_12px_24px_-18px_rgba(20,184,166,0.4)]",
              )}
            >
              {badge}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
          </div>
          {meta ? <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">{meta}</p> : null}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-300">{disabled ? "Not available yet" : "Open settings"}</p>
          {disabled || !href ? (
            <Button type="button" variant="outline" disabled>
              {ctaLabel}
            </Button>
          ) : (
            <Button asChild variant="outline" className="group/button rounded-xl border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900">
              <Link href={href}>
                {ctaLabel}
                <ArrowRight className="transition-transform duration-200 group-hover/button:translate-x-0.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
