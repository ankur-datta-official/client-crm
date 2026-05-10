"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActionBar, FormContextHint, FormRequiredNote, FormSection } from "@/components/shared/form-helpers";
import { formatDateBD } from "@/lib/format/datetime";
import { documentSchema, type DocumentFormValues, documentTypeOptions, documentStatusOptions } from "@/lib/crm/schemas";
import type { Document, Company, ContactPerson, Interaction, Followup } from "@/lib/crm/types";
import { createDocument, updateDocument } from "@/lib/crm/document-actions";
import { FileUploadField } from "./file-upload-field";

type DocumentFormProps = {
  document?: Document;
  companies: Company[];
  contacts: ContactPerson[];
  interactions: Interaction[];
  followups: Followup[];
  initialCompanyId?: string;
  initialContactId?: string;
  initialInteractionId?: string;
  initialFollowupId?: string;
};

export function DocumentForm({
  document,
  companies,
  contacts,
  interactions,
  followups,
  initialCompanyId,
  initialContactId,
  initialInteractionId,
  initialFollowupId,
}: DocumentFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const hasRelatedContext = Boolean(document?.contact_person_id || document?.interaction_id || document?.followup_id);
  const hasSubmissionDetails = Boolean(document?.submitted_to || document?.submitted_at || document?.expiry_date);
  const hasRemarks = Boolean(document?.remarks);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      company_id: document?.company_id ?? initialCompanyId ?? "",
      title: document?.title ?? "",
      document_type: document?.document_type ?? "Other",
      description: document?.description ?? "",
      contact_person_id: document?.contact_person_id ?? initialContactId ?? "",
      interaction_id: document?.interaction_id ?? initialInteractionId ?? "",
      followup_id: document?.followup_id ?? initialFollowupId ?? "",
      status: document?.status ?? "submitted",
      submitted_to: document?.submitted_to ?? "",
      submitted_at: document?.submitted_at ? new Date(document.submitted_at).toISOString().split("T")[0] : "",
      expiry_date: document?.expiry_date ?? "",
      remarks: document?.remarks ?? "",
    },
  });

  const selectedCompanyId = form.watch("company_id");

  // Filter related data based on selected company
  const filteredContacts = contacts.filter(
    (c) => !selectedCompanyId || c.company_id === selectedCompanyId
  );
  const filteredInteractions = interactions.filter(
    (i) => !selectedCompanyId || i.company_id === selectedCompanyId
  );
  const filteredFollowups = followups.filter(
    (f) => !selectedCompanyId || f.company_id === selectedCompanyId
  );

  async function onSubmit(values: DocumentFormValues, mode: "save" | "addAnother" = "save") {
    setServerError(null);
    setSuccessMessage(null);
    setServerFieldErrors({});
    setFileError(null);

    if (!document && !selectedFile) {
      setFileError("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        formData.append(key, String(value));
      }
    });

    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    startTransition(async () => {
      const result = document 
        ? await updateDocument(document.id, formData) 
        : await createDocument(formData);

      if (!result.ok) {
        setServerError(result.error ?? "An error occurred. Please try again.");
        setServerFieldErrors(result.fieldErrors ?? {});
        return;
      }

      if (mode === "addAnother" && !document) {
        form.reset({
          company_id: initialCompanyId ?? "",
          title: "",
          document_type: "Other",
          description: "",
          contact_person_id: initialContactId ?? "",
          interaction_id: initialInteractionId ?? "",
          followup_id: initialFollowupId ?? "",
          status: "submitted",
          submitted_to: "",
          submitted_at: "",
          expiry_date: "",
          remarks: "",
        });
        setSelectedFile(null);
        setFileError(null);
        setSuccessMessage("Document uploaded. You can add another one now.");
        return;
      }

      router.push(`/documents/${result.id || document?.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit((values) => onSubmit(values, "save"))}>
      <FormRequiredNote message="Company, document title, type, and a file are required for new uploads. Everything else is optional metadata you can return to later." dismissible />
      {(initialCompanyId || initialContactId || initialInteractionId || initialFollowupId) && !document ? (
        <FormContextHint message="This upload was opened from existing CRM context, so related records are preselected where possible." />
      ) : null}

      <FormSection title="Basic Information" description="Document identity and core details." contentClassName="md:grid-cols-2 xl:grid-cols-4">
        <SelectField
          label="Company"
          required
          error={form.formState.errors.company_id?.message ?? serverFieldErrors.company_id}
          {...form.register("company_id")}
        >
          <option value="">Select Company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </SelectField>

        <Field label="Document Title" required error={form.formState.errors.title?.message ?? serverFieldErrors.title}>
          <Input {...form.register("title")} placeholder="e.g. Q-2024-001 Revised Quotation" />
        </Field>

        <SelectField
          label="Document Type"
          required
          error={form.formState.errors.document_type?.message ?? serverFieldErrors.document_type}
          {...form.register("document_type")}
        >
          {documentTypeOptions.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </SelectField>

        <SelectField
          label="Status"
          required
          error={form.formState.errors.status?.message ?? serverFieldErrors.status}
          {...form.register("status")}
        >
          {documentStatusOptions.map((status) => (
            <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}</option>
          ))}
        </SelectField>

        <div className="md:col-span-2 xl:col-span-4 space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            {...form.register("description")}
            className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm"
            placeholder="Briefly describe what this document is about..."
          />
        </div>
      </FormSection>

      <FormSection
        title="File Upload"
        description={document ? "Replace the current file or keep it as is." : "Upload the document file."}
        contentClassName="grid-cols-1"
      >
        <FileUploadField
          required={!document}
          error={fileError ?? undefined}
          onFileSelect={(file) => {
            setSelectedFile(file);
            setFileError(null);
          }}
          currentFileName={document?.file_name}
        />
      </FormSection>

      <FormSection title="Related CRM Context" description="Link this document to contacts, meetings, or follow-ups." optional collapsible defaultCollapsed={!hasRelatedContext} contentClassName="md:grid-cols-2 xl:grid-cols-3">
        <SelectField
          label="Contact Person"
          error={form.formState.errors.contact_person_id?.message ?? serverFieldErrors.contact_person_id}
          disabled={!selectedCompanyId}
          {...form.register("contact_person_id")}
        >
          <option value="">No Contact Person</option>
          {filteredContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>{contact.name}</option>
          ))}
        </SelectField>

        <SelectField
          label="Related Meeting"
          error={form.formState.errors.interaction_id?.message ?? serverFieldErrors.interaction_id}
          disabled={!selectedCompanyId}
          {...form.register("interaction_id")}
        >
          <option value="">No Meeting</option>
          {filteredInteractions.map((interaction) => (
            <option key={interaction.id} value={interaction.id}>
              {formatDateBD(interaction.meeting_datetime)} - {interaction.interaction_type}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Related Follow-up"
          error={form.formState.errors.followup_id?.message ?? serverFieldErrors.followup_id}
          disabled={!selectedCompanyId}
          {...form.register("followup_id")}
        >
          <option value="">No Follow-up</option>
          {filteredFollowups.map((followup) => (
            <option key={followup.id} value={followup.id}>{followup.title}</option>
          ))}
        </SelectField>
      </FormSection>

      <FormSection title="Submission Details" description="Tracking where and when the document was submitted." optional collapsible defaultCollapsed={!hasSubmissionDetails} contentClassName="md:grid-cols-2 xl:grid-cols-4">
        <Field label="Submitted To" error={form.formState.errors.submitted_to?.message ?? serverFieldErrors.submitted_to}>
          <Input {...form.register("submitted_to")} placeholder="Person or Department" />
        </Field>

        <Field label="Submitted At" error={form.formState.errors.submitted_at?.message ?? serverFieldErrors.submitted_at}>
          <Input type="date" {...form.register("submitted_at")} />
        </Field>

        <Field label="Expiry Date" error={form.formState.errors.expiry_date?.message ?? serverFieldErrors.expiry_date}>
          <Input type="date" {...form.register("expiry_date")} />
        </Field>
      </FormSection>

      <FormSection title="Additional Notes" description="Internal remarks and notes about this document." optional collapsible defaultCollapsed={!hasRemarks} contentClassName="grid-cols-1 md:grid-cols-1 xl:grid-cols-1">
        <div className="w-full min-w-0 space-y-2">
          <Label htmlFor="remarks">Remarks</Label>
          <textarea
            id="remarks"
            {...form.register("remarks")}
            className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm"
            placeholder="Internal notes, revision history, or special instructions..."
          />
        </div>
      </FormSection>

      {serverError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{serverError}</p> : null}
      {successMessage ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p> : null}

      <FormActionBar>
        <Button asChild variant="outline">
          <Link href={document ? `/documents/${document.id}` : "/documents"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending || form.formState.isSubmitting}>
          <Save className="w-4 h-4 mr-2" />
          {document ? "Update Document" : "Upload Document"}
        </Button>
        {!document && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || form.formState.isSubmitting}
            onClick={form.handleSubmit((values) => onSubmit(values, "addAnother"))}
          >
            <Plus className="w-4 h-4 mr-2" />
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
      <Label>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
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
      <Label>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      <select {...props} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm disabled:opacity-50">
        {children}
      </select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
