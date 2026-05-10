import Link from "next/link";
import { Building2, Edit, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InteractionTypeBadge } from "@/components/crm/interaction-type-badge";
import { formatDateTimeBD } from "@/lib/format/datetime";
import type { Interaction } from "@/lib/crm/types";

export function InteractionDetailHeader({ interaction }: { interaction: Interaction }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{interaction.companies?.name ?? "Meeting"}</h1>
            <InteractionTypeBadge type={interaction.interaction_type} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{formatDateTimeBD(interaction.meeting_datetime)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/followups/new?company=${interaction.company_id}&contact=${interaction.contact_person_id || ""}&interaction=${interaction.id}`}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Create Follow-up
            </Link>
          </Button>
          <Button asChild variant="outline"><Link href={`/companies/${interaction.company_id}`}><Building2 />Company</Link></Button>
          <Button asChild><Link href={`/meetings/${interaction.id}/edit`}><Edit />Edit Meeting</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
