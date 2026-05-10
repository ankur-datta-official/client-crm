import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactDetailHeader } from "@/components/crm/contact-detail-header";
import { formatDateBD } from "@/lib/format/datetime";
import { getContactById } from "@/lib/crm/queries";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await getContactById(id);

  if (!contact) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <ContactDetailHeader contact={contact} />
      <Card>
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
          <CardDescription>Relationship, communication, and system context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Info label="Company" value={contact.companies?.name} />
          <Info label="Designation" value={contact.designation} />
          <Info label="Department" value={contact.department} />
          <Info label="Mobile" value={contact.mobile} />
          <Info label="WhatsApp" value={contact.whatsapp} />
          <Info label="Email" value={contact.email} />
          <Info label="LinkedIn" value={contact.linkedin} />
          <Info label="Decision role" value={contact.decision_role} />
          <Info label="Relationship level" value={contact.relationship_level} />
          <Info label="Preferred method" value={contact.preferred_contact_method} />
          <Info label="Created by" value={contact.created_profile?.full_name ?? contact.created_profile?.email} />
          <Info label="Created date" value={formatDateBD(contact.created_at)} />
          <div className="md:col-span-2 xl:col-span-3">
            <Info label="Remarks" value={contact.remarks} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || "-"}</p>
    </div>
  );
}
