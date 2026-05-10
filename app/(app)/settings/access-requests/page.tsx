import { redirect } from "next/navigation";
import { AccessRequestManager } from "@/components/admin/access-request-manager";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentProfile } from "@/lib/auth/session";
import { listSignupRequestsForAdmin } from "@/lib/auth/access-requests";

export default async function AccessRequestsPage() {
  const profile = await getCurrentProfile();

  if (!profile?.is_super_admin) {
    redirect("/unauthorized");
  }

  const requests = await listSignupRequestsForAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access Requests"
        description="Review new signup requests, approve them, and issue one-time account access passkeys."
      />
      <AccessRequestManager requests={requests} />
    </div>
  );
}
