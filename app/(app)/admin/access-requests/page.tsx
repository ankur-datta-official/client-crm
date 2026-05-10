import { AccessRequestManager } from "@/components/admin/access-request-manager";
import { PageHeader } from "@/components/shared/page-header";
import { listSignupRequestsForAdmin } from "@/lib/auth/access-requests";

export default async function AdminAccessRequestsPage() {
  const requests = await listSignupRequestsForAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access Requests"
        description="Approve or reject new account requests, issue one-time passkeys, and keep the gated signup pipeline under control."
      />
      <AccessRequestManager requests={requests} />
    </div>
  );
}
