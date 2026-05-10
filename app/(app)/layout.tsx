import { AppShell } from "@/components/app/app-shell";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getCurrentAppContext } from "@/lib/auth/session";
import { getNotificationCenterData } from "@/lib/notifications/notifications";
import { getCurrentProductTourState } from "@/lib/product-tour/server";
import { PRODUCT_TOUR_VERSION } from "@/lib/product-tour/types";
import { getCurrentUserWalletSummary } from "@/lib/scoring/queries";
import { getWorkspaceSwitcherState } from "@/lib/workspace/queries";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const [{ profile, organization }, workspaceSwitcherState] = await Promise.all([
    getCurrentAppContext(),
    getWorkspaceSwitcherState(),
  ]);

  const [notificationCenterData, walletSummary, productTourState] = await Promise.all([
    getNotificationCenterData(),
    organization ? getCurrentUserWalletSummary() : Promise.resolve(null),
    organization
      ? getCurrentProductTourState()
      : Promise.resolve({
          version: PRODUCT_TOUR_VERSION,
          audienceKey: profile?.id ?? "anonymous",
          lastCompletedVersion: null,
          lastSkippedVersion: null,
          lastStartedAt: null,
          shouldAutoStart: false,
        }),
  ]);

  return (
    <ThemeProvider>
      <AppShell
        profile={profile}
        organizationName={organization?.name ?? "Sales Workspace"}
        notifications={notificationCenterData.notifications}
        unreadNotificationCount={notificationCenterData.unreadCount}
        walletSummary={walletSummary}
        initialProductTourState={productTourState}
        workspaces={workspaceSwitcherState.workspaces}
        canCreateWorkspace={workspaceSwitcherState.canCreateWorkspace}
      >
        {children}
      </AppShell>
    </ThemeProvider>
  );
}
