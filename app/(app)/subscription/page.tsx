import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDashed,
  Crown,
  FileStack,
  HardDriveDownload,
  Layers3,
  ShieldCheck,
  Sparkles,
  Stars,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanUsageCard } from "@/components/subscription/plan-usage-card";
import { SubscriptionPlanCard } from "@/components/subscription/subscription-plan-card";
import { UpgradePrompt } from "@/components/subscription/upgrade-prompt";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import {
  getAllPlans,
  getCurrentPlan,
  getCurrentSubscription,
  getOrganizationUsage,
} from "@/lib/subscription/subscription-queries";

const featureLabels = {
  custom_pipeline: "Custom pipeline configuration",
  pdf_export: "PDF export",
  csv_import: "CSV import",
  advanced_reports: "Advanced reports",
  audit_log: "Audit log access",
} as const;

type PlanFeatureKey = keyof typeof featureLabels;

export default async function SubscriptionPage() {
  await requirePermission("subscription.view");

  const [subscription, currentPlan, usage, plans, canManage] = await Promise.all([
    getCurrentSubscription(),
    getCurrentPlan(),
    getOrganizationUsage(),
    getAllPlans(),
    hasPermission("subscription.manage"),
  ]);

  const statusLabel = subscription?.status ? subscription.status.replace("_", " ") : "Unavailable";
  const trialEndsLabel = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : null;
  const enabledFeatureCount = Object.keys(featureLabels).filter((feature) => currentPlan && Boolean(currentPlan[feature as PlanFeatureKey])).length;
  const heroStats = [
    {
      icon: Users,
      label: "Seats in use",
      value: usage.reservedSeats.toLocaleString(),
      detail: currentPlan?.max_users === null ? "Unlimited capacity" : `${currentPlan?.max_users ?? 0} included`,
    },
    {
      icon: Building2,
      label: "Companies tracked",
      value: usage.companies.toLocaleString(),
      detail: currentPlan?.max_companies === null ? "Unlimited records" : `${currentPlan?.max_companies?.toLocaleString() ?? 0} limit`,
    },
    {
      icon: HardDriveDownload,
      label: "Storage used",
      value: `${usage.storageUsedMb.toFixed(2)} MB`,
      detail:
        currentPlan?.storage_limit_mb === null
          ? "Scales without a cap"
          : `${currentPlan?.storage_limit_mb?.toLocaleString() ?? 0} MB available`,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Subscription" description="Review plan packaging, workspace usage, limits, and feature availability." />

      <GuidanceStrip dismissible storageKey="crm-tip-subscription">
        Review your current plan, usage limits, and feature access here. Manual plan switching is only for internal testing when enabled.
      </GuidanceStrip>

      {!canManage ? (
        <UpgradePrompt
          title="Billing Integration"
          description="Payment gateway automation is not implemented in this sprint. Organization admins can still review packaging and usage here."
          ctaLabel="View Current Usage"
        />
      ) : null}

      <section>
        <Card className="overflow-hidden border-teal-200/80 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/70 shadow-[0_24px_80px_-56px_rgba(13,148,136,0.45)] dark:border-teal-500/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(6,78,59,0.18),rgba(15,23,42,0.98))] dark:shadow-[0_24px_80px_-40px_rgba(2,6,23,0.98)]">
          <CardContent className="p-6 lg:p-8">
            <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100">
                    <Crown className="mr-1.5 h-3.5 w-3.5" />
                    {currentPlan?.name ?? "No active plan"}
                  </Badge>
                  <Badge variant="success" className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize">
                    {statusLabel}
                  </Badge>
                  {trialEndsLabel ? (
                    <Badge variant="warning" className="rounded-full px-3 py-1.5 text-xs font-semibold">
                      Trial ends {trialEndsLabel}
                    </Badge>
                  ) : null}
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-white/90 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800/90 dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94),rgba(6,78,59,0.18))] dark:shadow-[inset_0_1px_0_rgba(148,163,184,0.08),0_28px_64px_-40px_rgba(2,6,23,0.98)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.16),_transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.12),_transparent_30%)]" />
                  <div className="relative grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700 shadow-sm dark:border-teal-400/35 dark:bg-teal-950 dark:text-white dark:shadow-[0_12px_28px_-20px_rgba(45,212,191,0.45)]">
                        <Stars className="h-3.5 w-3.5 animate-pulse" />
                        Smart plan intelligence
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="subscription-orbit rounded-2xl border border-white/90 bg-white/90 p-3 shadow-sm dark:border-slate-600/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96))] dark:shadow-[0_18px_36px_-24px_rgba(2,6,23,0.95)]">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 p-2 text-white shadow-lg shadow-emerald-200/70">
                              <Layers3 className="h-4 w-4" />
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">Live</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Usage and plan coverage stay visible without clutter.</p>
                        </div>
                        <div className="subscription-orbit-delayed rounded-2xl border border-white/90 bg-slate-900 p-3 text-white shadow-lg shadow-slate-300/40 dark:border-slate-600/80 dark:bg-[linear-gradient(180deg,rgba(3,7,18,1),rgba(15,23,42,0.98))] dark:shadow-[0_18px_36px_-24px_rgba(2,6,23,0.95)]">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <CircleDashed className="h-4 w-4 text-teal-300" />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60 dark:text-slate-300">Flow</span>
                          </div>
                          <p className="text-sm font-semibold text-white">Designed for fast scanning on desktop and smaller screens.</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-start sm:justify-end">
                      <div className="relative w-full max-w-[240px]">
                        <div className="subscription-float absolute left-2 top-2 rounded-full border border-white/90 bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-slate-600/80 dark:bg-slate-950 dark:text-white dark:shadow-[0_12px_24px_-18px_rgba(15,23,42,0.95)]">
                          Limits synced
                        </div>
                        <div className="subscription-float-delayed absolute right-0 top-10 rounded-full border border-teal-100 bg-teal-50/90 px-3 py-1 text-[11px] font-semibold text-teal-700 shadow-sm dark:border-teal-400/35 dark:bg-teal-900 dark:text-white dark:shadow-[0_12px_24px_-18px_rgba(20,184,166,0.42)]">
                          Feature access
                        </div>
                        <div className="subscription-float-slow absolute left-6 top-[72px] rounded-full border border-amber-100 bg-amber-50/90 px-3 py-1 text-[11px] font-semibold text-amber-700 shadow-sm dark:border-amber-300/35 dark:bg-amber-100 dark:text-amber-950 dark:shadow-[0_12px_24px_-18px_rgba(251,191,36,0.32)]">
                          Clean overview
                        </div>
                        <div className="h-28 rounded-[24px] border border-dashed border-teal-200/80 bg-gradient-to-br from-white/70 via-teal-50/70 to-emerald-50/70 dark:border-teal-400/25 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(6,78,59,0.22),rgba(15,23,42,0.88))]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700 shadow-sm dark:border-teal-400/35 dark:bg-teal-950/75 dark:text-teal-100 dark:shadow-[0_12px_24px_-18px_rgba(15,23,42,0.95)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Premium workspace control
                  </div>
                  <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                    Keep your subscription overview clean, confident, and easy to act on.
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                    Your team can quickly understand current usage, plan coverage, and available features without digging through crowded cards.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {heroStats.map(({ icon: Icon, label, value, detail }) => (
                    <div key={label} className="rounded-2xl border border-white/90 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_36px_-24px_rgba(2,6,23,0.95)]">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 p-2.5 text-white shadow-lg shadow-emerald-200/70">
                          <Icon className="h-4 w-4" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">{value}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 rounded-[28px] border border-white/80 bg-white/88 p-5 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-[0_24px_60px_-32px_rgba(2,6,23,0.98)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Workspace summary</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-100">Plan health overview</h3>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-2.5 text-white shadow-lg shadow-amber-200/70">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <PlanUsageCard
                    title="Users"
                    description="Active users plus pending invitations consume seats."
                    used={usage.reservedSeats}
                    limit={currentPlan?.max_users ?? null}
                  />
                  <PlanUsageCard
                    title="Companies"
                    description="Active lead and company records in this workspace."
                    used={usage.companies}
                    limit={currentPlan?.max_companies ?? null}
                    tone="sky"
                  />
                  <PlanUsageCard
                    title="Storage"
                    description="Total document storage currently used."
                    used={Math.round(usage.storageUsedMb)}
                    limit={currentPlan?.storage_limit_mb ?? null}
                    unit="MB"
                    tone="amber"
                  />
                  <Card className="border-slate-200/80 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/80">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Single file limit</p>
                        <div className="shrink-0 rounded-xl bg-white p-2.5 text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-200">
                          <FileStack className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-3xl font-semibold leading-none text-slate-950 dark:text-slate-100 sm:text-[2rem]">
                        {currentPlan?.file_size_limit_mb === null ? "Unlimited" : `${currentPlan?.file_size_limit_mb} MB`}
                      </p>
                      <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                        Per-upload allowance for documents, proposals, and supporting files.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-700 dark:border-teal-400/40 dark:bg-teal-950/80 dark:text-teal-100">
              <Sparkles className="h-3.5 w-3.5" />
              Plan comparison
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Available Plans</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Compare limits, features, and growth room below. Manual switching is for internal testing until billing automation is connected.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-300">
            {plans.length} plan options available for this workspace
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-4">
          {plans.map((plan) => (
            <SubscriptionPlanCard
              key={plan.id}
              plan={plan}
              isCurrent={currentPlan?.id === plan.id}
              canManage={canManage}
              featureItems={Object.entries(featureLabels)
                .filter(([feature]) => Boolean(plan[feature as PlanFeatureKey]))
                .map(([, label]) => label)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200/80 bg-white shadow-[0_20px_70px_-56px_rgba(15,23,42,0.45)] dark:border-slate-800/80 dark:bg-slate-950/85 dark:shadow-[0_20px_70px_-56px_rgba(2,6,23,0.85)]">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Current plan highlights</CardTitle>
                <CardDescription>Important workspace numbers at a glance.</CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:border-teal-400/40 dark:bg-teal-950/80 dark:text-teal-100">
                Live usage
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SummaryMetric
              icon={Users}
              label="Active users"
              value={String(usage.activeUsers)}
              detail={`${usage.pendingInvitations} pending invites`}
              tone="emerald"
            />
            <SummaryMetric
              icon={Building2}
              label="Companies"
              value={String(usage.companies)}
              detail={currentPlan?.max_companies === null ? "Unlimited max" : `${currentPlan?.max_companies?.toLocaleString() ?? 0} max`}
              tone="sky"
            />
            <SummaryMetric
              icon={HardDriveDownload}
              label="Storage used"
              value={`${usage.storageUsedMb.toFixed(2)} MB`}
              detail={currentPlan?.storage_limit_mb === null ? "Unlimited available" : `${currentPlan?.storage_limit_mb?.toLocaleString() ?? 0} MB cap`}
              tone="amber"
            />
            <SummaryMetric
              icon={FileStack}
              label="Single file limit"
              value={currentPlan?.file_size_limit_mb === null ? "Unlimited" : `${currentPlan?.file_size_limit_mb} MB`}
              detail="Per document upload"
              tone="slate"
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-[0_20px_70px_-56px_rgba(15,23,42,0.45)] dark:border-slate-800/80 dark:bg-slate-950/85 dark:shadow-[0_20px_70px_-56px_rgba(2,6,23,0.85)]">
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Feature availability</CardTitle>
                <CardDescription>Enabled and locked capabilities for the current plan.</CardDescription>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-2.5 text-white shadow-lg shadow-slate-200 dark:shadow-[0_16px_30px_-22px_rgba(2,6,23,0.95)]">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Enabled tools</p>
                  <p className="mt-1 text-3xl font-semibold text-slate-950 dark:text-slate-100">{enabledFeatureCount}</p>
                </div>
                <Badge variant="success" className="rounded-full px-3 py-1.5 text-xs font-semibold">
                  Current access
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(featureLabels).map(([feature, label]) => {
              const enabled = currentPlan ? Boolean(currentPlan[feature as PlanFeatureKey]) : false;

              return (
                <div
                  key={feature}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/75"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        enabled
                          ? "rounded-xl bg-emerald-100 p-2 text-emerald-700"
                          : "rounded-xl bg-slate-200 p-2 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                  </div>
                  <Badge variant={enabled ? "success" : "secondary"} className="rounded-full px-3 py-1 text-[11px] font-semibold">
                    {enabled ? "Enabled" : "Locked"}
                  </Badge>
                </div>
              );
            })}

            <div className="rounded-2xl border border-dashed border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 text-sm text-slate-600 dark:border-teal-500/20 dark:bg-[linear-gradient(90deg,rgba(13,148,136,0.10),rgba(6,78,59,0.16))] dark:text-slate-300">
              Manual plan switching is available for testing when you have <code>subscription.manage</code>.
            </div>
          </CardContent>
        </Card>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes subscriptionFloat {
              0%, 100% { transform: translate3d(0, 0, 0); }
              50% { transform: translate3d(0, -8px, 0); }
            }

            @keyframes subscriptionOrbit {
              0%, 100% { transform: translate3d(0, 0, 0); }
              50% { transform: translate3d(0, -5px, 0); }
            }

            .subscription-float {
              animation: subscriptionFloat 5.4s ease-in-out infinite;
            }

            .subscription-float-delayed {
              animation: subscriptionFloat 6.2s ease-in-out infinite;
              animation-delay: 0.8s;
            }

            .subscription-float-slow {
              animation: subscriptionFloat 6.8s ease-in-out infinite;
              animation-delay: 1.3s;
            }

            .subscription-orbit {
              animation: subscriptionOrbit 4.8s ease-in-out infinite;
            }

            .subscription-orbit-delayed {
              animation: subscriptionOrbit 5.6s ease-in-out infinite;
              animation-delay: 0.6s;
            }
          `,
        }}
      />
    </div>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "sky" | "amber" | "slate";
}) {
  const toneClasses = {
    emerald: "from-teal-500 to-emerald-500",
    sky: "from-sky-500 to-cyan-500",
    amber: "from-amber-500 to-orange-500",
    slate: "from-slate-700 to-slate-900",
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-[0_18px_36px_-24px_rgba(2,6,23,0.95)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className={`rounded-2xl bg-gradient-to-br p-2.5 text-white shadow-lg ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}
