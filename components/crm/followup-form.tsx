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
import { formatDateBD } from "@/lib/format/datetime";
import { createFollowup, updateFollowup } from "@/lib/crm/followup-actions";
import { followupSchema, followupTypeOptions, followupPriorityOptions, followupStatusOptions, type FollowupFormValues } from "@/lib/crm/schemas";
import type { Company, ContactPerson, Interaction, Followup, TeamMemberOption } from "@/lib/crm/types";

type FollowupFormProps = {
  followup?: Followup;
  companies: Company[];
  contacts: ContactPerson[];
  interactions: Interaction[];
  teamMembers: TeamMemberOption[];
  defaultCompanyId?: string;
  defaultContactId?: string;
  defaultInteractionId?: string;
};

export function FollowupForm({
  followup,
  companies,
  contacts,
  interactions,
  teamMembers,
  defaultCompanyId,
  defaultContactId,
  defaultInteractionId,
}: FollowupFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const hasContactMeetingContext = Boolean(followup?.contact_person_id || followup?.interaction_id);
  const hasReminderSettings = Boolean(
    followup?.reminder_before_minutes !== null &&
      followup?.reminder_before_minutes !== undefined &&
      followup.reminder_before_minutes !== 60,
  );
  const hasAssignmentPriority = Boolean(
    followup?.assigned_user_id ||
      (followup?.priority && followup.priority !== "medium"),
  );
  const hasDescription = Boolean(followup?.description);

  const form = useForm<FollowupFormValues>({
    resolver: zodResolver(followupSchema),
    defaultValues: {
      company_id: followup?.company_id ?? defaultCompanyId ?? "",
      title: followup?.title ?? "",
      scheduled_at: followup?.scheduled_at ? followup.scheduled_at.slice(0, 16) : getLocalDateTimeValue(),
      contact_person_id: followup?.contact_person_id ?? defaultContactId ?? "",
      interaction_id: followup?.interaction_id ?? defaultInteractionId ?? "",
      assigned_user_id: followup?.assigned_user_id ?? "",
      followup_type: followup?.followup_type ?? "Phone Call",
      description: followup?.description ?? "",
      reminder_before_minutes: followup?.reminder_before_minutes ?? 60,
      priority: followup?.priority ?? "medium",
      status: followup?.status ?? "pending",
    },
  });

  const selectedCompanyId = form.watch("company_id");
  const availableContacts = contacts.filter((c) => c.company_id === selectedCompanyId);
  const availableInteractions = interactions.filter((i) => i.company_id === selectedCompanyId);

  function onSubmit(values: FollowupFormValues, mode: "save" | "addAnother" = "save") {
    setServerError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    startTransition(async () => {
      const result = followup
        ? await updateFollowup(followup.id, formData)
        : await createFollowup(formData);

      if (!result.ok) {
        setServerError(result.error ?? "Unable to save follow-up.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      if (mode === "addAnother" && !followup) {
        form.reset({
          company_id: values.company_id,
          title: "",
          scheduled_at: getLocalDateTimeValue(),
          contact_person_id: "",
          interaction_id: "",
          assigned_user_id: "",
          followup_type: "Phone Call",
          description: "",
          reminder_before_minutes: 60,
          priority: "medium",
          status: "pending",
        });
        setSuccessMessage("Follow-up saved. You can add another one now.");
        return;
      }

      router.push(`/followups/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit((values) => onSubmit(values, "save"))}>
      <FormRequiredNote message="Company, title, scheduled date, follow-up type, and status are required. Use the optional sections only when you need to connect the follow-up to a person, meeting, or reminder setup." dismissible />
      {(defaultCompanyId || defaultContactId || defaultInteractionId) && !followup ? (
        <FormContextHint message="This follow-up was opened from an existing CRM record, so related context has been preselected where possible." />
      ) : null}

      <FormSection title="Basic Information" description="Core follow-up context and timing." contentClassName="md:grid-cols-2 xl:grid-cols-2">
        <SelectField
          label="Company"
          required
          error={form.formState.errors.company_id?.message ?? fieldErrors.company_id}
          {...form.register("company_id")}
        >
          <option value="">Select company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>

        <Field label="Title" required error={form.formState.errors.title?.message}>
          <Input {...form.register("title")} placeholder="e.g., Quotation follow-up" />
        </Field>

        <Field label="Scheduled Date & Time" required error={form.formState.errors.scheduled_at?.message}>
          <Input type="datetime-local" {...form.register("scheduled_at")} />
        </Field>

        <SelectField label="Follow-up Type" required {...form.register("followup_type")}>
          {followupTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" required {...form.register("status")}>
          {followupStatusOptions.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </SelectField>
      </FormSection>

      <FormSection title="Contact & Meeting Context" description="Connect this follow-up to a specific person or meeting." optional collapsible defaultCollapsed={!hasContactMeetingContext}>
        <SelectField label="Contact Person" error={fieldErrors.contact_person_id} {...form.register("contact_person_id")}>
          <option value="">No contact selected</option>
          {availableContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>

        <SelectField label="Related Meeting" error={fieldErrors.interaction_id} {...form.register("interaction_id")}>
          <option value="">No meeting selected</option>
          {availableInteractions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.interaction_type} - {formatDateBD(i.meeting_datetime)}
            </option>
          ))}
        </SelectField>
      </FormSection>

      <FormSection title="Reminder Settings" description="Set reminder timing for this follow-up." optional collapsible defaultCollapsed={!hasReminderSettings}>
        <Field label="Reminder Before (minutes)" error={form.formState.errors.reminder_before_minutes?.message}>
          <Input type="number" min={0} {...form.register("reminder_before_minutes")} />
        </Field>
      </FormSection>

      <FormSection title="Assignment & Priority" description="Set ownership and urgency for this follow-up." optional collapsible defaultCollapsed={!hasAssignmentPriority}>
        <SelectField label="Priority" {...form.register("priority")}>
          {followupPriorityOptions.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </SelectField>

        <SelectField label="Assigned User" error={fieldErrors.assigned_user_id} {...form.register("assigned_user_id")}>
          <option value="">Unassigned</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name ?? m.email}
            </option>
          ))}
        </SelectField>
      </FormSection>

      <FormSection title="Notes" description="Additional details or context for this follow-up." optional collapsible defaultCollapsed={!hasDescription} contentClassName="grid-cols-1 md:grid-cols-1 xl:grid-cols-1">
        <div className="w-full min-w-0 space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            {...form.register("description")}
            className="min-h-32 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm"
            placeholder="Add specific details about what needs to be discussed or achieved."
          />
        </div>
      </FormSection>

      {serverError && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{serverError}</p>}
      {successMessage && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p>}

      <FormActionBar>
        <Button asChild variant="outline">
          <Link href={followup ? `/followups/${followup.id}` : "/followups"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {followup ? "Update follow-up" : "Save"}
        </Button>
        {!followup && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={form.handleSubmit((values) => onSubmit(values, "addAnother"))}
          >
            Save & Add Another
          </Button>
        )}
      </FormActionBar>
    </form>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  required,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean; error?: string }) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <select {...props} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm">
        {children}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function getLocalDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
