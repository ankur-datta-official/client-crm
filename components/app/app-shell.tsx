"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import type { NotificationRow } from "@/lib/notifications/notifications";
import type { Profile } from "@/lib/auth/session";
import type { WalletSummary } from "@/lib/scoring/types";

export type AppShellProps = {
  children: React.ReactNode;
  profile: Profile | null;
  organizationName: string;
  notifications: NotificationRow[];
  unreadNotificationCount: number;
  walletSummary: WalletSummary | null;
};

function getInitialSidebarState() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem("crm-sidebar-collapsed") === "true";
}

export function AppShell({ 
  children, 
  profile, 
  organizationName, 
  notifications, 
  unreadNotificationCount,
  walletSummary
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState);

  useEffect(() => {
    window.localStorage.setItem("crm-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="min-h-screen bg-background md:flex md:h-screen md:overflow-hidden">
      <AppSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        organizationName={organizationName}
        profile={profile}
      />
      <div className="flex min-w-0 flex-1 flex-col md:h-screen md:min-h-0">
        <AppTopbar
          onMenuClick={() => setSidebarOpen(true)}
          profile={profile}
          notifications={notifications}
          unreadNotificationCount={unreadNotificationCount}
          walletSummary={walletSummary}
        />
        <main className="mx-auto w-full max-w-[1500px] min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
