import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, icon: Icon, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex min-h-[18rem] flex-col items-center justify-center p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <Icon className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        {actionLabel ? (
          actionHref ? (
            <Button asChild className="mt-5" type="button">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button className="mt-5" type="button" onClick={onAction}>
              {actionLabel}
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
