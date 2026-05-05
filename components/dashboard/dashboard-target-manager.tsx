"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { upsertPerformanceTarget } from "@/lib/team/performance-actions";
import { PERFORMANCE_TARGET_METRICS, type PerformanceMetricSnapshot } from "@/lib/team/types";

type DashboardTargetManagerProps = {
  userId: string;
  metrics: PerformanceMetricSnapshot[];
};

function currentDay() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthStart() {
  const now = new Date();
  now.setDate(1);
  return now.toISOString().slice(0, 10);
}

export function DashboardTargetManager({ userId, metrics }: DashboardTargetManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="rounded-[28px] border-slate-200/80 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-800/80 dark:bg-slate-950/88 dark:shadow-[0_10px_24px_rgba(2,6,23,0.45)]">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>My productivity targets</CardTitle>
            <CardDescription>Set your own daily and monthly focus numbers so the dashboard can compare target vs actual automatically.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {metrics.map((metric) => (
          <div key={metric.metric} className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 md:grid-cols-[1.1fr_0.9fr_0.9fr] md:items-center dark:border-slate-800 dark:bg-slate-900/75">
            <div>
              <div className="font-medium text-slate-900 dark:text-slate-100">{metric.label}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Today {metric.dailyActual}/{metric.dailyTarget || 0} • This month {metric.monthlyActual}/{metric.monthlyTarget || 0}
              </div>
            </div>

            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const value = Number(formData.get("targetValue"));
                setError(null);
                startTransition(async () => {
                  try {
                    await upsertPerformanceTarget({
                      userId,
                      metricKey: metric.metric,
                      periodType: "daily",
                      targetValue: value,
                      effectiveDate: currentDay(),
                    });
                    router.refresh();
                  } catch (submissionError) {
                    setError(submissionError instanceof Error ? submissionError.message : "Unable to save daily target.");
                  }
                });
              }}
            >
              <input type="hidden" name="metricKey" value={metric.metric} />
              <input
                type="number"
                min={1}
                name="targetValue"
                defaultValue={metric.dailyTarget || ""}
                className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-ring dark:bg-slate-950 dark:text-slate-100"
                placeholder="Daily"
              />
              <Button type="submit" variant="outline" size="sm" disabled={isPending}>
                Save daily
              </Button>
            </form>

            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const value = Number(formData.get("targetValue"));
                setError(null);
                startTransition(async () => {
                  try {
                    await upsertPerformanceTarget({
                      userId,
                      metricKey: metric.metric,
                      periodType: "monthly",
                      targetValue: value,
                      effectiveDate: currentMonthStart(),
                    });
                    router.refresh();
                  } catch (submissionError) {
                    setError(submissionError instanceof Error ? submissionError.message : "Unable to save monthly target.");
                  }
                });
              }}
            >
              <input type="hidden" name="metricKey" value={metric.metric} />
              <input
                type="number"
                min={1}
                name="targetValue"
                defaultValue={metric.monthlyTarget || ""}
                className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-ring dark:bg-slate-950 dark:text-slate-100"
                placeholder="Monthly"
              />
              <Button type="submit" variant="outline" size="sm" disabled={isPending}>
                Save monthly
              </Button>
            </form>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
