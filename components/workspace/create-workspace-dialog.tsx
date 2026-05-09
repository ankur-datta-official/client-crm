"use client";

import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspaceAction } from "@/lib/workspace/actions";

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is required."),
  companySize: z.string().trim().min(1, "Company size is required."),
});

type WorkspaceValues = z.infer<typeof workspaceSchema>;

type CreateWorkspaceDialogProps = {
  trigger?: ReactNode;
  title?: string;
  description?: string;
};

export function CreateWorkspaceDialog({
  trigger,
  title = "Create another workspace",
  description = "Start a new CRM workspace with its own subscription, roles, and pipeline stages.",
}: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: "",
      companySize: "",
    },
  });

  function handleSubmit(values: WorkspaceValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await createWorkspaceAction(values);

      if (!result.ok) {
        setServerError(result.error);
        return;
      }

      form.reset();
      setOpen(false);
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="rounded-xl">
            <Plus className="size-4" />
            Create Workspace
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="workspace-dialog-name">Workspace name</Label>
            <Input id="workspace-dialog-name" placeholder="Acme Enterprise" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-dialog-size">Company size</Label>
            <Input id="workspace-dialog-size" placeholder="11-50" {...form.register("companySize")} />
            {form.formState.errors.companySize ? (
              <p className="text-xs text-destructive">{form.formState.errors.companySize.message}</p>
            ) : null}
          </div>

          {serverError ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{serverError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={isPending || form.formState.isSubmitting}>
              {isPending ? "Creating..." : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
