"use client";

import { useState, useTransition } from "react";
import type React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { CompanyStatusBadge } from "@/components/crm/company-status-badge";
import type { CompanyCategory, Industry, PipelineStage, RecordStatus } from "@/lib/crm/types";
import {
  archiveCompanyCategoryAction,
  archiveIndustryAction,
  archivePipelineStageAction,
  createCompanyCategoryAction,
  createIndustryAction,
  createPipelineStageAction,
  updateCompanyCategoryAction,
  updateIndustryAction,
  updatePipelineStageAction,
} from "@/lib/crm/actions";

type EditingState<T> = T | null;

const statuses: RecordStatus[] = ["active", "inactive"];

export function IndustrySettingsManager({ industries }: { industries: Industry[] }) {
  const [editing, setEditing] = useState<EditingState<Industry>>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setError(null);
    const values = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      status: String(formData.get("status") ?? "active"),
    };
    const result = editing
      ? await updateIndustryAction(editing.id, values)
      : await createIndustryAction(values);

    if (!result.ok) setError(result.error ?? "Unable to save industry.");
    else setEditing(null);
  }

  return (
    <SettingsCrudLayout
      title="Industries"
      description="Create the market segments used to classify company leads."
      error={error}
      form={
        <form action={(formData) => startTransition(() => void submit(formData))} className="grid gap-4 md:grid-cols-[1fr_1.4fr_160px_auto]">
          <Field label="Name" name="name" required defaultValue={editing?.name} placeholder="Technology" />
          <Field label="Description" name="description" defaultValue={editing?.description ?? ""} placeholder="Software and IT services" />
          <SelectField label="Status" name="status" defaultValue={editing?.status ?? "active"} options={statuses} />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={isPending}>{editing ? "Update" : "Add"}</Button>
            {editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button> : null}
          </div>
        </form>
      }
    >
      {industries.map((industry) => (
        <ListRow
          key={industry.id}
          title={industry.name}
          description={industry.description}
          badge={<CompanyStatusBadge status={industry.status} />}
          onEdit={() => setEditing(industry)}
          onArchive={() => setArchiveId(industry.id)}
        />
      ))}
      <ConfirmModal
        open={Boolean(archiveId)}
        onOpenChange={(open) => !open && setArchiveId(null)}
        title="Archive industry"
        description="This hides the industry from active CRM forms while preserving history."
        confirmLabel="Archive"
        onConfirm={() => {
          if (!archiveId) return;
          startTransition(async () => {
            await archiveIndustryAction(archiveId);
            setArchiveId(null);
          });
        }}
      />
    </SettingsCrudLayout>
  );
}

export function CompanyCategorySettingsManager({ categories }: { categories: CompanyCategory[] }) {
  const [editing, setEditing] = useState<EditingState<CompanyCategory>>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setError(null);
    const values = {
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
      description: String(formData.get("description") ?? ""),
      priority_level: String(formData.get("priority_level") ?? "3"),
      status: String(formData.get("status") ?? "active"),
    };
    const result = editing
      ? await updateCompanyCategoryAction(editing.id, values)
      : await createCompanyCategoryAction(values);

    if (!result.ok) setError(result.error ?? "Unable to save category.");
    else setEditing(null);
  }

  return (
    <SettingsCrudLayout
      title="Company Categories"
      description="Define lead value tiers and prioritization labels."
      error={error}
      form={
        <form action={(formData) => startTransition(() => void submit(formData))} className="grid gap-4 lg:grid-cols-[1fr_120px_120px_1.3fr_150px_auto]">
          <Field label="Name" name="name" required defaultValue={editing?.name} placeholder="A+ High Value" />
          <Field label="Code" name="code" defaultValue={editing?.code} placeholder="Auto if blank" />
          <Field label="Priority" name="priority_level" defaultValue={editing?.priority_level ?? 3} type="number" />
          <Field label="Description" name="description" defaultValue={editing?.description ?? ""} placeholder="Top priority accounts" />
          <SelectField label="Status" name="status" defaultValue={editing?.status ?? "active"} options={statuses} />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={isPending}>{editing ? "Update" : "Add"}</Button>
            {editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button> : null}
          </div>
        </form>
      }
    >
      {categories.map((category) => (
        <ListRow
          key={category.id}
          title={`${category.code} - ${category.name}`}
          description={category.description}
          badge={<CompanyStatusBadge status={category.status} />}
          meta={`Priority ${category.priority_level}`}
          onEdit={() => setEditing(category)}
          onArchive={() => setArchiveId(category.id)}
        />
      ))}
      <ConfirmModal
        open={Boolean(archiveId)}
        onOpenChange={(open) => !open && setArchiveId(null)}
        title="Archive category"
        description="This hides the category from active CRM forms while preserving company history."
        confirmLabel="Archive"
        onConfirm={() => {
          if (!archiveId) return;
          startTransition(async () => {
            await archiveCompanyCategoryAction(archiveId);
            setArchiveId(null);
          });
        }}
      />
    </SettingsCrudLayout>
  );
}

export function PipelineSettingsManager({
  stages,
}: {
  stages: PipelineStage[];
}) {
  const [editing, setEditing] = useState<EditingState<PipelineStage>>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setError(null);
    const values = {
      name: String(formData.get("name") ?? ""),
      color: String(formData.get("color") ?? "#0f766e"),
      probability: String(formData.get("probability") ?? "0"),
      position: String(formData.get("position") ?? "1"),
      is_won: formData.get("is_won") === "on",
      is_lost: formData.get("is_lost") === "on",
      is_active: formData.get("is_active") === "on",
    };
    const result = editing
      ? await updatePipelineStageAction(editing.id, values)
      : await createPipelineStageAction(values);

    if (!result.ok) setError(result.error ?? "Unable to save pipeline stage.");
    else setEditing(null);
  }

  return (
    <SettingsCrudLayout
      title="Pipeline Stages"
      description="Customize pipeline order, probability, colors, and outcome stages."
      error={error}
      form={
        <form action={(formData) => startTransition(() => void submit(formData))} className="grid gap-4 xl:grid-cols-[1fr_90px_120px_120px_repeat(3,90px)_auto]">
          <Field label="Stage" name="name" required defaultValue={editing?.name} placeholder="Proposal Sent" />
          <Field label="Color" name="color" defaultValue={editing?.color ?? "#0f766e"} type="color" />
          <Field label="Probability" name="probability" defaultValue={editing?.probability ?? 0} type="number" />
          <Field label="Order" name="position" defaultValue={editing?.position ?? stages.length + 1} type="number" />
          <CheckboxField label="Won" name="is_won" defaultChecked={editing?.is_won ?? false} />
          <CheckboxField label="Lost" name="is_lost" defaultChecked={editing?.is_lost ?? false} />
          <CheckboxField label="Active" name="is_active" defaultChecked={editing?.is_active ?? true} />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={isPending}>{editing ? "Update" : "Add"}</Button>
            {editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button> : null}
          </div>
        </form>
      }
    >
      {stages.map((stage) => (
        <ListRow
          key={stage.id}
          title={`${stage.position}. ${stage.name}`}
          description={`${stage.probability}% probability`}
          badge={<span className="inline-flex items-center gap-2 text-sm"><span className="size-3 rounded-full" style={{ background: stage.color }} />{stage.is_active ? "Active" : "Archived"}</span>}
          meta={stage.is_won ? "Won stage" : stage.is_lost ? "Lost stage" : undefined}
          onEdit={() => {
            setEditing(stage);
          }}
          onArchive={() => {
            setArchiveId(stage.id);
          }}
        />
      ))}
      <ConfirmModal
        open={Boolean(archiveId)}
        onOpenChange={(open) => !open && setArchiveId(null)}
        title="Archive pipeline stage"
        description="This keeps historical company records intact while hiding the stage from active workflows."
        confirmLabel="Archive"
        onConfirm={() => {
          if (!archiveId) return;
          startTransition(async () => {
            await archivePipelineStageAction(archiveId);
            setArchiveId(null);
          });
        }}
      />
    </SettingsCrudLayout>
  );
}

function SettingsCrudLayout({
  title,
  description,
  error,
  form,
  children,
}: {
  title: string;
  description: string;
  error: string | null;
  form: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {form}
        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <div className="space-y-2">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </div>
  );
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: string[] }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function CheckboxField({ label, name, defaultChecked }: { label: string; name: string; defaultChecked: boolean }) {
  return (
    <label className="flex h-full min-h-16 items-end gap-2 pb-2 text-sm font-medium">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-4 rounded border" />
      {label}
    </label>
  );
}

function ListRow({
  title,
  description,
  badge,
  meta,
  onEdit,
  onArchive,
  actionsDisabled = false,
}: {
  title: string;
  description?: string | null;
  badge: React.ReactNode;
  meta?: string;
  onEdit: () => void;
  onArchive: () => void;
  actionsDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{title}</p>
          {badge}
          {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
        </div>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit} disabled={actionsDisabled}><Pencil />Edit</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onArchive} disabled={actionsDisabled}><Trash2 />Archive</Button>
      </div>
    </div>
  );
}
