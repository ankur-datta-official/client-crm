"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters."),
  confirmPassword: z.string().min(8, "Use at least 8 characters."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token")?.trim() ?? "";

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ResetPasswordValues) {
    setError(null);
    setMessage(null);

    if (!token) {
      setError("Missing reset token. Please request a new password reset link.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        password: values.password,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Could not reset password.");
      return;
    }

    setMessage("Password updated successfully. Redirecting to sign in...");
    form.reset();

    setTimeout(() => {
      router.push("/auth/login");
      router.refresh();
    }, 1000);
  }

  return (
    <Card className="overflow-hidden rounded-[30px] border border-white/90 bg-white/92 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.24)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.94))] dark:shadow-[0_30px_90px_-40px_rgba(2,6,23,0.82)]">
      <div className="h-1.5 bg-[linear-gradient(90deg,#14b8a6,#0ea5e9,#22c55e)]" />
      <CardHeader className="space-y-3 px-6 pb-4 pt-6 sm:px-7">
        <CardTitle className="text-3xl tracking-tight text-slate-950 dark:text-slate-50">Create a new password</CardTitle>
        <CardDescription className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
          Use a strong password with at least 8 characters.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0 sm:px-7">
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-slate-800 dark:text-slate-200">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 characters"
              className="h-14 rounded-2xl border-slate-200 bg-white/95 px-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-800 dark:text-slate-200">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Type the same password again"
              className="h-14 rounded-2xl border-slate-200 bg-white/95 px-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
          {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">{message}</p> : null}

          <Button className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#0f766e,#14b8a6)] text-base font-semibold text-white shadow-[0_20px_34px_-20px_rgba(20,184,166,0.72)] hover:opacity-95" type="submit" disabled={form.formState.isSubmitting}>
            Update password
            <ArrowRight className="size-4.5" />
          </Button>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-300" />
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">For security, each reset link can only be used one time.</p>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground dark:text-slate-400">
          Back to <Link className="font-medium text-primary hover:underline" href="/auth/login">sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}