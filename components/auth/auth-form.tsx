"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

const authSchema = z.object({
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
  fullName: z.string().optional(),
});

type AuthValues = z.infer<typeof authSchema>;

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isRegister = mode === "register";

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
    },
  });

  async function onSubmit(values: AuthValues) {
    setError(null);
    setMessage(null);

    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch (clientError) {
      setError(clientError instanceof Error ? clientError.message : "Supabase is not configured correctly.");
      return;
    }

    const nextPath = searchParams.get("next") ?? "/onboarding/workspace";
    const redirectTarget = new URL(nextPath, window.location.origin).toString();

    if (isRegister) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
          },
          emailRedirectTo: redirectTarget,
        },
      });

      if (signUpError) {
        setError(getAuthErrorMessage(signUpError.message));
        return;
      }

      if (!data.session) {
        setMessage("Account created. Please confirm your email, then sign in to create your workspace.");
        return;
      }

      setMessage("Account created. Continue by setting up your workspace.");
      router.push(nextPath);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (signInError) {
      setError(getAuthErrorMessage(signInError.message));
      return;
    }

    router.push(searchParams.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <Card className="overflow-hidden rounded-[30px] border border-white/90 bg-white/92 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.24)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.94))] dark:shadow-[0_30px_90px_-40px_rgba(2,6,23,0.82)]">
      <div className="h-1.5 bg-[linear-gradient(90deg,#14b8a6,#0ea5e9,#22c55e)]" />
      <CardHeader className="space-y-4 px-6 pb-4 pt-6 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200">
              {isRegister ? <BriefcaseBusiness className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {isRegister ? "Admin setup" : "Secure sign in"}
            </div>
            <CardTitle className="text-3xl tracking-tight text-slate-950 dark:text-slate-50">
              {isRegister ? "Create your CRM account" : "Welcome back"}
            </CardTitle>
            <CardDescription className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
              {isRegister ? "Start with your admin account. Workspace setup comes next." : "Sign in to your CRM workspace and continue your daily pipeline flow."}
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#14b8a6,#0ea5e9)] text-white shadow-[0_18px_28px_-18px_rgba(14,165,233,0.75)]">
              {isRegister ? <BriefcaseBusiness className="size-5" /> : <ShieldCheck className="size-5" />}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            "Protected access",
            isRegister ? "Workspace setup next" : "Resume instantly",
          ].map((item) => (
            <div key={item} className="rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0 sm:px-7">
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {isRegister ? (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-semibold text-slate-800 dark:text-slate-200">Full name</Label>
              <Input
                id="fullName"
                placeholder="Amina Rahman"
                className="h-14 rounded-2xl border-slate-200 bg-white/95 px-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                {...form.register("fullName")}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-slate-800 dark:text-slate-200">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              className="h-14 rounded-2xl border-slate-200 bg-white/95 px-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-slate-800 dark:text-slate-200">Password</Label>
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
          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
          {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">{message}</p> : null}
          <Button className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#0f766e,#14b8a6)] text-base font-semibold text-white shadow-[0_20px_34px_-20px_rgba(20,184,166,0.72)] hover:opacity-95" type="submit" disabled={form.formState.isSubmitting}>
            {isRegister ? "Create account" : "Sign in"}
            <ArrowRight className="size-4.5" />
          </Button>
        </form>
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-300" />
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {isRegister ? "Your account comes first. After that, you will create your workspace and start inviting your team." : "Use your work email to continue where your leads, meetings, and next steps are already organized."}
              </p>
            </div>
          </div>
        <p className="text-center text-sm text-muted-foreground dark:text-slate-400">
          {isRegister ? "Already have an account?" : "New to the CRM?"}{" "}
          <Link className="font-medium text-primary hover:underline" href={isRegister ? "/auth/login" : "/auth/register"}>
            {isRegister ? "Sign in" : "Create account"}
          </Link>
        </p>
        </div>
      </CardContent>
    </Card>
  );
}
