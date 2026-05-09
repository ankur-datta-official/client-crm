import { AppShell } from "@/components/app/app-shell";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getCurrentOrganization, getCurrentProfile, requireAuth } from "@/lib/auth/session";
import { getNotifications, getUnreadNotificationCount } from "@/lib/notifications/notifications";
import { getCurrentProductTourState } from "@/lib/product-tour/server";
import { PRODUCT_TOUR_VERSION } from "@/lib/product-tour/types";
import { getCurrentUserWalletSummary } from "@/lib/scoring/queries";
import { getAccessibleWorkspaces, getCanCreateWorkspace } from "@/lib/workspace/queries";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const [profile, organization, workspaces, canCreateWorkspace] = await Promise.all([
    getCurrentProfile(),
    getCurrentOrganization(),
    getAccessibleWorkspaces(),
    getCanCreateWorkspace(),
  ]);

  const [notifications, unreadNotificationCount, walletSummary, productTourState] = organization
    ? await Promise.all([
        getNotifications(),
        getUnreadNotificationCount(),
        getCurrentUserWalletSummary(),
        getCurrentProductTourState(),
      ])
    : [
        [],
        0,
        null,
        {
          version: PRODUCT_TOUR_VERSION,
          lastCompletedVersion: null,
          lastSkippedVersion: null,
          lastStartedAt: null,
          shouldAutoStart: false,
        },
      ];

  return (
    <ThemeProvider>
      <AppShell
        profile={profile}
        organizationName={organization?.name ?? "Sales Workspace"}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        walletSummary={walletSummary}
        initialProductTourState={productTourState}
        workspaces={workspaces}
        canCreateWorkspace={canCreateWorkspace}
      >
        {children}
      </AppShell>
    </ThemeProvider>
  );
}
