"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutDashboard, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { sidebarItems, type SidebarItem } from "@/config/navigation";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  organizationName?: string;
  profile?: Profile | null;
};

const navSections = ["Overview", "Workspace", "Performance", "Admin"] as const;

const tourAnchorByHref: Record<string, string> = {
  "/dashboard": "tour-nav-dashboard",
  "/companies": "tour-nav-companies",
  "/contacts": "tour-nav-contacts",
  "/meetings": "tour-nav-meetings",
  "/followups": "tour-nav-followups",
  "/pipeline": "tour-nav-pipeline",
  "/documents": "tour-nav-documents",
  "/reports": "tour-nav-reports",
};

const navIconStyles: Record<string, string> = {
  "/admin": "bg-[linear-gradient(135deg,#fef3c7,#fde68a)] text-amber-700 ring-1 ring-amber-200/80",
  "/dashboard": "bg-[linear-gradient(135deg,#eff6ff,#dbeafe)] text-sky-700 ring-1 ring-sky-200/80",
  "/companies": "bg-[linear-gradient(135deg,#ecfeff,#cffafe)] text-cyan-700 ring-1 ring-cyan-200/80",
  "/contacts": "bg-[linear-gradient(135deg,#f0fdfa,#ccfbf1)] text-teal-700 ring-1 ring-teal-200/80",
  "/meetings": "bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-700 ring-1 ring-slate-200/80",
  "/followups": "bg-[linear-gradient(135deg,#ecfdf5,#d1fae5)] text-emerald-700 ring-1 ring-emerald-200/80",
  "/pipeline": "bg-[linear-gradient(135deg,#eff6ff,#e0f2fe)] text-sky-700 ring-1 ring-sky-200/80",
  "/documents": "bg-[linear-gradient(135deg,#eef2ff,#e0e7ff)] text-indigo-700 ring-1 ring-indigo-200/80",
  "/need-help": "bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-600 ring-1 ring-slate-200/80",
  "/leaderboard": "bg-[linear-gradient(135deg,#f0fdf4,#dcfce7)] text-emerald-700 ring-1 ring-emerald-200/80",
  "/rewards": "bg-[linear-gradient(135deg,#ecfeff,#cffafe)] text-cyan-700 ring-1 ring-cyan-200/80",
  "/reports": "bg-[linear-gradient(135deg,#eff6ff,#dbeafe)] text-blue-700 ring-1 ring-blue-200/80",
  "/team": "bg-[linear-gradient(135deg,#f0fdfa,#ccfbf1)] text-teal-700 ring-1 ring-teal-200/80",
  "/settings": "bg-[linear-gradient(135deg,#f1f5f9,#e2e8f0)] text-slate-700 ring-1 ring-slate-200/80",
};

export function AppSidebar({
  open = false,
  onOpenChange,
  collapsed = false,
  onCollapsedChange,
  organizationName,
  profile,
}: AppSidebarProps) {
  const pathname = usePathname();
  const itemsWithAdmin: Array<SidebarItem | { title: string; href: string; icon: typeof LayoutDashboard; section: typeof navSections[number] }> = profile?.is_super_admin
    ? [
        ...sidebarItems,
        { title: "Admin Console", href: "/admin", icon: LayoutDashboard, section: "Admin" as const },
      ]
    : [...sidebarItems];

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] md:hidden",
          open ? "block" : "hidden",
        )}
        onClick={() => onOpenChange?.(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_18%,rgba(241,245,249,0.98)_100%)] shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-[width,transform] duration-300 dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.985)_18%,rgba(15,23,42,0.98)_100%)] dark:shadow-[0_18px_50px_rgba(2,6,23,0.45)] md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0",
          collapsed ? "w-[18rem] md:w-[5.75rem]" : "w-[18rem]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("relative border-b border-slate-200/80 pb-4 pt-5 dark:border-slate-800/80", collapsed ? "px-3" : "px-4")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(226,232,240,0.55),rgba(248,250,252,0))] dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.78),rgba(15,23,42,0))]" />
          <div className={cn("relative flex items-start gap-3", collapsed ? "flex-col items-center justify-center" : "justify-between")}>
            <BrandLogo compact={collapsed} />
            <div className={cn("items-center gap-2", collapsed ? "hidden" : "flex")}>
              <Button
                className="hidden rounded-xl border border-slate-300 bg-white text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 md:inline-flex"
                variant="ghost"
                size="icon"
                onClick={() => onCollapsedChange?.(!collapsed)}
                aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              >
                {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
              </Button>
              <Button className="md:hidden" variant="ghost" size="icon" onClick={() => onOpenChange?.(false)} aria-label="Close navigation">
                <X />
                <span className="sr-only">Close navigation</span>
              </Button>
            </div>
            {collapsed ? (
              <Button
                className="mt-3 hidden size-8 rounded-full border border-slate-300 bg-white text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.1)] ring-1 ring-slate-200/70 hover:border-emerald-200 hover:bg-emerald-50/70 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 md:inline-flex"
                variant="ghost"
                size="icon"
                onClick={() => onCollapsedChange?.(!collapsed)}
                aria-label="Expand navigation"
              >
                <ChevronRight className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <nav className={cn("min-h-0 flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
          <div className="space-y-6 pb-4">
            {navSections.map((section) => {
              const items = itemsWithAdmin.filter((item) => item.section === section);
              if (items.length === 0) {
                return null;
              }

              return (
                <div key={section} className="space-y-2">
                  {collapsed ? (
                    <div className="flex items-center justify-center py-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    </div>
                  ) : (
                    <div className="px-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-400">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        {section}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    {items.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;
                      const iconStyle = navIconStyles[item.href] ?? navIconStyles["/settings"];

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={item.title}
                          data-tour={tourAnchorByHref[item.href]}
                          onClick={() => onOpenChange?.(false)}
                          className={cn(
                            "group relative flex min-h-[2.9rem] items-center overflow-hidden rounded-2xl py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 dark:text-slate-300",
                            "hover:bg-white/90 hover:text-slate-900 hover:shadow-[0_8px_20px_rgba(15,23,42,0.05)] dark:hover:bg-slate-900/90 dark:hover:text-slate-100 dark:hover:shadow-[0_8px_20px_rgba(2,6,23,0.4)]",
                            active && "bg-white text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/90 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800",
                            collapsed ? "justify-center px-2" : "gap-3 px-3",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute inset-y-2 left-1 w-1 rounded-full bg-transparent transition-all duration-200",
                              active && "bg-[linear-gradient(180deg,#10b981,#14b8a6)] shadow-[0_0_14px_rgba(16,185,129,0.45)]",
                            )}
                          />
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                              iconStyle,
                              active && "scale-105 shadow-[0_10px_22px_rgba(15,23,42,0.08)] saturate-150",
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          {!collapsed ? (
                            <div className="min-w-0 flex-1">
                              <span className="block truncate">{item.title}</span>
                            </div>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>
        <div className={cn("shrink-0 border-t border-slate-200/80 bg-white/80 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/75", collapsed ? "px-2 py-3" : "px-3 py-3")}>
          {collapsed ? (
            <div className="flex justify-center">
              <div className="relative">
                <UserAvatar
                  imageUrl={profile?.avatar_url}
                  fullName={profile?.full_name}
                  email={profile?.email}
                  className="size-11 rounded-2xl bg-[linear-gradient(145deg,#0f172a,#334155)] text-white shadow-sm"
                  initialsClassName="text-sm font-semibold"
                />
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-[0_8px_24px_rgba(2,6,23,0.35)]">
              <div className="relative">
                <UserAvatar
                  imageUrl={profile?.avatar_url}
                  fullName={profile?.full_name}
                  email={profile?.email}
                  className="size-10 rounded-2xl bg-[linear-gradient(145deg,#0f172a,#334155)] text-white shadow-sm"
                  initialsClassName="text-sm font-semibold"
                />
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{organizationName ?? "Sales Workspace"}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {profile?.full_name ?? profile?.email ?? "Workspace user"}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                On
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
