"use client";

import { LaptopMinimal, Moon, SunMedium } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Card, CardContent } from "@/components/ui/card";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const options: Array<{
  value: ThemePreference;
  title: string;
  description: string;
  icon: typeof SunMedium;
}> = [
  {
    value: "light",
    title: "Light mode",
    description: "Keep the CRM bright and crisp.",
    icon: SunMedium,
  },
  {
    value: "dark",
    title: "Dark mode",
    description: "Reduce glare for long sessions.",
    icon: Moon,
  },
  {
    value: "system",
    title: "Device default",
    description: "Sync with your laptop or phone theme.",
    icon: LaptopMinimal,
  },
];

export function ThemePreferenceCard() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <Card className="group relative h-full overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_20px_70px_-56px_rgba(15,23,42,0.45)] transition-all duration-200 dark:border-slate-800/80 dark:bg-slate-950/80 dark:shadow-[0_20px_70px_-56px_rgba(2,6,23,0.9)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 opacity-90" />
      <CardContent className="flex h-full flex-col gap-5 p-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-lg shadow-cyan-200/70 dark:shadow-cyan-950/60">
              {resolvedTheme === "dark" ? <Moon className="size-5" /> : <SunMedium className="size-5" />}
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {theme === "system" ? `System - ${resolvedTheme}` : theme}
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Choose the view that feels best for you. Your preference stays saved on this device.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {options.map((option) => {
            const Icon = option.icon;
            const active = theme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                  "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-primary/30 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-primary/40 dark:hover:bg-slate-900",
                  active && "border-primary/30 bg-primary/5 shadow-sm dark:border-primary/40 dark:bg-primary/10",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300",
                    active && "border-primary/20 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15",
                  )}
                >
                  <Icon className="size-4.5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{option.title}</p>
                  <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
