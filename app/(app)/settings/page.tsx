import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Circle,
  KanbanSquare,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import { CrmSettingsCard } from "@/components/crm/crm-settings-card";
import { ThemePreferenceCard } from "@/components/settings/theme-preference-card";
import { ProductTourStartButton } from "@/components/tour/product-tour-start-button";
import { PageHeader } from "@/components/shared/page-header";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAnyPermission } from "@/lib/auth/session";
import { getCurrentProfileSettings } from "@/lib/profile/profile-actions";
import { getCompanyCategories, getIndustries, getPipelineStages } from "@/lib/crm/queries";

export default async function SettingsPage() {
  await requireAnyPermission(["settings.view", "settings.manage"]);
  const [profile, industries, categories, pipelineStages] = await Promise.all([
    getCurrentProfileSettings(),
    getIndustries(),
    getCompanyCategories(),
    getPipelineStages(),
  ]);

  const setupChecklist = [
    {
      label: "Your profile",
      done: Boolean(profile.fullName?.trim()),
      detail: profile.fullName?.trim() ? "Your account details are ready." : "Add your name and contact details first.",
    },
    {
      label: "Industry labels",
      done: industries.length > 0,
      detail: industries.length > 0 ? `${industries.length} labels are ready to use.` : "Create labels to organize companies by industry.",
    },
    {
      label: "Company categories",
      done: categories.length > 0,
      detail: categories.length > 0 ? `${categories.length} categories are ready.` : "Add categories to group companies by value or priority.",
    },
    {
      label: "Sales pipeline",
      done: pipelineStages.length > 0,
      detail: pipelineStages.length > 0 ? `${pipelineStages.length} pipeline stages are active.` : "Set up your sales stages so deals move step by step.",
    },
  ];

  const completedCount = setupChecklist.filter((item) => item.done).length;
  const firstPending = setupChecklist.find((item) => !item.done)?.label ?? "Everything is ready";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage the basic things your team needs to use the CRM smoothly."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <ProductTourStartButton label="Restart Tutorial" variant="outline" className="rounded-xl" />
            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900">
              <Link href="/settings/profile">
                View Profile
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      />

      <GuidanceStrip dismissible storageKey="crm-tip-settings">
        Start from top to bottom. First set up your profile, then your CRM labels, then your sales workflow.
      </GuidanceStrip>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-teal-200/80 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/60 shadow-[0_24px_80px_-56px_rgba(13,148,136,0.45)] dark:border-teal-500/20 dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.95),rgba(6,78,59,0.18))] dark:shadow-[0_28px_80px_-48px_rgba(2,6,23,0.98)]">
          <CardContent className="p-6 lg:p-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100">
                  Simple setup guide
                </Badge>
                <Badge variant="success" className="rounded-full px-3 py-1.5 text-xs font-semibold">
                  {completedCount}/{setupChecklist.length} done
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-teal-200 dark:shadow-[0_12px_24px_-18px_rgba(15,23,42,0.95)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Easy for new users
                </div>
                <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                  Set up your CRM in a simple order, without guessing what to do next.
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Each section below has one clear job. Finish them one by one and your workspace will be ready for daily use.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <QuickStartCard
                  step="Step 1"
                  title="Update your profile"
                  detail="Set your name, avatar, and contact details so your account is ready."
                />
                <QuickStartCard
                  step="Step 2"
                  title="Add your CRM labels"
                  detail="Create industries and company categories so data stays organized."
                />
                <QuickStartCard
                  step="Step 3"
                  title="Set your workflow"
                  detail="Configure pipeline stages and scoring so your team can follow one process."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit border-slate-200/80 bg-white shadow-[0_20px_70px_-56px_rgba(15,23,42,0.45)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] dark:shadow-[0_20px_70px_-56px_rgba(2,6,23,0.92)]">
          <CardHeader className="pb-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <CardTitle className="text-xl">What to do next</CardTitle>
                  <CardDescription className="dark:text-slate-300">Follow this small checklist if you are setting things up for the first time.</CardDescription>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right dark:border-emerald-400/35 dark:bg-emerald-950 dark:shadow-[0_12px_24px_-18px_rgba(16,185,129,0.35)]">
                  <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">{completedCount}/{setupChecklist.length}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-100">Done</p>
                </div>
              </div>
              <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-3 text-sm text-teal-800 dark:border-teal-400/35 dark:bg-teal-950 dark:text-white dark:shadow-[0_12px_24px_-18px_rgba(20,184,166,0.35)]">
                <span className="font-semibold">Next focus:</span> {firstPending}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {setupChecklist.map((item, index) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-700/80 dark:bg-slate-900/85">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-300">
                  {item.done ? <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-300" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-300">{item.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div className="space-y-8">
        <SettingsSection
          title="1. Your Account"
          description="Start here first. This section controls how you appear inside the CRM."
        >
          <CrmSettingsCard
            title="Profile Settings"
            description="Change your name, avatar, phone, and personal account preferences."
            href="/settings/profile"
            icon={UserRound}
            ctaLabel="Open Profile"
            badge="Start here"
            meta="Your account details"
          />
          <ThemePreferenceCard />
        </SettingsSection>

        <SettingsSection
          title="2. Organize Your CRM Data"
          description="Use these settings to keep companies and leads neatly grouped."
        >
          <CrmSettingsCard
            title="Industries"
            description="Create industry labels like Software, Real Estate, or Retail to organize companies."
            href="/settings/industries"
            icon={BriefcaseBusiness}
            ctaLabel="Open Industries"
            badge="Recommended"
            meta={`${industries.length} labels ready`}
          />
          <CrmSettingsCard
            title="Company Categories"
            description="Create categories like High Value, Warm Lead, or Priority to sort companies better."
            href="/settings/company-categories"
            icon={Building2}
            ctaLabel="Open Categories"
            badge="Recommended"
            meta={`${categories.length} categories ready`}
          />
        </SettingsSection>

        <SettingsSection
          title="3. Set Your Sales Workflow"
          description="Finish here so your team can track deals in one consistent way."
        >
          <CrmSettingsCard
            title="Pipeline"
            description="Add and edit stages like New Lead, Proposal Sent, and Won so deal progress is easy to follow."
            href="/settings/pipeline"
            icon={KanbanSquare}
            ctaLabel="Open Pipeline"
            badge="Important"
            meta={`${pipelineStages.length} stages active`}
          />
          <CrmSettingsCard
            title="Scoring & Rewards"
            description="Adjust points, rewards, and team motivation settings if you want a gamified workflow."
            href="/settings/scoring"
            icon={Trophy}
            ctaLabel="Open Scoring"
            badge="Optional"
            meta="Points and rewards"
          />
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function QuickStartCard({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/90 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] dark:shadow-[0_18px_36px_-24px_rgba(2,6,23,0.95)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">{step}</p>
      <h3 className="mt-3 text-lg font-semibold text-slate-950 dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
    </div>
  );
}
