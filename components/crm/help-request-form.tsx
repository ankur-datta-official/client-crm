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
import { createHelpRequest, updateHelpRequest } from "@/lib/crm/help-request-actions";
import { helpRequestSchema, helpRequestTypeOptions, helpRequestPriorityOptions, helpRequestStatusOptions, type HelpRequestFormValues } from "@/lib/crm/schemas";
import type { Company, ContactPerson, Interaction, Followup, Document, HelpRequest, TeamMemberOption } from "@/lib/crm/types";

type HelpRequestFormProps = {
  helpRequest?: HelpRequest;
  companies: Company[];
  contacts: ContactPerson[];
  interactions: Interaction[];
  followups: Followup[];
  documents: Document[];
  teamMembers: TeamMemberOption[];
  defaultCompanyId?: string;
  defaultContactId?: string;
  defaultInteractionId?: string;
  defaultFollowupId?: string;
  defaultDocumentId?: string;
};

export function HelpRequestForm({
  helpRequest,
  companies,
  contacts,
  interactions,
  followups,
  documents,
  teamMembers,
  defaultCompanyId,
  defaultContactId,
  defaultInteractionId,
  defaultFollowupId,
  defaultDocumentId,
}: HelpRequestFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const hasRelatedContext = Boolean(
    helpRequest?.contact_person_id ||
      helpRequest?.interaction_id ||
      helpRequest?.followup_id ||
      helpRequest?.document_id,
  );
  const hasAssignment = Boolean(helpRequest?.assigned_to);
  const hasDetails = Boolean(helpRequest?.description || helpRequest?.resolution_note);

  const form = useForm<HelpRequestFormValues>({
    resolver: zodResolver(helpRequestSchema),
    defaultValues: {
      company_id: helpRequest?.company_id ?? defaultCompanyId ?? "",
      title: helpRequest?.title ?? "",
      help_type: helpRequest?.help_type ?? "General Support",
      contact_person_id: helpRequest?.contact_person_id ?? defaultContactId ?? "",
      interaction_id: helpRequest?.interaction_id ?? defaultInteractionId ?? "",
      followup_id: helpRequest?.followup_id ?? defaultFollowupId ?? "",
      document_id: helpRequest?.document_id ?? defaultDocumentId ?? "",
      assigned_to: helpRequest?.assigned_to ?? "",
      description: helpRequest?.description ?? "",
      priority: helpRequest?.priority ?? "medium",
      status: helpRequest?.status ?? "open",
      resolution_note: helpRequest?.resolution_note ?? "",
    },
  });

  const selectedCompanyId = form.watch("company_id");
  const availableContacts = contacts.filter((c) => c.company_id === selectedCompanyId);
  const availableInteractions = interactions.filter((i) => i.company_id === selectedCompanyId);
  const availableFollowups = followups.filter((f) => f.company_id === selectedCompanyId);
  const availableDocuments = documents.filter((d) => d.company_id === selectedCompanyId);
  const selectedStatus = form.watch("status");

  function onSubmit(values: HelpRequestFormValues, mode: "save" | "addAnother" = "save") {
    setServerError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        formData.append(key, value.toString());
      }
    });

    startTransition(async () => {
      const result = helpRequest
        ? await updateHelpRequest(helpRequest.id, formData)
        : await createHelpRequest(formData);

      if (!result.ok) {
        setServerError(result.error ?? "Unable to save help request.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      if (mode === "addAnother" && !helpRequest) {
        form.reset({
          company_id: values.company_id,
          title: "",
          help_type: "General Support",
          contact_person_id: "",
          interaction_id: "",
          followup_id: "",
          document_id: "",
          assigned_to: "",
          description: "",
          priority: "medium",
          status: "open",
          resolution_note: "",
        });
        setSuccessMessage("Help request saved. You can add another one now.");
        return;
      }

      router.push(`/need-help/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit((values) => onSubmit(values, "save"))}>
      <FormRequiredNote message="Company, help type, title, priority, and status are required. Use the optional sections when you need to link the request to other CRM records or assign internal ownership." dismissible />
      {(defaultCompanyId || defaultContactId || defaultInteractionId || defaultFollowupId || defaultDocumentId) && !helpRequest ? (
        <FormContextHint message="This request was opened from an existing CRM record, so related context has been preselected where possible." />
      ) : null}

      <FormSection title="Basic Information" description="Core help request context.">
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

        <SelectField
          label="Help Type"
          required
          error={form.formState.errors.help_type?.message ?? fieldErrors.help_type}
          {...form.register("help_type")}
        >
          {helpRequestTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>

        <Field label="Title" required error={form.formState.errors.title?.message} className="md:col-span-2">
          <Input {...form.register("title")} placeholder="e.g., Need pricing approval for large order" className="w-full" />
        </Field>
        <SelectField label="Priority" required {...form.register("priority")}>
          {helpRequestPriorityOptions.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" required {...form.register("status")}>
          {helpRequestStatusOptions.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s.replace("_", " ")}
            </option>
          ))}
        </SelectField>
      </FormSection>

      <FormSection title="Related CRM Context" description="Link this request to existing records for better context." optional collapsible defaultCollapsed={!hasRelatedContext}>
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

        <SelectField label="Related Follow-up" error={fieldErrors.followup_id} {...form.register("followup_id")}>
          <option value="">No follow-up selected</option>
          {availableFollowups.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </SelectField>

        <SelectField label="Related Document" error={fieldErrors.document_id} {...form.register("document_id")}>
          <option value="">No document selected</option>
          {availableDocuments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </SelectField>
      </FormSection>

      <FormSection title="Assignment & Priority" description="Set who should handle this and how urgent it is." optional collapsible defaultCollapsed={!hasAssignment}>
        <SelectField label="Assigned To" error={fieldErrors.assigned_to} {...form.register("assigned_to")}>
          <option value="">Unassigned</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name ?? m.email}
            </option>
          ))}
        </SelectField>
      </FormSection>

      <FormSection title="Details" description="Additional information about this help request." optional collapsible defaultCollapsed={!hasDetails} contentClassName="grid-cols-1 md:grid-cols-1 xl:grid-cols-1">
        <div className="w-full min-w-0 space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            {...form.register("description")}
            className="min-h-32 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm"
            placeholder="Describe the issue or what kind of help is needed."
          />
        </div>

        {(selectedStatus === "resolved" || selectedStatus === "rejected") && (
          <div className="space-y-2">
            <Label htmlFor="resolution_note">Resolution Note</Label>
            <textarea
              id="resolution_note"
              {...form.register("resolution_note")}
              className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm"
              placeholder="Add notes about how this was resolved or why it was rejected."
            />
          </div>
        )}
      </FormSection>

      {serverError && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{serverError}</p>}
      {successMessage && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p>}

      <FormActionBar>
        <Button asChild variant="outline">
          <Link href={helpRequest ? `/need-help/${helpRequest.id}` : "/need-help"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {helpRequest ? "Update" : "Save"}
        </Button>
        {!helpRequest && (
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

function Field({ label, required, error, children, className }: { label: string; required?: boolean; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
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
