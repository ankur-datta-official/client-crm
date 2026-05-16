"use client";

import Link from "next/link";
import { ChevronDown, Gift, LifeBuoy, Menu, Settings, User, LogOut, KeyRound, LayoutDashboard } from "lucide-react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { useProductTour } from "@/components/providers/product-tour-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import { GlobalSearchInput } from "@/components/search/global-search-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceSwitcherMenu } from "@/components/workspace/workspace-switcher-menu";
import type { Profile } from "@/lib/auth/session";
import { authClient } from "@/lib/auth-client";
import type { NotificationRow } from "@/lib/notifications/notifications";
import type { WalletSummary } from "@/lib/scoring/types";
import type { WorkspaceSummary } from "@/lib/workspace/types";
import { getClientAuthProvider } from "@/lib/auth/provider";
import { getDisplayName } from "@/lib/utils";
import { useRouter } from "next/navigation";

export type AppTopbarProps = {
  onMenuClick?: () => void;
  profile: Profile | null;
  notifications: NotificationRow[];
  unreadNotificationCount: number;
  walletSummary: WalletSummary | null;
  workspaces: WorkspaceSummary[];
  canCreateWorkspace: boolean;
};

export function AppTopbar({ 
  onMenuClick, 
  profile, 
  notifications, 
  unreadNotificationCount,
  walletSummary,
  workspaces,
  canCreateWorkspace,
}: AppTopbarProps) {
  const router = useRouter();
  const { startTour, isActive } = useProductTour();
  const displayName = getDisplayName(profile?.full_name, profile?.email, "Workspace user");

  async function handleLogout() {
    const provider = getClientAuthProvider();

    if (provider === "betterauth") {
      await authClient.signOut();
      router.push("/auth/login");
      router.refresh();
      return;
    }

    if (provider === "nextauth") {
      await signOut({
        redirect: false,
      });
      router.push("/auth/login");
      router.refresh();
      return;
    }

    router.push("/auth/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-slate-950/75">
      <div className="flex min-h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
        <Button className="shrink-0 md:hidden" variant="ghost" size="icon" onClick={onMenuClick} aria-label="Open navigation">
          <Menu />
          <span className="sr-only">Open navigation</span>
        </Button>
        
        <div className="hidden min-w-0 max-w-md flex-1 md:block">
          <GlobalSearchInput className="block w-full max-w-md" />
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 md:gap-3">
          <NotificationCenter initialNotifications={notifications} initialUnreadCount={unreadNotificationCount} />
          <ThemeToggle />
          
          <Link
            href="/rewards"
            className="group flex shrink-0 items-center gap-2 rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50/50 px-2 py-1.5 shadow-sm transition-all hover:-translate-y-px hover:border-amber-300 hover:shadow-md active:scale-[0.98] dark:border-amber-400/20 dark:from-amber-500/10 dark:to-orange-500/5 sm:px-3.5"
          >
            <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-orange-400 to-rose-400 text-white shadow-inner ring-2 ring-white/50 group-hover:scale-[1.04] dark:ring-slate-950/70">
              <Gift className="size-4.5" />
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-[9px] font-bold uppercase tracking-[0.05em] text-amber-600/80 leading-none">Rewards</span>
              <span className="text-[15px] font-black text-amber-700 leading-tight tracking-tight dark:text-amber-300">
                {walletSummary?.wallet_balance?.toLocaleString() ?? 0}
              </span>
            </div>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-tour="tour-quick-restart"
                className="group flex min-w-0 shrink-0 items-center gap-2 rounded-[20px] border border-slate-200/80 bg-white p-1.5 pr-2 shadow-sm outline-none transition-all duration-300 hover:border-primary/30 hover:bg-slate-50/50 hover:shadow-md active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-primary/40 dark:hover:bg-slate-900 sm:gap-3 sm:pr-4"
              >
              <div className="relative">
                <UserAvatar
                  imageUrl={profile?.avatar_url}
                  fullName={profile?.full_name}
                  email={profile?.email}
                  className="size-9 rounded-[14px] shadow-sm ring-2 ring-white transition-transform group-hover:scale-105 dark:ring-slate-900"
                />
                <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm dark:border-slate-900" />
              </div>
              <div className="hidden min-w-0 flex-col items-start lg:flex">
                <span className="truncate text-[13px] font-bold leading-none text-slate-800 transition-colors group-hover:text-primary dark:text-slate-100">{displayName}</span>
                <span className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Administrator</span>
              </div>
              <ChevronDown className="size-4 text-slate-300 transition-colors group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={12} className="w-[min(22rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-[24px] border-slate-200/60 bg-white/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 dark:border-slate-800 dark:bg-slate-950/95">
            <DropdownMenuLabel className="px-3 py-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  imageUrl={profile?.avatar_url}
                  fullName={profile?.full_name}
                  email={profile?.email}
                  className="size-10 rounded-xl shadow-sm"
                />
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-[14px] font-black text-slate-900 dark:text-slate-100">{displayName}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{profile?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mx-2 bg-slate-100/80 dark:bg-slate-800" />
            <div className="space-y-1 p-1.5">
              <WorkspaceSwitcherMenu
                workspaces={workspaces}
                canCreateWorkspace={canCreateWorkspace}
              />
              <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/5 focus:text-primary cursor-pointer transition-colors group">
                <Link href="/settings/profile" className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-focus:bg-primary/10 group-focus:text-primary dark:bg-slate-900 dark:text-slate-400">
                    <User className="size-4" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Profile Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/5 focus:text-primary cursor-pointer transition-colors group">
                <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-focus:bg-primary/10 group-focus:text-primary dark:bg-slate-900 dark:text-slate-400">
                    <Settings className="size-4" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Organization</span>
                </Link>
              </DropdownMenuItem>
              {profile?.is_super_admin ? (
                <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/5 focus:text-primary cursor-pointer transition-colors group">
                  <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-focus:bg-primary/10 group-focus:text-primary dark:bg-slate-900 dark:text-slate-400">
                      <LayoutDashboard className="size-4" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Admin Console</span>
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {profile?.is_super_admin ? (
                <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/5 focus:text-primary cursor-pointer transition-colors group">
                  <Link href="/settings/access-requests" className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-focus:bg-primary/10 group-focus:text-primary dark:bg-slate-900 dark:text-slate-400">
                      <KeyRound className="size-4" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Access Requests</span>
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => startTour("manual")}
                disabled={isActive}
                className="rounded-xl focus:bg-primary/5 focus:text-primary cursor-pointer transition-colors group px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-focus:bg-primary/10 group-focus:text-primary dark:bg-slate-900 dark:text-slate-400">
                    <LifeBuoy className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">How it works</span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Replay the quick product tutorial</span>
                  </div>
                </div>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="mx-2 bg-slate-100/80 dark:bg-slate-800" />
            <div className="p-1.5">
              <DropdownMenuItem 
                onClick={handleLogout}
                className="rounded-xl focus:bg-rose-50 text-rose-600 focus:text-rose-700 cursor-pointer flex items-center gap-3 px-3 py-2.5 group transition-colors"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-rose-50/50 group-focus:bg-rose-100 transition-colors">
                  <LogOut className="size-4" />
                </div>
                <span className="text-[13px] font-bold">Sign Out</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="px-3 pb-3 md:hidden">
        <GlobalSearchInput
          className="block w-full max-w-none"
          inputClassName="h-9"
          resultsClassName="max-h-[min(60vh,28rem)]"
        />
      </div>
    </header>
  );
}
