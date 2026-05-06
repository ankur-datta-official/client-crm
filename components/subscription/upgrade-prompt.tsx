import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type UpgradePromptProps = {
  title?: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function UpgradePrompt({
  title = "Upgrade Required",
  description,
  ctaHref = "/subscription",
  ctaLabel = "Review Plans",
}: UpgradePromptProps) {
  return (
    <Card className="border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-orange-50/80 shadow-[0_24px_70px_-56px_rgba(245,158,11,0.7)] dark:border-amber-500/20 dark:bg-[linear-gradient(90deg,rgba(120,53,15,0.22),rgba(15,23,42,0.96),rgba(124,45,18,0.22))] dark:shadow-[0_24px_70px_-44px_rgba(2,6,23,0.98)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
          <div className="rounded-2xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
            <Lock className="h-5 w-5" />
          </div>
          {title}
        </CardTitle>
        <CardDescription className="max-w-3xl text-amber-800 dark:text-amber-100/85">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15">
          <Link href={ctaHref}>
            {ctaLabel}
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
