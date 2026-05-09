"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { createWorkspaceAction } from "@/lib/workspace/actions";

const workspaceSchema = z.object({
  name: z.string().min(2, "Workspace name is required."),
  companySize: z.string().min(1, "Company size is required."),
});

type WorkspaceValues = z.infer<typeof workspaceSchema>;

export function WorkspaceForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: "",
      companySize: "",
    },
  });

  function onSubmit(values: WorkspaceValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await createWorkspaceAction(values);

      if (!result.ok) {
        setServerError(result.error);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title="Create workspace"
        description="Set up the organization container for users, roles, CRM data, meetings, and reporting."
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </div>
          <CardTitle>Organization details</CardTitle>
          <CardDescription>This creates your tenant, trial subscription, roles, and pipeline stages.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input id="name" placeholder="Acme Enterprise" {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="companySize">Company size</Label>
              <Input id="companySize" placeholder="51-200" {...form.register("companySize")} />
              {form.formState.errors.companySize ? (
                <p className="text-xs text-destructive">{form.formState.errors.companySize.message}</p>
              ) : null}
            </div>
            {serverError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{serverError}</p> : null}
            <Button type="submit" disabled={isPending || form.formState.isSubmitting}>
              Continue to dashboard
              <ArrowRight />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
