'use client';

import Link from "next/link";
import { LifeBuoy, User, MoreHorizontal, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { HelpRequestStatusBadge, HelpRequestPriorityBadge, HelpRequestTypeBadge } from "@/components/crm/help-request-badges";
import { formatDateBD } from "@/lib/format/datetime";
import type { HelpRequest } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

export function HelpRequestCard({ helpRequest }: { helpRequest: HelpRequest }) {
  const borderColor =
    helpRequest.priority === "urgent" ? "border-l-destructive" :
    helpRequest.priority === "high" ? "border-l-amber-500" :
    helpRequest.priority === "medium" ? "border-l-primary" :
    "border-l-muted";

  return (
    <Card className={cn("overflow-hidden border-l-4", borderColor)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/need-help/${helpRequest.id}`}
                className="font-semibold hover:text-primary hover:underline transition-colors"
              >
                {helpRequest.title}
              </Link>
              <HelpRequestStatusBadge status={helpRequest.status} />
              <HelpRequestPriorityBadge priority={helpRequest.priority} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <LifeBuoy className="h-3.5 w-3.5" />
                <HelpRequestTypeBadge type={helpRequest.help_type} />
              </div>
              {helpRequest.companies && (
                <Link
                  href={`/companies/${helpRequest.companies.id}`}
                  className="hover:text-primary hover:underline"
                >
                  {helpRequest.companies.name}
                </Link>
              )}
            </div>

            {helpRequest.assigned_profile && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>Assigned to: {helpRequest.assigned_profile.full_name || helpRequest.assigned_profile.email}</span>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              {formatDateBD(helpRequest.created_at)}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
              <Link href={`/need-help/${helpRequest.id}`} title="View Details">
                <Eye className="h-4 w-4" />
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem asChild>
                  <Link href={`/need-help/${helpRequest.id}`}>View Details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/need-help/${helpRequest.id}/edit`}>Edit Request</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
