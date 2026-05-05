"use client";

import type React from "react";
import { Info, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FormRequiredNote({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-soft dark:border-slate-800 dark:bg-slate-950/88 dark:text-slate-300">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
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
  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{message}</p>
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
        "dark:border-slate-800 dark:bg-slate-950/88",
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
          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
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
