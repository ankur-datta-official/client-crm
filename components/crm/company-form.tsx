"use client";

import { useState, useTransition } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActionBar, FormContextHint, FormRequiredNote, FormSection } from "@/components/shared/form-helpers";
import { SuccessRatingSlider } from "@/components/crm/success-rating-slider";
import { companySchema, temperatureFromRating, type CompanyFormValues } from "@/lib/crm/schemas";
import type { Company, CompanyCategory, Industry, PipelineStage, TeamMemberOption } from "@/lib/crm/types";
import { createCompanyAction, updateCompanyAction } from "@/lib/crm/actions";

type CompanyFormProps = {
  company?: Company;
  industries: Industry[];
  categories: CompanyCategory[];
  stages: PipelineStage[];
  teamMembers: TeamMemberOption[];
};

export function CompanyForm({ company, industries, categories, stages, teamMembers }: CompanyFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [temperatureTouched, setTemperatureTouched] = useState(Boolean(company?.lead_temperature));
  const [isPending, startTransition] = useTransition();
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name ?? "",
      industry_id: company?.industry_id ?? "",
      category_id: company?.category_id ?? "",
      lead_source: company?.lead_source ?? "",
      priority: company?.priority ?? "medium",
      assigned_user_id: company?.assigned_user_id ?? "",
      pipeline_stage_id: company?.pipeline_stage_id ?? stages[0]?.id ?? "",
      status: company?.status ?? "active",
      phone: company?.phone ?? "",
      whatsapp: company?.whatsapp ?? "",
      email: company?.email ?? "",
      website: company?.website ?? "",
      address: company?.address ?? "",
      city: company?.city ?? "",
      country: company?.country ?? "Bangladesh",
      success_rating: company?.success_rating ?? "",
      lead_temperature: company?.lead_temperature ?? "",
      estimated_value: company?.estimated_value ?? "",
      expected_closing_date: company?.expected_closing_date ?? "",
      notes: company?.notes ?? "",
    },
  });
  const successRatingValue = form.watch("success_rating");
  const hasContactDetails = Boolean(
    company?.phone ||
      company?.whatsapp ||
      company?.email ||
      company?.website ||
      company?.address ||
      company?.city ||
      company?.country,
  );
  const hasSalesDetails = Boolean(
    company?.success_rating !== null ||
      company?.estimated_value !== null ||
      company?.expected_closing_date ||
      (company?.lead_temperature && company.lead_temperature !== "warm"),
  );
  const hasNotes = Boolean(company?.notes);

  function onSubmit(values: CompanyFormValues, mode: "save" | "addAnother" = "save") {
    setServerError(null);
    setSuccessMessage(null);
    setServerFieldErrors({});
    startTransition(async () => {
      const result = company ? await updateCompanyAction(company.id, values) : await createCompanyAction(values);
      if (!result?.ok) {
        setServerError(result?.error ?? "Please check the highlighted fields and try again.");
        setServerFieldErrors(result?.fieldErrors ?? {});
        return;
      }

      if (mode === "addAnother" && !company) {
        form.reset({
          name: "",
          industry_id: "",
          category_id: "",
          lead_source: "",
          priority: "medium",
          assigned_user_id: "",
          pipeline_stage_id: stages[0]?.id ?? "",
          status: "active",
          phone: "",
          whatsapp: "",
          email: "",
          website: "",
          address: "",
          city: "",
          country: "Bangladesh",
          success_rating: "",
          lead_temperature: "",
          estimated_value: "",
          expected_closing_date: "",
          notes: "",
        });
        setSuccessMessage("Company saved. You can add another lead now.");
        return;
      }

      router.push(`/companies/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit((values) => onSubmit(values, "save"))}>
      <FormRequiredNote
        message="Company name, pipeline stage, and status are required. You can add contacts, meetings, follow-ups, and more detailed qualification fields later."
        dismissible
      />
      <FormSection title="Basic Information" description="Core lead classification, ownership, and pipeline placement.">
        <Field label="Company name" required error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} placeholder="Acme Enterprise" />
        </Field>
        <SelectField
          label="Industry"
          error={form.formState.errors.industry_id?.message ?? serverFieldErrors.industry_id}
          helper={<Link className="text-xs font-medium text-primary hover:underline" href="/settings/industries">Add industry</Link>}
          {...form.register("industry_id")}
        >
          <option value="">
            {industries.length === 0 ? "No industries found. Add one in Settings > Industries." : "Select industry"}
          </option>
          {industries.map((industry) => <option key={industry.id} value={industry.id}>{industry.name}</option>)}
        </SelectField>
        <SelectField label="Company category" error={form.formState.errors.category_id?.message ?? serverFieldErrors.category_id} {...form.register("category_id")}>
          <option value="">Select category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.code} - {category.name}</option>)}
        </SelectField>
        <Field label="Lead source">
          <Input {...form.register("lead_source")} placeholder="Referral, Website, LinkedIn" />
        </Field>
        <SelectField label="Priority" {...form.register("priority")}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </SelectField>
        <SelectField label="Assigned user" error={form.formState.errors.assigned_user_id?.message ?? serverFieldErrors.assigned_user_id} {...form.register("assigned_user_id")}>
          <option value="">Unassigned</option>
          {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>)}
        </SelectField>
        <SelectField label="Pipeline stage" required error={form.formState.errors.pipeline_stage_id?.message ?? serverFieldErrors.pipeline_stage_id} {...form.register("pipeline_stage_id")}>
          <option value="">Select stage</option>
          {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
        </SelectField>
        <SelectField label="Status" required {...form.register("status")}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SelectField>
      </FormSection>

      <FormSection
        title="Contact Information"
        description="Public contact channels and location details."
        optional
        collapsible
        defaultCollapsed={!hasContactDetails}
      >
        <div className="md:col-span-2 xl:col-span-4">
          <FormContextHint message="You can keep this lead lightweight for now. Add phone, email, and address details only when they are available." />
        </div>
        <Field label="Phone"><Input {...form.register("phone")} /></Field>
        <Field label="WhatsApp"><Input {...form.register("whatsapp")} /></Field>
        <Field label="Email" error={form.formState.errors.email?.message ?? serverFieldErrors.email}><Input {...form.register("email")} /></Field>
        <Field label="Website" error={form.formState.errors.website?.message ?? serverFieldErrors.website}><Input {...form.register("website")} placeholder="https://example.com" /></Field>
        <Field label="Address"><Input {...form.register("address")} /></Field>
        <Field label="City"><Input {...form.register("city")} /></Field>
        <Field label="Country"><Input {...form.register("country")} /></Field>
      </FormSection>

        <FormSection
          title="Sales Information"
          description="Qualification, value, temperature, and expected close timing."
          optional
          collapsible
          defaultCollapsed={!hasSalesDetails}
          contentClassName="grid-cols-1 md:grid-cols-1 xl:grid-cols-1"
        >
          <div className="grid w-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:items-stretch">
            <div className="min-w-0">
              <Field label="Success rating" error={form.formState.errors.success_rating?.message ?? serverFieldErrors.success_rating}>
                <input type="hidden" {...form.register("success_rating")} />
                <SuccessRatingSlider
                  value={successRatingValue}
                  onChange={(nextValue) => {
                    form.setValue("success_rating", String(nextValue), {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                    if (!temperatureTouched) {
                      form.setValue("lead_temperature", temperatureFromRating(nextValue) ?? "", {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                  onClear={() => {
                    form.setValue("success_rating", "", {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                    if (!temperatureTouched) {
                      form.setValue("lead_temperature", "", {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                />
              </Field>
            </div>
            <div className="grid min-w-0 content-start gap-4 md:grid-cols-2">
              <SelectField
                label="Lead temperature"
                {...form.register("lead_temperature")}
                onChange={(event) => {
                  setTemperatureTouched(true);
                  form.setValue("lead_temperature", event.target.value as CompanyFormValues["lead_temperature"]);
                }}
              >
                <option value="">Auto from rating</option>
                <option value="cold">Cold</option>
                <option value="warm">Warm</option>
                <option value="hot">Hot</option>
                <option value="very_hot">Very Hot</option>
              </SelectField>
              <Field label="Estimated value" error={form.formState.errors.estimated_value?.message ?? serverFieldErrors.estimated_value}>
                <Input type="number" min={0} step="0.01" {...form.register("estimated_value")} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Expected closing date">
                  <Input type="date" {...form.register("expected_closing_date")} />
                </Field>
              </div>
            </div>
          </div>
        </FormSection>

      <FormSection
        title="Additional Notes"
        description="Internal context for qualification and next action planning."
        optional
        collapsible
        defaultCollapsed={!hasNotes}
        contentClassName="grid-cols-1 md:grid-cols-1 xl:grid-cols-1"
      >
        <div className="w-full min-w-0 space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            {...form.register("notes")}
            className="block min-h-32 w-full min-w-0 resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-36 dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]"
            placeholder="Capture relationship context, requirements, risks, and decision notes."
          />
        </div>
      </FormSection>

      {serverError ? (
        <p className="rounded-xl border border-rose-200/70 bg-rose-50/90 p-3 text-sm text-rose-700 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {serverError}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-xl border border-emerald-200/70 bg-emerald-50/90 p-3 text-sm text-emerald-700 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          {successMessage}
        </p>
      ) : null}
      <FormActionBar>
        <Button asChild variant="outline">
          <Link href={company ? `/companies/${company.id}` : "/companies"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending || form.formState.isSubmitting}>
          <Save />
          {company ? "Update company" : "Save"}
        </Button>
        {!company ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || form.formState.isSubmitting}
            onClick={form.handleSubmit((values) => onSubmit(values, "addAnother"))}
          >
            Save & Add Another
          </Button>
        ) : null}
      </FormActionBar>
    </form>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SelectField({
  label,
  error,
  helper,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean; error?: string; helper?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}{props.required ? <span className="text-destructive"> *</span> : null}</Label>
        {helper}
      </div>
      <select
        {...props}
        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 dark:border-slate-800 dark:bg-slate-950/85 dark:[color-scheme:dark] dark:shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]"
      >
        {children}
      </select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
