import Link from "next/link";
import { CalendarClock, User, CheckCircle2, MoreHorizontal, Edit, Trash2, Archive, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { FollowupStatusBadge, FollowupPriorityBadge, FollowupTypeBadge } from "@/components/crm/followup-badges";
import type { Followup } from "@/lib/crm/types";
import { formatDateTimeBD } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";
import { completeFollowup, archiveFollowup, cancelFollowup } from "@/lib/crm/followup-actions";

export function FollowupCard({ followup }: { followup: Followup }) {
  const isOverdue = followup.status === "pending" && new Date(followup.scheduled_at) < new Date();

  return (
    <Card className={cn("overflow-hidden border-l-4", 
      isOverdue ? "border-l-destructive" : 
      followup.status === "completed" ? "border-l-emerald-500" : 
      "border-l-primary"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link 
                href={`/followups/${followup.id}`}
                className="font-semibold hover:text-primary hover:underline transition-colors"
              >
                {followup.title}
              </Link>
              <FollowupStatusBadge status={followup.status} />
              {isOverdue && (
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">
                  Overdue
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                {formatDateTimeBD(followup.scheduled_at)}
              </div>
              <div className="flex items-center gap-1.5">
                <FollowupTypeBadge type={followup.followup_type} className="h-5 py-0" />
              </div>
              <div className="flex items-center gap-1.5">
                <FollowupPriorityBadge priority={followup.priority} className="h-5 py-0" />
              </div>
            </div>

            {followup.assigned_profile && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>Assigned to: {followup.assigned_profile.full_name || followup.assigned_profile.email}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {followup.status === "pending" && (
              <form action={async () => {
                "use server";
                await completeFollowup(followup.id);
              }}>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Mark Complete">
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </form>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem asChild>
                  <Link href={`/followups/${followup.id}`}>View Details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/followups/${followup.id}/edit`}>Edit</Link>
                </DropdownMenuItem>
                {followup.status === "pending" && (
                  <form action={async () => {
                    "use server";
                    await cancelFollowup(followup.id, "Manually cancelled from card");
                  }} className="w-full">
                    <DropdownMenuItem asChild>
                      <button className="flex w-full items-center text-rose-600">
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </button>
                    </DropdownMenuItem>
                  </form>
                )}
                <form action={async () => {
                  "use server";
                  await archiveFollowup(followup.id);
                }} className="w-full">
                  <DropdownMenuItem asChild>
                    <button className="flex w-full items-center text-muted-foreground">
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
