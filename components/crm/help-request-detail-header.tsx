"use client";

import Link from "next/link";
import { Building2, Edit, CheckCircle2, XCircle, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HelpRequestStatusBadge, HelpRequestPriorityBadge, HelpRequestTypeBadge } from "@/components/crm/help-request-badges";
import type { HelpRequest } from "@/lib/crm/types";
import { assignHelpRequestToMe, resolveHelpRequest, rejectHelpRequest, reopenHelpRequest, archiveHelpRequest } from "@/lib/crm/help-request-actions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function HelpRequestDetailHeader({ helpRequest }: { helpRequest: HelpRequest }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAction = (action: (id: string) => Promise<any>) => {
    startTransition(async () => {
      await action(helpRequest.id);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{helpRequest.title}</h1>
            <HelpRequestStatusBadge status={helpRequest.status} />
            <HelpRequestPriorityBadge priority={helpRequest.priority} />
            <HelpRequestTypeBadge type={helpRequest.help_type} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {helpRequest.companies && (
              <Link 
                href={`/companies/${helpRequest.company_id}`}
                className="flex items-center gap-1.5 hover:text-primary hover:underline"
              >
                <Building2 className="h-4 w-4" />
                {helpRequest.companies.name}
              </Link>
            )}
            <span>Requested by {helpRequest.requested_profile?.full_name ?? helpRequest.requested_profile?.email ?? "Unknown"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {helpRequest.status === "open" && (
            <Button 
              variant="outline" 
              disabled={isPending}
              onClick={() => handleAction(assignHelpRequestToMe)}
            >
              Assign to Me
            </Button>
          )}
          {helpRequest.status === "in_progress" && (
            <Button 
              variant="outline" 
              className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" 
              disabled={isPending}
              onClick={() => handleAction(resolveHelpRequest)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Resolve
            </Button>
          )}
          {(helpRequest.status === "open" || helpRequest.status === "in_progress") && (
            <Button 
              variant="outline" 
              className="text-destructive hover:bg-destructive/10 hover:text-destructive" 
              disabled={isPending}
              onClick={() => handleAction(rejectHelpRequest)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          )}
          {(helpRequest.status === "resolved" || helpRequest.status === "rejected") && (
            <Button 
              variant="outline" 
              disabled={isPending}
              onClick={() => handleAction(reopenHelpRequest)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reopen
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/need-help/${helpRequest.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          {helpRequest.status !== "archived" && (
            <Button 
              variant="ghost" 
              className="text-muted-foreground hover:text-destructive" 
              disabled={isPending}
              onClick={() => handleAction(archiveHelpRequest)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
