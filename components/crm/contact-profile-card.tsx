"use client";

import Link from "next/link";
import { Mail, Pencil, Phone, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { DecisionRoleBadge } from "@/components/crm/decision-role-badge";
import { PrimaryContactBadge } from "@/components/crm/primary-contact-badge";
import { RelationshipLevelBadge } from "@/components/crm/relationship-level-badge";
import { archiveContactAction, setPrimaryContactAction } from "@/lib/crm/actions";
import { buildWhatsAppHref, formatContactValues } from "@/lib/crm/contact-channels";
import type { ContactPerson } from "@/lib/crm/types";

export function ContactProfileCard({ contact }: { contact: ContactPerson }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const whatsappHref = buildWhatsAppHref(contact.whatsapp);

  return (
    <Card className={contact.is_primary ? "border-primary/50" : undefined}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/contacts/${contact.id}`} className="font-semibold hover:text-primary">{contact.name}</Link>
              <PrimaryContactBadge primary={contact.is_primary} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{contact.designation ?? "No designation"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <DecisionRoleBadge role={contact.decision_role} />
              <RelationshipLevelBadge level={contact.relationship_level} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {contact.mobile ? <Button asChild size="icon" variant="outline"><a href={`tel:${contact.mobile}`}><Phone /><span className="sr-only">Call</span></a></Button> : null}
            {whatsappHref ? (
              <Button asChild size="icon" variant="outline">
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="text-[#25D366]">
                  <WhatsAppIcon />
                  <span className="sr-only">Open WhatsApp</span>
                </a>
              </Button>
            ) : null}
            {contact.email ? <Button asChild size="icon" variant="outline"><a href={`mailto:${contact.email}`}><Mail /><span className="sr-only">Email</span></a></Button> : null}
            {!contact.is_primary ? (
              <Button size="icon" variant="outline" disabled={isPending} onClick={() => startTransition(async () => { await setPrimaryContactAction(contact.id); router.refresh(); })}>
                <Star />
                <span className="sr-only">Set primary</span>
              </Button>
            ) : null}
            <Button asChild size="icon" variant="ghost"><Link href={`/contacts/${contact.id}/edit`}><Pencil /><span className="sr-only">Edit</span></Link></Button>
            <Button size="icon" variant="ghost" onClick={() => setConfirmOpen(true)}><Trash2 /><span className="sr-only">Archive</span></Button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <span>Mobile: {formatContactValues(contact.mobile_numbers) ?? contact.mobile ?? "-"}</span>
          <span>WhatsApp: {contact.whatsapp ?? "-"}</span>
          <span>Preferred: {contact.preferred_contact_method ?? "-"}</span>
        </div>
      </CardContent>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Archive contact"
        description="This removes the contact from active views while preserving audit history."
        confirmLabel="Archive"
        onConfirm={() => startTransition(async () => {
          await archiveContactAction(contact.id);
          setConfirmOpen(false);
          router.refresh();
        })}
      />
    </Card>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2C6.62 2 2.22 6.4 2.22 11.81c0 1.73.45 3.42 1.31 4.9L2 22l5.43-1.5a9.77 9.77 0 0 0 4.59 1.17h.01c5.4 0 9.8-4.4 9.8-9.81 0-2.62-1.02-5.08-2.78-6.95ZM12.03 20a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.22.89.86-3.14-.2-.32a8.12 8.12 0 0 1-1.25-4.31c0-4.5 3.67-8.17 8.19-8.17 2.18 0 4.22.84 5.76 2.39a8.08 8.08 0 0 1 2.39 5.78c0 4.5-3.68 8.17-8.2 8.17Zm4.48-6.1c-.24-.12-1.4-.69-1.62-.77-.22-.08-.37-.12-.53.12-.16.24-.61.77-.75.93-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.95-1.22-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.53-1.28-.73-1.76-.19-.45-.39-.39-.53-.4h-.45c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 1.99 0 1.17.86 2.3.98 2.46.12.16 1.68 2.57 4.06 3.6.57.25 1.02.4 1.37.52.58.18 1.1.15 1.52.09.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.05-.1-.2-.16-.43-.28Z" />
    </svg>
  );
}
