"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Copy, KeyRound, Mail, OctagonX, RefreshCw } from "lucide-react";
import { issueSignupAccessPasskeyAction, rejectSignupRequestAction } from "@/lib/auth/access-request-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SignupRequestRow } from "@/lib/auth/access-requests";
import { useRouter } from "next/navigation";

type AccessRequestManagerProps = {
  requests: SignupRequestRow[];
};

export function AccessRequestManager({ requests }: AccessRequestManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [generatedPasskeys, setGeneratedPasskeys] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const pendingCount = useMemo(() => requests.filter((request) => request.status === "pending").length, [requests]);

  function setMessage(requestId: string, message: string) {
    setMessages((current) => ({ ...current, [requestId]: message }));
  }

  function handleIssuePasskey(requestId: string) {
    setActiveRequestId(requestId);
    startTransition(async () => {
      try {
        const result = await issueSignupAccessPasskeyAction(requestId);
        setGeneratedPasskeys((current) => ({ ...current, [requestId]: result.passkey }));
        setMessage(
          requestId,
          result.emailDelivery.ok
            ? `Passkey issued and emailed to ${result.email}.`
            : `Passkey issued. Email delivery was not confirmed, so share it manually.`,
        );
        router.refresh();
      } catch (error) {
        setMessage(requestId, error instanceof Error ? error.message : "Could not issue the passkey.");
      } finally {
        setActiveRequestId(null);
      }
    });
  }

  function handleReject(requestId: string) {
    setActiveRequestId(requestId);
    startTransition(async () => {
      try {
        await rejectSignupRequestAction(requestId);
        setMessage(requestId, "Request rejected.");
        router.refresh();
      } catch (error) {
        setMessage(requestId, error instanceof Error ? error.message : "Could not reject the request.");
      } finally {
        setActiveRequestId(null);
      }
    });
  }

  async function copyPasskey(requestId: string) {
    const passkey = generatedPasskeys[requestId];

    if (!passkey) {
      return;
    }

    await navigator.clipboard.writeText(passkey);
    setMessage(requestId, "Passkey copied to clipboard.");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Pending reviews" value={String(pendingCount)} detail="Waiting for super admin approval" icon={Mail} tone="teal" />
        <SummaryCard title="Approved" value={String(requests.filter((request) => request.status === "approved").length)} detail="Passkey has been issued" icon={KeyRound} tone="sky" />
        <SummaryCard title="Completed" value={String(requests.filter((request) => request.status === "completed").length)} detail="Account creation finished" icon={CheckCircle2} tone="emerald" />
      </div>

      <div className="grid gap-4">
        {requests.map((request) => {
          const generatedPasskey = generatedPasskeys[request.id];
          const isWorking = isPending && activeRequestId === request.id;
          const latestPasskeyExpired = request.latest_passkey_is_expired;

          return (
            <Card key={request.id} className="border-slate-200/80 dark:border-slate-800/80">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{request.full_name || "Unnamed requester"}</CardTitle>
                      <StatusBadge status={request.status} />
                    </div>
                    <CardDescription>{request.email}</CardDescription>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Requested {new Date(request.requested_at).toLocaleString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoPill label="Requested" value={new Date(request.requested_at).toLocaleString()} />
                  <InfoPill label="Last passkey" value={request.latest_passkey_created_at ? new Date(request.latest_passkey_created_at).toLocaleString() : "Not issued"} />
                  <InfoPill
                    label="Passkey status"
                    value={
                      request.latest_passkey_used_at
                        ? "Already used"
                        : request.latest_passkey_expires_at
                          ? latestPasskeyExpired
                            ? "Expired"
                            : `Valid until ${new Date(request.latest_passkey_expires_at).toLocaleString()}`
                          : "No active passkey"
                    }
                  />
                </div>

                {generatedPasskey ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">Latest generated passkey</p>
                        <p className="mt-2 font-mono text-base tracking-[0.22em]">{generatedPasskey}</p>
                      </div>
                      <Button type="button" variant="outline" className="gap-2" onClick={() => void copyPasskey(request.id)}>
                        <Copy className="size-4" />
                        Copy
                      </Button>
                    </div>
                  </div>
                ) : null}

                {messages[request.id] ? (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200">
                    {messages[request.id]}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="button" className="gap-2" disabled={isWorking || request.status === "completed"} onClick={() => handleIssuePasskey(request.id)}>
                    {request.status === "approved" ? <RefreshCw className="size-4" /> : <KeyRound className="size-4" />}
                    {isWorking && request.status !== "rejected" ? "Processing..." : request.status === "approved" ? "Regenerate passkey" : "Issue passkey"}
                  </Button>
                  {request.status !== "completed" && request.status !== "rejected" ? (
                    <Button type="button" variant="outline" className="gap-2 text-rose-600" disabled={isWorking} onClick={() => handleReject(request.id)}>
                      <OctagonX className="size-4" />
                      Reject request
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Mail;
  tone: "teal" | "sky" | "emerald";
}) {
  const toneClass = {
    teal: "from-teal-500 to-cyan-500",
    sky: "from-sky-500 to-blue-500",
    emerald: "from-emerald-500 to-teal-500",
  }[tone];

  return (
    <Card className="border-slate-200/80 dark:border-slate-800/80">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", toneClass)}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-100">{value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200",
    approved: "bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200",
    rejected: "bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200",
  }[status] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]", tone)}>
      {status}
    </span>
  );
}
