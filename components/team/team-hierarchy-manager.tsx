"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users2 } from "lucide-react";
import { updateTeamMemberManager } from "@/lib/team/team-actions";
import type { TeamMember } from "@/lib/team/types";

type TeamHierarchyManagerProps = {
  members: TeamMember[];
  canManage: boolean;
};

export function TeamHierarchyManager({ members, canManage }: TeamHierarchyManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const activeMembers = members.filter((member) => member.is_active);

  if (!canManage) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-white to-emerald-50/70 p-5 shadow-sm dark:border-teal-500/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(6,78,59,0.22),rgba(15,23,42,0.98))] dark:shadow-[0_20px_44px_-28px_rgba(2,6,23,0.98)]">
      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-teal-500/15 dark:text-teal-300">
          <Users2 className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Senior to junior reporting line</h3>
          <p className="text-sm text-muted-foreground">
            Set who each team member reports to. Senior users can then assign work to their direct juniors and receive activity updates.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {activeMembers.map((member) => (
          <div key={member.id} className="grid gap-3 rounded-xl border bg-white/90 p-4 md:grid-cols-[1.2fr_0.8fr] md:items-center dark:border-slate-800 dark:bg-slate-900/85">
            <div>
              <div className="font-medium text-foreground">{member.full_name ?? member.email}</div>
              <div className="text-sm text-muted-foreground">
                {member.email} {member.role_name ? `• ${member.role_name}` : ""}
              </div>
            </div>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Reports to</span>
              <select
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring dark:border-slate-800 dark:bg-slate-950/85 dark:[color-scheme:dark]"
                value={member.manager_user_id ?? ""}
                disabled={isPending}
                onChange={(event) => {
                  const value = event.target.value || null;
                  setError(null);
                  startTransition(async () => {
                    try {
                      await updateTeamMemberManager(member.id, value);
                      router.refresh();
                    } catch (submissionError) {
                      setError(submissionError instanceof Error ? submissionError.message : "Unable to update reporting line.");
                    }
                  });
                }}
              >
                <option value="">No senior assigned</option>
                {activeMembers
                  .filter((candidate) => candidate.id !== member.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.full_name ?? candidate.email}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
