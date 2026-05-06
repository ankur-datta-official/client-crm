import { AppShell } from "@/components/app/app-shell";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getCurrentOrganization, getCurrentProfile, requireAuth } from "@/lib/auth/session";
import { getNotifications, getUnreadNotificationCount } from "@/lib/notifications/notifications";
import { getCurrentProductTourState } from "@/lib/product-tour/server";
import { getCurrentUserWalletSummary } from "@/lib/scoring/queries";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const [profile, organization, notifications, unreadNotificationCount, walletSummary, productTourState] = await Promise.all([
    getCurrentProfile(),
    getCurrentOrganization(),
    getNotifications(),
    getUnreadNotificationCount(),
    getCurrentUserWalletSummary(),
    getCurrentProductTourState(),
  ]);

  return (
    <ThemeProvider>
      <AppShell
        profile={profile}
        organizationName={organization?.name ?? "Sales Workspace"}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        walletSummary={walletSummary}
        initialProductTourState={productTourState}
      >
        {children}
      </AppShell>
    </ThemeProvider>
  );
}
