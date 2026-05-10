"use client";

import Link from "next/link";
import { Pencil, Trash2, CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { InteractionTypeBadge } from "@/components/crm/interaction-type-badge";
import { LeadTemperatureBadge } from "@/components/crm/lead-temperature-badge";
import { RatingBadge } from "@/components/crm/rating-badge";
import { archiveInteractionAction } from "@/lib/crm/actions";
import { formatDateTimeBD } from "@/lib/format/datetime";
import type { Interaction } from "@/lib/crm/types";

export function InteractionTimelineCard({ interaction }: { interaction: Interaction }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2"><InteractionTypeBadge type={interaction.interaction_type} /><RatingBadge rating={interaction.success_rating} />{interaction.lead_temperature ? <LeadTemperatureBadge temperature={interaction.lead_temperature} /> : null}</div>
            <p className="mt-2 text-sm font-medium">{formatDateTimeBD(interaction.meeting_datetime)}</p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{interaction.discussion_details}</p>
            <p className="mt-2 text-xs text-muted-foreground">Contact: {interaction.contact_persons?.name ?? "No contact"} / Created by: {interaction.created_profile?.full_name ?? interaction.created_profile?.email ?? "-"}</p>
            {interaction.next_action ? <p className="mt-2 text-sm">Next: {interaction.next_action}</p> : null}
          </div>
          <div className="flex gap-1">
            <Button asChild size="sm" variant="outline" title="Create Follow-up">
              <Link href={`/followups/new?company=${interaction.company_id}&contact=${interaction.contact_person_id || ""}&interaction=${interaction.id}`}>
                <CalendarPlus className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline"><Link href={`/meetings/${interaction.id}`}>View</Link></Button>
            <Button asChild size="icon" variant="ghost"><Link href={`/meetings/${interaction.id}/edit`}><Pencil /><span className="sr-only">Edit</span></Link></Button>
            <Button size="icon" variant="ghost" disabled={isPending} onClick={() => setOpen(true)}><Trash2 /><span className="sr-only">Archive</span></Button>
          </div>
        </div>
      </CardContent>
      <ConfirmModal open={open} onOpenChange={setOpen} title="Archive meeting" description="This removes the interaction from active meeting history." confirmLabel="Archive" onConfirm={() => startTransition(async () => { await archiveInteractionAction(interaction.id); setOpen(false); router.refresh(); })} />
    </Card>
  );
}
