import Link from "next/link";
import { Building2, Edit, CheckCircle2, CalendarClock, XCircle, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FollowupStatusBadge, FollowupTypeBadge, FollowupPriorityBadge } from "@/components/crm/followup-badges";
import type { Followup } from "@/lib/crm/types";
import { completeFollowup, archiveFollowup } from "@/lib/crm/followup-actions";
import { formatDateTimeBD } from "@/lib/format/datetime";

export function FollowupDetailHeader({ followup }: { followup: Followup }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{followup.title}</h1>
            <FollowupStatusBadge status={followup.status} />
            <FollowupPriorityBadge priority={followup.priority} />
            <FollowupTypeBadge type={followup.followup_type} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" />
              {formatDateTimeBD(followup.scheduled_at)}
            </p>
            {followup.companies && (
              <Link 
                href={`/companies/${followup.company_id}`}
                className="flex items-center gap-1.5 hover:text-primary hover:underline"
              >
                <Building2 className="h-4 w-4" />
                {followup.companies.name}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {followup.status === "pending" && (
            <form action={async () => {
              "use server";
              await completeFollowup(followup.id);
            }}>
              <Button type="submit" variant="outline" className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete
              </Button>
            </form>
          )}
          <Button asChild variant="outline">
            <Link href={`/followups/${followup.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          {followup.status !== "archived" && (
             <form action={async () => {
              "use server";
              await archiveFollowup(followup.id);
            }}>
              <Button type="submit" variant="ghost" className="text-muted-foreground hover:text-destructive">
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
