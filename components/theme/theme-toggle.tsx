"use client";

import { useState, useSyncExternalStore } from "react";
import { LaptopMinimal, Moon, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/providers/theme-provider";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof SunMedium;
}> = [
  {
    value: "light",
    label: "Light mode",
    description: "Bright workspace for daytime use.",
    icon: SunMedium,
  },
  {
    value: "dark",
    label: "Dark mode",
    description: "Low-glare view for focused work.",
    icon: Moon,
  },
  {
    value: "system",
    label: "Device default",
    description: "Follow the theme from your device.",
    icon: LaptopMinimal,
  },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const activeTheme = isHydrated ? resolvedTheme : "light";
  const activeLabel = themeOptions.find((option) => option.value === theme)?.label ?? "Device default";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-11 rounded-2xl border-slate-200/80 bg-white/85 text-slate-600 shadow-sm backdrop-blur-sm hover:border-primary/30 hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-primary/40 dark:hover:bg-slate-900"
          aria-label="Change theme"
        >
          {activeTheme === "dark" ? (
            <Moon className="size-4.5" />
          ) : (
            <SunMedium className="size-4.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-60 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-2 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(15,23,42,1),rgba(2,6,23,0.98))] dark:shadow-[0_28px_70px_-28px_rgba(2,6,23,0.8)]"
      >
        <div className="flex items-center justify-between gap-3 px-2.5 pb-2 pt-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Appearance</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{activeLabel}</p>
          </div>
          <div className="min-w-[72px] rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {theme === "system" ? `Auto ${resolvedTheme}` : resolvedTheme}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const active = theme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[18px] border px-2 py-3 text-center transition-all duration-200",
                  "border-slate-200/80 bg-slate-50 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-950",
                  active && "border-primary/25 bg-primary/5 shadow-[0_14px_24px_-20px_rgba(20,184,166,0.4)] dark:border-primary/30 dark:bg-primary/10",
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300",
                    active && "border-primary/25 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15",
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {option.value === "system" ? "Device" : option.value === "light" ? "Light" : "Dark"}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {option.value === "system" ? "Auto" : "Mode"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-2.5 pb-1.5 pt-2">
          <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
            Switch instantly. Your choice stays saved on this device.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
