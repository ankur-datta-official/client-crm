"use client";

import { useState } from "react";
import type React from "react";
import { Info, Sparkles, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FormRequiredNote({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-soft dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(9,14,28,0.96))] dark:text-slate-300 dark:shadow-[0_20px_45px_-30px_rgba(2,6,23,0.95)]">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
        <div className="space-y-1">
          <p className="font-medium text-slate-900 dark:text-slate-100">Required fields are marked with <span className="text-rose-600">*</span>.</p>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}

export function FormContextHint({
  message,
}: {
  message: string;
}) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="flex-1">{message}</p>
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-teal-700/80 transition hover:bg-teal-600/10 hover:text-teal-900 dark:text-teal-200/80 dark:hover:bg-teal-400/10 dark:hover:text-teal-100"
          aria-label="Close tip"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function FormActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-3 shadow-soft",
        "dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(8,13,26,0.98))] dark:shadow-[0_24px_50px_-32px_rgba(2,6,23,0.98)]",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">{children}</div>
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
  contentClassName,
  optional = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  optional?: boolean;
}) {
  return (
    <Card className={className}>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {optional ? (
          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
            Optional
          </span>
        ) : null}
      </CardHeader>
      <CardContent className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
