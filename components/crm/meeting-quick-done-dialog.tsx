"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { completeInteractionAction } from "@/lib/crm/actions";
import type { Interaction } from "@/lib/crm/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type MeetingQuickDoneDialogProps = {
  interaction: Pick<
    Interaction,
    | "id"
    | "interaction_type"
    | "discussion_details"
    | "next_action"
    | "next_followup_at"
    | "need_help"
    | "completed_at"
  >;
  trigger?: React.ReactNode;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
  triggerSize?: "default" | "sm" | "lg" | "icon";
};

export function MeetingQuickDoneDialog({
  interaction,
  trigger,
  triggerLabel = "Mark Done",
  triggerVariant = "outline",
  triggerSize = "sm",
}: MeetingQuickDoneDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [discussionDetails, setDiscussionDetails] = useState(interaction.discussion_details ?? "");
  const [nextAction, setNextAction] = useState(interaction.next_action ?? "");
  const [nextFollowupAt, setNextFollowupAt] = useState(toLocalDateTimeValue(interaction.next_followup_at));
  const [needHelp, setNeedHelp] = useState(interaction.need_help);
  const [createFollowupNow, setCreateFollowupNow] = useState(Boolean(interaction.next_followup_at));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isCompleted = Boolean(interaction.completed_at);
  const isFollowupCreationAvailable = nextFollowupAt.trim().length > 0;

  const description = useMemo(() => {
    if (isCompleted) {
      return "This meeting is already completed. You can still review the captured outcome from the detail page.";
    }

    return "Capture the actual discussion outcome and next move without opening the full edit screen.";
  }, [isCompleted]);

  function resetFromInteraction() {
    setDiscussionDetails(interaction.discussion_details ?? "");
    setNextAction(interaction.next_action ?? "");
    setNextFollowupAt(toLocalDateTimeValue(interaction.next_followup_at));
    setNeedHelp(interaction.need_help);
    setCreateFollowupNow(Boolean(interaction.next_followup_at));
    setError(null);
    setFieldErrors({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetFromInteraction();
    }
  }

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await completeInteractionAction(interaction.id, {
        discussion_details: discussionDetails,
        next_action: nextAction,
        next_followup_at: nextFollowupAt || null,
        need_help: needHelp,
        create_followup_now: createFollowupNow && Boolean(nextFollowupAt),
      });

      if (!result.ok) {
        setError(result.error ?? "Unable to complete the meeting right now.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={triggerVariant} size={triggerSize} disabled={isCompleted}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isCompleted ? "Completed" : triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCompleted ? "Meeting already completed" : "Quick Done"}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isCompleted ? null : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Discussion Summary <span className="text-destructive">*</span>
              </label>
              <textarea
                value={discussionDetails}
                onChange={(event) => setDiscussionDetails(event.target.value)}
                className="min-h-32 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm"
                placeholder="What happened in this meeting?"
              />
              {fieldErrors.discussion_details ? <p className="text-xs text-destructive">{fieldErrors.discussion_details}</p> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Next Action</label>
                <input
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm"
                  placeholder="Call back with pricing, send proposal, etc."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Next Follow-up Date & Time</label>
                <input
                  type="datetime-local"
                  value={nextFollowupAt}
                  onChange={(event) => {
                    setNextFollowupAt(event.target.value);
                    if (!event.target.value) {
                      setCreateFollowupNow(false);
                    }
                  }}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm"
                />
                {fieldErrors.next_followup_at ? <p className="text-xs text-destructive">{fieldErrors.next_followup_at}</p> : null}
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={needHelp}
                  onChange={(event) => setNeedHelp(event.target.checked)}
                />
                Raise internal help flag for this meeting
              </label>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={createFollowupNow}
                  disabled={!isFollowupCreationAvailable}
                  onChange={(event) => setCreateFollowupNow(event.target.checked)}
                />
                Create a follow-up task now from this next step
              </label>
              <p className="text-xs text-muted-foreground">
                A follow-up task will only be created if you set a next follow-up date and time.
              </p>
            </div>

            {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          {!isCompleted ? (
            <Button onClick={handleSubmit} disabled={isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {isPending ? "Saving..." : "Mark Done"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalDateTimeValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
