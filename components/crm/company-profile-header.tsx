import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, Edit, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyStatusBadge } from "@/components/crm/company-status-badge";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/crm/utils";
import { formatDateTimeBD } from "@/lib/format/datetime";
import type { Company } from "@/lib/crm/types";

type CompanyProfileHeaderProps = {
  company: Company;
  nextFollowupAt?: string | null;
  lastInteractionAt?: string | null;
  overdueFollowupCount: number;
  openHelpCount: number;
};

export function CompanyProfileHeader({
  company,
  nextFollowupAt,
  lastInteractionAt,
  overdueFollowupCount,
  openHelpCount,
}: CompanyProfileHeaderProps) {
  const ownerName = company.assigned_profile?.full_name ?? company.assigned_profile?.email ?? "Unassigned";
  const primaryContactName = company.primary_contact?.name ?? "No primary contact";

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_16px_40px_-28px_rgba(15,23,42,0.28)]">
      <CardContent className="space-y-6 p-5 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 lg:text-[2rem]">{company.name}</h1>
              <CompanyStatusBadge status={company.status} />
              {company.pipeline_stages?.name ? <Badge variant="info">{company.pipeline_stages.name}</Badge> : null}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span>{company.industries?.name ?? "No industry selected"}</span>
              <span>{company.company_categories?.name ?? "No category selected"}</span>
              <span>Owner: {ownerName}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <LeadTemperatureBadge temperature={company.lead_temperature} />
              <RatingBadge rating={company.success_rating} />
              <Badge variant="warning">Lead Score: {company.lead_score}</Badge>
              <Badge variant="outline">Value: {formatCurrency(company.estimated_value)}</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
            <Button asChild variant="outline">
              <Link href={`/meetings/new?companyId=${company.id}`}>
                <CalendarClock />
                Add Meeting
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/followups/new?company=${company.id}`}>
                <Plus />
                Add Follow-up
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/companies/${company.id}/edit`}>
                <Edit />
                Edit Company
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HeroInfo
            label="Primary Contact"
            value={primaryContactName}
            meta={company.primary_contact?.designation ?? "Decision maker not set yet"}
            icon={<Users className="size-4" />}
          />
          <HeroInfo
            label="Next Follow-up"
            value={nextFollowupAt ? formatDateTimeBD(nextFollowupAt) : "No follow-up scheduled"}
            meta={overdueFollowupCount > 0 ? `${overdueFollowupCount} overdue action${overdueFollowupCount > 1 ? "s" : ""}` : "Pipeline is currently clear"}
            tone={overdueFollowupCount > 0 ? "warning" : "default"}
            icon={<CalendarClock className="size-4" />}
          />
          <HeroInfo
            label="Last Interaction"
            value={lastInteractionAt ? formatDateTimeBD(lastInteractionAt) : "No meeting history yet"}
            meta="Most recent client activity"
          />
          <HeroInfo
            label="Open Blockers"
            value={String(openHelpCount)}
            meta={openHelpCount > 0 ? "Needs support attention" : "No active escalations"}
            tone={openHelpCount > 0 ? "warning" : "default"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function HeroInfo({
  label,
  value,
  meta,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  meta: string;
  icon?: ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
          : "rounded-2xl border border-slate-200 bg-white/80 p-4"
      }
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-base font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{meta}</p>
    </div>
  );
}
