"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Crown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { switchSubscriptionPlan } from "@/lib/subscription/subscription-actions";
import type { SubscriptionPlan } from "@/lib/subscription/types";

type SubscriptionPlanCardProps = {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  canManage: boolean;
  featureItems: string[];
};

export function SubscriptionPlanCard({ plan, isCurrent, canManage, featureItems }: SubscriptionPlanCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEnterprise = plan.slug === "enterprise";
  const isPopular = plan.slug === "professional" || plan.slug === "business";

  function handleSwitch() {
    setError(null);
    startTransition(async () => {
      try {
        await switchSubscriptionPlan(plan.id);
        router.refresh();
      } catch (switchError) {
        setError(switchError instanceof Error ? switchError.message : "Unable to change the plan.");
      }
    });
  }

  return (
    <Card
      className={
        isCurrent
          ? "relative overflow-hidden border-teal-300 bg-gradient-to-br from-white via-teal-50/80 to-emerald-50/90 shadow-[0_28px_80px_-52px_rgba(13,148,136,0.65)]"
          : "relative overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_22px_70px_-56px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_32px_80px_-52px_rgba(13,148,136,0.35)]"
      }
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
      <CardHeader className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {isCurrent ? (
                <Badge variant="success" className="max-w-full rounded-full px-3 py-1 text-[10px] font-semibold sm:text-[11px]">
                  <Crown className="mr-1 h-3.5 w-3.5" />
                  Current plan
                </Badge>
              ) : null}
              {isPopular ? (
                <Badge variant="outline" className="max-w-full rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold text-sky-700 sm:text-[11px]">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Growth ready
                </Badge>
              ) : null}
              {isEnterprise ? (
                <Badge variant="warning" className="max-w-full rounded-full px-3 py-1 text-[10px] font-semibold sm:text-[11px]">
                  Custom onboarding
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-2xl text-slate-950">{plan.name}</CardTitle>
            <CardDescription className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{plan.description}</CardDescription>
          </div>
          <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-500">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[24px] border border-slate-200/80 bg-white/85 p-4 shadow-sm">
          <div className="text-4xl font-semibold tracking-tight text-slate-950">
            {isEnterprise ? "Custom" : `$${Number(plan.monthly_price).toFixed(0)}`}
            <span className="ml-1 text-sm font-normal text-slate-500">/month</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {isEnterprise
              ? "Tailored pricing for advanced governance, support, and scale."
              : "Flexible monthly pricing designed for growing CRM operations."}
          </p>
        </div>

        <div className="grid gap-2.5 text-sm">
          <PlanLimitRow label="Users" value={plan.max_users === null ? "Unlimited" : `${plan.max_users}`} />
          <PlanLimitRow label="Companies" value={plan.max_companies === null ? "Unlimited" : plan.max_companies.toLocaleString()} />
          <PlanLimitRow label="Storage" value={plan.storage_limit_mb === null ? "Unlimited" : `${plan.storage_limit_mb.toLocaleString()} MB`} />
          <PlanLimitRow label="File limit" value={plan.file_size_limit_mb === null ? "Unlimited" : `${plan.file_size_limit_mb} MB`} />
        </div>

        <div className="space-y-2 rounded-[24px] border border-slate-200/80 bg-slate-50/85 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Included features</p>
          {featureItems.map((item) => (
            <div key={item} className="flex items-center gap-2 text-slate-600">
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {canManage ? (
          <Button
            type="button"
            className={isCurrent ? "w-full border-slate-200 bg-white text-slate-500 hover:bg-white" : "w-full bg-slate-950 text-white hover:bg-slate-800"}
            variant={isCurrent ? "outline" : "default"}
            disabled={isPending || isCurrent}
            onClick={handleSwitch}
          >
            {isCurrent ? "Current Plan" : isPending ? "Switching..." : "Switch Plan"}
          </Button>
        ) : (
          <p className="text-sm leading-6 text-slate-500">Manual billing changes are handled by your workspace administrator.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PlanLimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
