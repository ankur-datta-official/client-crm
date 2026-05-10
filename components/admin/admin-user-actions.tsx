"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAdminUserActiveStateAction, setAdminUserSuperAdminStateAction } from "@/lib/admin/actions";

type AdminUserActionsProps = {
  userId: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  isProtected: boolean;
};

export function AdminUserActions({
  userId,
  email,
  isActive,
  isSuperAdmin,
  isProtected,
}: AdminUserActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(work: () => Promise<void>) {
    setMessage(null);
    startTransition(async () => {
      try {
        await work();
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Action failed.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={isActive ? "outline" : "default"}
          size="sm"
          disabled={isPending || (isProtected && isActive)}
          onClick={() => run(() => setAdminUserActiveStateAction({ userId, nextActive: !isActive }))}
        >
          {isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
          {isActive ? "Deactivate" : "Activate"}
        </Button>
        <Button
          type="button"
          variant={isSuperAdmin ? "outline" : "default"}
          size="sm"
          disabled={isPending || isProtected}
          onClick={() => run(() => setAdminUserSuperAdminStateAction({ userId, nextSuperAdmin: !isSuperAdmin }))}
        >
          {isSuperAdmin ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
          {isSuperAdmin ? "Demote admin" : "Promote admin"}
        </Button>
      </div>
      {isProtected ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {email} is the protected fixed super admin account and cannot be deactivated or demoted.
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {message}
        </p>
      ) : null}
    </div>
  );
}
