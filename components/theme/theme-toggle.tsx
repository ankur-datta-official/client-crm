"use client";

import { LaptopMinimal, Moon, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/providers/theme-provider";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

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
  const [isHydrated, setIsHydrated] = useState(false);
  const ActiveIcon = isHydrated && resolvedTheme === "dark" ? Moon : SunMedium;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="size-11 rounded-2xl border-slate-200/80 bg-white/85 text-slate-600 shadow-sm backdrop-blur-sm hover:border-primary/30 hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-primary/40 dark:hover:bg-slate-900"
        aria-label="Change theme"
      >
        <SunMedium className="size-4.5" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-11 rounded-2xl border-slate-200/80 bg-white/85 text-slate-600 shadow-sm backdrop-blur-sm hover:border-primary/30 hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-primary/40 dark:hover:bg-slate-900"
          aria-label="Change theme"
        >
          <ActiveIcon className="size-4.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-72 rounded-[24px] border-slate-200/70 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95"
      >
        <div className="px-3 py-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Appearance</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose how the CRM should look for you.</p>
        </div>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
          {themeOptions.map((option) => {
            const Icon = option.icon;

            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="mx-1 rounded-2xl px-10 py-3 focus:bg-slate-50 dark:focus:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
                      theme === option.value && "border-primary/25 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{option.label}</p>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</p>
                  </div>
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
