"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { addHelpRequestComment } from "@/lib/crm/help-request-actions";
import { formatDateTimeBD } from "@/lib/format/datetime";
import type { HelpRequestComment } from "@/lib/crm/types";
import { MessageSquare } from "lucide-react";

type HelpRequestCommentsProps = {
  helpRequestId: string;
  comments: HelpRequestComment[];
};

export function HelpRequestComments({ helpRequestId, comments }: HelpRequestCommentsProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;

    setServerError(null);
    startTransition(async () => {
      const result = await addHelpRequestComment(helpRequestId, newComment);
      if (!result.ok) {
        setServerError(result.error ?? "Unable to add comment.");
        return;
      }
      setNewComment("");
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No comments yet. Add the first comment below.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="mt-1 rounded-full bg-primary/10 p-1.5">
                <MessageSquare className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.user_profile?.full_name ?? comment.user_profile?.email ?? "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTimeBD(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 border-t">
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            disabled={isPending}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}
          <Button type="submit" disabled={isPending || !newComment.trim()}>
            {isPending ? "Adding..." : "Add Comment"}
          </Button>
        </form>
      </div>
    </div>
  );
}
