import { AdminConsoleNav } from "@/components/admin/admin-console-nav";
import { requireSuperAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="space-y-6">
      <AdminConsoleNav />
      {children}
    </div>
  );
}
