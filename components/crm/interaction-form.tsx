"use client";

import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActionBar, FormContextHint, FormRequiredNote, FormSection } from "@/components/shared/form-helpers";
import { SuccessRatingSlider } from "@/components/crm/success-rating-slider";
import { createInteractionAction, updateInteractionAction } from "@/lib/crm/actions";
import { interactionSchema, interactionTypeOptions, temperatureFromRating, type InteractionFormValues } from "@/lib/crm/schemas";
import type { Company, ContactPerson, Interaction, TeamMemberOption } from "@/lib/crm/types";

type InteractionFormProps = {
  interaction?: Interaction;
  companies: Company[];
  contacts: ContactPerson[];
  teamMembers: TeamMemberOption[];
  defaultCompanyId?: string;
};

export function InteractionForm({ interaction, companies, contacts, teamMembers, defaultCompanyId }: InteractionFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [temperatureTouched, setTemperatureTouched] = useState(Boolean(interaction?.lead_temperature));
  const [isPending, startTransition] = useTransition();
  const hasMeetingContext = Boolean(interaction?.meeting_datetime || interaction?.location || interaction?.online_meeting_link || interaction?.assigned_user_id || interaction?.contact_person_id);
  const hasClientRequirements = Boolean(
    interaction?.client_requirement ||
      interaction?.pain_point ||
      interaction?.proposed_solution ||
      interaction?.budget_discussion ||
      interaction?.competitor_mentioned ||
      interaction?.decision_timeline,
  );
  const hasSalesEvaluation = Boolean(interaction?.success_rating !== null || interaction?.lead_temperature);
  const hasNextAction = Boolean(interaction?.next_action || interaction?.next_followup_at);
  const hasInternalNotes = Boolean(interaction?.need_help || interaction?.internal_note);
  const form = useForm<InteractionFormValues>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      company_id: interaction?.company_id ?? defaultCompanyId ?? "",
      contact_person_id: interaction?.contact_person_id ?? "",
      assigned_user_id: interaction?.assigned_user_id ?? "",
      interaction_type: interaction?.interaction_type ?? "Phone Call",
      meeting_datetime: interaction?.meeting_datetime ? interaction.meeting_datetime.slice(0, 16) : getLocalDateTimeValue(),
      location: interaction?.location ?? "",
      online_meeting_link: interaction?.online_meeting_link ?? "",
      discussion_details: interaction?.discussion_details ?? "",
      client_requirement: interaction?.client_requirement ?? "",
      pain_point: interaction?.pain_point ?? "",
      proposed_solution: interaction?.proposed_solution ?? "",
      budget_discussion: interaction?.budget_discussion ?? "",
      competitor_mentioned: interaction?.competitor_mentioned ?? "",
      decision_timeline: interaction?.decision_timeline ?? "",
      success_rating: interaction?.success_rating ?? "",
      lead_temperature: interaction?.lead_temperature ?? "",
      next_action: interaction?.next_action ?? "",
      next_followup_at: interaction?.next_followup_at ? interaction.next_followup_at.slice(0, 16) : "",
      need_help: interaction?.need_help ?? false,
      internal_note: interaction?.internal_note ?? "",
      status: interaction?.status ?? "active",
    },
  });
  const selectedCompanyId = form.watch("company_id");
  const successRatingValue = form.watch("success_rating");
  const availableContacts = contacts.filter((contact) => contact.company_id === selectedCompanyId);

  function onSubmit(values: InteractionFormValues, mode: "save" | "addAnother" = "save") {
    setServerError(null);
    setSuccessMessage(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = interaction ? await updateInteractionAction(interaction.id, values) : await createInteractionAction(values);
      if (!result.ok) {
        setServerError(result.error ?? "Unable to save meeting.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      if (mode === "addAnother" && !interaction) {
        const companyId = values.company_id;
        form.reset({ company_id: companyId, contact_person_id: "", assigned_user_id: "", interaction_type: "Phone Call", meeting_datetime: getLocalDateTimeValue(), discussion_details: "", need_help: false, status: "active" });
        setSuccessMessage("Meeting saved. You can add another interaction now.");
        return;
      }
      router.push(`/meetings/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit((values) => onSubmit(values, "save"))}>
      <FormRequiredNote message="Company, interaction type, and discussion details are required. The meeting date is prefilled with the current time so you can log calls and conversations quickly." dismissible />
      {defaultCompanyId && !interaction ? (
        <FormContextHint message="This meeting was started from a company page, so the company is preselected." />
      ) : null}
      <FormSection title="Basic Information" description="Required company context and discussion notes.">
        <SelectField label="Company" required error={form.formState.errors.company_id?.message ?? fieldErrors.company_id} {...form.register("company_id")}>
          <option value="">Select company</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </SelectField>
        <SelectField label="Contact Person" error={fieldErrors.contact_person_id} {...form.register("contact_person_id")}>
          <option value="">No contact selected</option>
          {availableContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
        </SelectField>
        <SelectField label="Interaction Type" required {...form.register("interaction_type")}>
          {interactionTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
        </SelectField>
        <Field label="Discussion Details" required error={form.formState.errors.discussion_details?.message} className="md:col-span-2 xl:col-span-4">
          <textarea {...form.register("discussion_details")} className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm" />
        </Field>
      </FormSection>

      <FormSection title="Meeting Context" description="When and where the interaction happened." optional collapsible defaultCollapsed={!hasMeetingContext}>
        <Field label="Meeting Date & Time"><Input type="datetime-local" {...form.register("meeting_datetime")} /></Field>
        <Field label="Location"><Input {...form.register("location")} /></Field>
        <Field label="Online Meeting Link" error={form.formState.errors.online_meeting_link?.message}><Input {...form.register("online_meeting_link")} placeholder="https://meet.example.com" /></Field>
        <SelectField label="Assigned user" error={fieldErrors.assigned_user_id} {...form.register("assigned_user_id")}>
          <option value="">Unassigned</option>
          {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>)}
        </SelectField>
      </FormSection>

      <FormSection title="Client Requirement" description="Capture client needs, pain points, and proposed direction." optional collapsible defaultCollapsed={!hasClientRequirements}>
        <Field label="Client Requirement"><Input {...form.register("client_requirement")} /></Field>
        <Field label="Pain Point"><Input {...form.register("pain_point")} /></Field>
        <Field label="Proposed Solution"><Input {...form.register("proposed_solution")} /></Field>
        <Field label="Budget Discussion"><Input {...form.register("budget_discussion")} /></Field>
        <Field label="Competitor Mentioned"><Input {...form.register("competitor_mentioned")} /></Field>
        <Field label="Decision Timeline"><Input {...form.register("decision_timeline")} /></Field>
      </FormSection>

      <FormSection title="Sales Evaluation" description="Qualification rating and lead temperature." optional collapsible defaultCollapsed={!hasSalesEvaluation} contentClassName="grid-cols-1 md:grid-cols-1 xl:grid-cols-1">
        <div className="grid w-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:items-stretch">
          <div className="min-w-0">
            <Field label="Success Rating" error={form.formState.errors.success_rating?.message}>
              <input type="hidden" {...form.register("success_rating")} />
              <SuccessRatingSlider
                value={successRatingValue}
                helperText="Drag to estimate how confident this meeting outcome feels."
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
          <div className="min-w-0">
        <SelectField label="Lead Temperature" {...form.register("lead_temperature")} onChange={(event) => { setTemperatureTouched(true); form.setValue("lead_temperature", event.target.value as InteractionFormValues["lead_temperature"]); }}>
          <option value="">Auto from rating</option>
          <option value="cold">Cold</option>
          <option value="warm">Warm</option>
          <option value="hot">Hot</option>
          <option value="very_hot">Very Hot</option>
        </SelectField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Next Action" description="Future action planning without creating full follow-up tasks yet." optional collapsible defaultCollapsed={!hasNextAction}>
        <Field label="Next Action"><Input {...form.register("next_action")} /></Field>
        <Field label="Next Follow-up Date & Time"><Input type="datetime-local" {...form.register("next_followup_at")} /></Field>
      </FormSection>

      <FormSection title="Internal Notes" description="Internal team context and help flags." optional collapsible defaultCollapsed={!hasInternalNotes}>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4" {...form.register("need_help")} />Need help</label>
        <div className="md:col-span-2 xl:col-span-4"><Label>Internal Note</Label><textarea {...form.register("internal_note")} className="mt-2 min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm" /></div>
      </FormSection>

      {serverError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{serverError}</p> : null}
      {successMessage ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p> : null}
      <FormActionBar>
        <Button asChild variant="outline"><Link href={interaction ? `/meetings/${interaction.id}` : "/meetings"}>Cancel</Link></Button>
        <Button type="submit" disabled={isPending}><Save />Save</Button>
        {!interaction ? <Button type="button" variant="secondary" disabled={isPending} onClick={form.handleSubmit((values) => onSubmit(values, "addAnother"))}>Save & Add Another</Button> : null}
      </FormActionBar>
    </form>
  );
}

function Field({ label, required, error, children, className }: { label: string; required?: boolean; error?: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className ?? ""}`}><Label>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>{children}{error ? <p className="text-xs text-destructive">{error}</p> : null}</div>;
}
function SelectField({ label, required, error, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean; error?: string }) {
  return <div className="space-y-2"><Label>{label}{required ? <span className="text-destructive"> *</span> : null}</Label><select {...props} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm">{children}</select>{error ? <p className="text-xs text-destructive">{error}</p> : null}</div>;
}

function getLocalDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
