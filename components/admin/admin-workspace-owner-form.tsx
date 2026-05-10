"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transferWorkspaceOwnerAction } from "@/lib/admin/actions";
import type { AdminWorkspaceMember } from "@/lib/admin/queries";

type AdminWorkspaceOwnerFormProps = {
  workspaceId: string;
  currentOwnerUserId: string | null;
  members: AdminWorkspaceMember[];
};

export function AdminWorkspaceOwnerForm({
  workspaceId,
  currentOwnerUserId,
  members,
}: AdminWorkspaceOwnerFormProps) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState(currentOwnerUserId ?? members[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (members.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-soft dark:border-slate-800/80 dark:bg-slate-950/95">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <Crown className="size-4 text-amber-500" />
        Transfer workspace owner
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <select
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {(member.full_name?.trim() || member.email)}{member.role_name ? ` - ${member.role_name}` : ""}
            </option>
          ))}
        </select>
        <Button
          type="button"
          disabled={isPending || !selectedUserId || selectedUserId === currentOwnerUserId}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              try {
                await transferWorkspaceOwnerAction({ workspaceId, nextOwnerUserId: selectedUserId });
                router.refresh();
                setMessage("Workspace ownership updated.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to transfer owner.");
              }
            });
          }}
        >
          Transfer owner
        </Button>
      </div>
      {message ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">{message}</p>
      ) : null}
    </div>
  );
}
