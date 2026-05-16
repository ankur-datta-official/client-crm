"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { BrowserTimeZoneSync } from "@/components/providers/browser-timezone-sync";
import { ProductTourProvider } from "@/components/providers/product-tour-provider";
import type { NotificationRow } from "@/lib/notifications/notifications";
import type { Profile } from "@/lib/auth/session";
import type { WalletSummary } from "@/lib/scoring/types";
import type { ProductTourState } from "@/lib/product-tour/types";
import type { WorkspaceSummary } from "@/lib/workspace/types";

export type AppShellProps = {
  children: React.ReactNode;
  profile: Profile | null;
  organizationName: string;
  notifications: NotificationRow[];
  unreadNotificationCount: number;
  walletSummary: WalletSummary | null;
  initialProductTourState: ProductTourState;
  workspaces: WorkspaceSummary[];
  canCreateWorkspace: boolean;
};

export function AppShell({ 
  children, 
  profile, 
  organizationName, 
  notifications, 
  unreadNotificationCount,
  walletSummary,
  initialProductTourState,
  workspaces,
  canCreateWorkspace,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("crm-sidebar-collapsed") === "true";
  });

  useEffect(() => {
    window.localStorage.setItem("crm-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <ProductTourProvider initialState={initialProductTourState}>
      <BrowserTimeZoneSync />
      <div data-app-shell-root className="flex h-dvh min-h-dvh overflow-hidden bg-background">
        <AppSidebar
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          organizationName={organizationName}
          profile={profile}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppTopbar
            onMenuClick={() => setSidebarOpen(true)}
            profile={profile}
            notifications={notifications}
            unreadNotificationCount={unreadNotificationCount}
            walletSummary={walletSummary}
            workspaces={workspaces}
            canCreateWorkspace={canCreateWorkspace}
          />
          <main className="mx-auto w-full max-w-[1500px] min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </ProductTourProvider>
  );
}
