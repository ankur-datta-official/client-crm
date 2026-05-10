"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateBD } from "@/lib/format/datetime";
import { deletePerformanceTarget, upsertPerformanceTarget } from "@/lib/team/performance-actions";
import {
  PERFORMANCE_TARGET_METRICS,
  PERFORMANCE_TARGET_PERIODS,
  type TeamMember,
  type UserPerformanceTarget,
} from "@/lib/team/types";

type TeamTargetManagerProps = {
  members: TeamMember[];
  targets: UserPerformanceTarget[];
  canManage: boolean;
};

function getDefaultEffectiveDate(periodType: "daily" | "monthly") {
  const now = new Date();
  if (periodType === "monthly") {
    now.setDate(1);
  }
  return now.toISOString().slice(0, 10);
}

export function TeamTargetManager({ members, targets, canManage }: TeamTargetManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeMembers = useMemo(() => members.filter((member) => member.is_active), [members]);
  const [form, setForm] = useState({
    userId: activeMembers[0]?.id ?? "",
    metricKey: "leads_created",
    periodType: "daily",
    targetValue: "3",
    effectiveDate: getDefaultEffectiveDate("daily"),
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return null;
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.9)]">
      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
          <Target className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Team targets</h3>
          <p className="text-sm text-muted-foreground">
            Assign daily or monthly targets to keep each junior team member focused on measurable CRM work.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form
        className="mt-5 grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-5 dark:border-slate-800 dark:bg-slate-950/60"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              await upsertPerformanceTarget({
                userId: form.userId,
                metricKey: form.metricKey,
                periodType: form.periodType,
                targetValue: Number(form.targetValue),
                effectiveDate: form.effectiveDate,
                notes: form.notes,
              });
              router.refresh();
            } catch (submissionError) {
              setError(submissionError instanceof Error ? submissionError.message : "Unable to save team target.");
            }
          });
        }}
      >
        <select
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring dark:border-slate-800 dark:bg-slate-950/85 dark:[color-scheme:dark]"
          value={form.userId}
          onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
        >
          {activeMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name ?? member.email}
            </option>
          ))}
        </select>

        <select
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring dark:border-slate-800 dark:bg-slate-950/85 dark:[color-scheme:dark]"
          value={form.metricKey}
          onChange={(event) => setForm((current) => ({ ...current, metricKey: event.target.value }))}
        >
          {Object.entries(PERFORMANCE_TARGET_METRICS).map(([metricKey, label]) => (
            <option key={metricKey} value={metricKey}>
              {label}
            </option>
          ))}
        </select>

        <select
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring dark:border-slate-800 dark:bg-slate-950/85 dark:[color-scheme:dark]"
          value={form.periodType}
          onChange={(event) => {
            const periodType = event.target.value as "daily" | "monthly";
            setForm((current) => ({
              ...current,
              periodType,
              effectiveDate: getDefaultEffectiveDate(periodType),
            }));
          }}
        >
          {PERFORMANCE_TARGET_PERIODS.map((period) => (
            <option key={period} value={period}>
              {period === "daily" ? "Daily target" : "Monthly target"}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring dark:border-slate-800 dark:bg-slate-950/85"
          value={form.targetValue}
          onChange={(event) => setForm((current) => ({ ...current, targetValue: event.target.value }))}
          placeholder="Target"
        />

        <div className="flex gap-2">
          <input
            type="date"
            className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring dark:border-slate-800 dark:bg-slate-950/85 dark:[color-scheme:dark]"
            value={form.effectiveDate}
            onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))}
          />
          <Button type="submit" disabled={isPending || !form.userId}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>

      <div className="mt-5 space-y-3">
        {targets.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            No team targets have been assigned yet.
          </div>
        ) : (
          targets.map((target) => (
            <div key={target.id} className="flex flex-col gap-3 rounded-xl border bg-white px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-950/80">
              <div>
                <div className="font-medium text-foreground">
                  {target.profile?.full_name ?? target.profile?.email ?? "Unknown user"} • {PERFORMANCE_TARGET_METRICS[target.metric_key]} • {target.period_type}
                </div>
                <div className="text-sm text-muted-foreground">
                  Target {target.target_value} from {formatDateBD(target.effective_date)}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await deletePerformanceTarget(target.id);
                      router.refresh();
                    } catch (submissionError) {
                      setError(submissionError instanceof Error ? submissionError.message : "Unable to delete team target.");
                    }
                  });
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
