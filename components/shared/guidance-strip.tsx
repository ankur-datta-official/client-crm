"use client";

import { useState, useSyncExternalStore } from "react";
import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GuidanceStripProps = {
  children: React.ReactNode;
  dismissible?: boolean;
  storageKey?: string;
  className?: string;
};

export function GuidanceStrip({
  children,
  dismissible = false,
  storageKey,
  className,
}: GuidanceStripProps) {
  const [dismissedLocally, setDismissedLocally] = useState(false);

  const dismissedFromStorage = useSyncExternalStore(
    () => () => undefined,
    () => {
      if (!dismissible || !storageKey || typeof window === "undefined") {
        return false;
      }

      return window.localStorage.getItem(storageKey) === "dismissed";
    },
    () => false,
  );

  function handleDismiss() {
    setDismissedLocally(true);

    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "dismissed");
    }
  }

  if (dismissedLocally || dismissedFromStorage) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 shadow-soft dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm dark:bg-slate-950">
          <Lightbulb className="size-4" />
        </div>
        <div className="min-w-0 flex-1 leading-6">{children}</div>
        {dismissible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 dark:hover:bg-slate-950 dark:hover:text-slate-200"
            onClick={handleDismiss}
            aria-label="Dismiss tip"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
