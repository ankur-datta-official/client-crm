"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Link2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormRequiredNote, FormSection } from "@/components/shared/form-helpers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteTeamMember } from "@/lib/team/team-actions";
import type { RoleRow } from "@/lib/team/types";

type InviteUserFormProps = {
  roles: RoleRow[];
  disabled?: boolean;
};

type InviteDeliveryState =
  | { ok: true; method: "smtp_invite" }
  | { ok: false; reason: string };

const initialState = {
  email: "",
  roleId: "",
  fullName: "",
  jobTitle: "",
  department: "",
  phone: "",
};

export function InviteUserForm({ roles, disabled = false }: InviteUserFormProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<InviteDeliveryState | null>(null);

  function reset() {
    setForm(initialState);
    setError(null);
    setInviteLink(null);
    setDelivery(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      reset();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInviteLink(null);
    setDelivery(null);

    startTransition(async () => {
      try {
        const result = await inviteTeamMember(form);
        setInviteLink(`${window.location.origin}/auth/accept-invite?token=${result.token}`);
        setDelivery(result.emailDelivery);
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Unable to create invitation.");
      }
    });
  }

  async function copyInviteLink() {
    if (!inviteLink) {
      return;
    }

    await navigator.clipboard.writeText(inviteLink);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>Invite a team member and assign their CRM access role.</DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-5 w-5" />
                Invitation created successfully.
              </div>
              <p className="mt-2 text-sm">
                {delivery?.ok
                  ? "An authentication email has been sent to the invited team member. They can use that email to join the workspace safely."
                  : "The invite was created, but email delivery could not be confirmed. Use the backup invite link below."}
              </p>
            </div>
            {delivery?.ok ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                Team members will receive a secure invitation link by email and can sign in before accepting access to the workspace.
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="invite-link">Backup Invite Link</Label>
              <div className="flex gap-2">
                <Input id="invite-link" readOnly value={inviteLink} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={copyInviteLink}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormRequiredNote message="Email and role are required. Full name, designation, department, and phone can be added now or later." />
            {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
            <FormSection title="Basic Information" description="Invite details and initial role assignment." contentClassName="md:grid-cols-2" className="border-none shadow-none">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="team-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="team-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="teammate@company.com"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Role <span className="text-destructive">*</span></Label>
                <Select value={form.roleId} onValueChange={(value) => setForm((current) => ({ ...current, roleId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormSection>
            <FormSection title="Optional Profile Details" description="Profile details can be added now for cleaner team setup." optional contentClassName="md:grid-cols-2" className="border-none shadow-none">
              <div className="space-y-2">
                <Label htmlFor="team-full-name">Full Name</Label>
                <Input
                  id="team-full-name"
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Amina Rahman"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-job-title">Designation</Label>
                <Input
                  id="team-job-title"
                  value={form.jobTitle}
                  onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))}
                  placeholder="Sales Executive"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-department">Department</Label>
                <Input
                  id="team-department"
                  value={form.department}
                  onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                  placeholder="Sales"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-phone">Phone</Label>
                <Input
                  id="team-phone"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+8801XXXXXXXXX"
                />
              </div>
            </FormSection>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !form.roleId}>
                {isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
