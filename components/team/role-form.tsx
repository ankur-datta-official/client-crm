"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormRequiredNote } from "@/components/shared/form-helpers";
import { createRole, updateRole } from "@/lib/team/team-actions";
import type { RoleWithPermissions } from "@/lib/team/types";

type RoleFormProps = {
  selectedRole: RoleWithPermissions | null;
  canManage: boolean;
  onSaved: (roleId: string | null) => void;
};

export function RoleForm({ selectedRole, canManage, onSaved }: RoleFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(selectedRole?.name ?? "");
  const [description, setDescription] = useState(selectedRole?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        if (selectedRole) {
          await updateRole(selectedRole.id, { name, description });
          onSaved(selectedRole.id);
        } else {
          const createdRole = await createRole({ name, description });
          setName("");
          setDescription("");
          onSaved(createdRole.id);
        }
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Unable to save role.");
      }
    });
  }

  const isSystemRole = selectedRole?.is_system ?? false;

  return (
    <form className="space-y-4 rounded-lg border bg-white p-4" onSubmit={handleSubmit}>
      <div>
        <h3 className="text-base font-semibold">{selectedRole ? "Role details" : "Create custom role"}</h3>
        <p className="text-sm text-muted-foreground">
          {selectedRole
            ? "Rename or describe a selected custom role."
            : "Create a custom team role, then choose exactly what that role can access."}
        </p>
      </div>
      <FormRequiredNote message="Only the role name is required. After you save the role, you can configure its permissions on the right and assign it to team members from the Team Members tab." />
      {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      <div className="space-y-2">
        <Label htmlFor="role-name">Role Name <span className="text-destructive">*</span></Label>
        <Input
          id="role-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Customer Success Lead"
          disabled={!canManage || isSystemRole}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role-description">Description</Label>
        <Input
          id="role-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe who should use this role"
          disabled={!canManage || isSystemRole}
        />
      </div>
      <Button type="submit" disabled={!canManage || isPending || !name.trim() || isSystemRole}>
        {isPending ? "Saving..." : selectedRole ? "Save Role" : "Create Role"}
      </Button>
      {selectedRole?.is_system ? (
        <p className="text-xs text-muted-foreground">System role names stay fixed, but you can still adjust permissions safely below.</p>
      ) : null}
    </form>
  );
}
