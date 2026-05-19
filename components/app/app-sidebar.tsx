"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, LayoutDashboard, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { navSections, sidebarItems, type SidebarChildItem, type SidebarItem, type SidebarSection } from "@/config/navigation";
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
  activeWorkspaceRoleSlug?: string | null;
  activeWorkspaceIsOwner?: boolean;
  canViewTeamPage?: boolean;
  canViewTeamPerformance?: boolean;
};

type RenderableSidebarItem = SidebarItem | (Omit<SidebarItem, "icon"> & { icon: typeof LayoutDashboard });

const navIconStyles: Record<string, string> = {
  admin: "bg-[linear-gradient(135deg,#fef3c7,#fde68a)] text-amber-700 ring-1 ring-amber-200/80",
  dashboard: "bg-[linear-gradient(135deg,#eff6ff,#dbeafe)] text-sky-700 ring-1 ring-sky-200/80",
  companies: "bg-[linear-gradient(135deg,#ecfeff,#cffafe)] text-cyan-700 ring-1 ring-cyan-200/80",
  contacts: "bg-[linear-gradient(135deg,#f0fdfa,#ccfbf1)] text-teal-700 ring-1 ring-teal-200/80",
  meetings: "bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-700 ring-1 ring-slate-200/80",
  followups: "bg-[linear-gradient(135deg,#ecfdf5,#d1fae5)] text-emerald-700 ring-1 ring-emerald-200/80",
  pipeline: "bg-[linear-gradient(135deg,#eff6ff,#e0f2fe)] text-sky-700 ring-1 ring-sky-200/80",
  documents: "bg-[linear-gradient(135deg,#eef2ff,#e0e7ff)] text-indigo-700 ring-1 ring-indigo-200/80",
  "need-help": "bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-600 ring-1 ring-slate-200/80",
  leaderboard: "bg-[linear-gradient(135deg,#f0fdf4,#dcfce7)] text-emerald-700 ring-1 ring-emerald-200/80",
  rewards: "bg-[linear-gradient(135deg,#ecfeff,#cffafe)] text-cyan-700 ring-1 ring-cyan-200/80",
  reports: "bg-[linear-gradient(135deg,#eff6ff,#dbeafe)] text-blue-700 ring-1 ring-blue-200/80",
  "team-management": "bg-[linear-gradient(135deg,#f0fdfa,#ccfbf1)] text-teal-700 ring-1 ring-teal-200/80",
  "team-performance": "bg-[linear-gradient(135deg,#eef2ff,#dbeafe)] text-indigo-700 ring-1 ring-indigo-200/80",
  settings: "bg-[linear-gradient(135deg,#f1f5f9,#e2e8f0)] text-slate-700 ring-1 ring-slate-200/80",
};

function matchesHref(pathname: string, searchParams: URLSearchParams, href?: string) {
  if (!href) {
    return false;
  }

  const target = new URL(href, "https://crm.local");
  if (pathname !== target.pathname && !pathname.startsWith(`${target.pathname}/`)) {
    return false;
  }

  for (const [key, value] of target.searchParams.entries()) {
    if (target.pathname === "/team" && key === "tab" && value === "members" && !searchParams.get("tab")) {
      continue;
    }

    if (searchParams.get(key) !== value) {
      return false;
    }
  }

  return true;
}

function getVisibleTeamChildren(item: SidebarItem, input: { canViewTeamPage: boolean; canViewTeamPerformance: boolean }) {
  if (!item.children) {
    return [];
  }

  return item.children.filter((child) => {
    if (child.id === "team-performance") {
      return input.canViewTeamPerformance;
    }

    return input.canViewTeamPage;
  });
}

export function AppSidebar({
  open = false,
  onOpenChange,
  collapsed = false,
  onCollapsedChange,
  organizationName,
  profile,
  activeWorkspaceRoleSlug,
  activeWorkspaceIsOwner = false,
  canViewTeamPage = false,
  canViewTeamPerformance = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [teamManagementOpen, setTeamManagementOpen] = useState(true);

  const itemsWithAdmin: RenderableSidebarItem[] = profile?.is_super_admin
    ? [
        ...sidebarItems,
        { id: "admin", title: "Admin Console", href: "/admin", icon: LayoutDashboard, section: "Admin" as SidebarSection },
      ]
    : [...sidebarItems];

  const filteredItems = useMemo(() => {
    return itemsWithAdmin
      .map((item) => {
        if (!item.children) {
          return item;
        }

        const children = getVisibleTeamChildren(item, { canViewTeamPage, canViewTeamPerformance });
        return children.length > 0 ? { ...item, children } : null;
      })
      .filter((item): item is RenderableSidebarItem => Boolean(item));
  }, [canViewTeamPage, canViewTeamPerformance, itemsWithAdmin]);

  const isTeamManagementActive = filteredItems.some((item) =>
    item.id === "team-management"
    && (item.children?.some((child) => matchesHref(pathname, searchParams, child.href)) ?? false),
  );

  useEffect(() => {
    if (isTeamManagementActive) {
      setTeamManagementOpen(true);
    }
  }, [isTeamManagementActive]);

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
          collapsed ? "w-[min(18rem,calc(100vw-1rem))] md:w-[5.75rem]" : "w-[min(18rem,calc(100vw-1rem))] md:w-[18rem]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("relative border-b border-slate-200/80 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] dark:border-slate-800/80", collapsed ? "px-3" : "px-4")}>
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
              const items = filteredItems.filter((item) => item.section === section);
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
                      if (item.children) {
                        const parentActive = item.children.some((child) => matchesHref(pathname, searchParams, child.href));
                        const iconStyle = navIconStyles[item.id] ?? navIconStyles.settings;
                        const defaultHref = item.children[0]?.href ?? "/team";

                        if (collapsed) {
                          return (
                            <Link
                              key={item.id}
                              href={defaultHref}
                              title={item.title}
                              data-tour={item.tourKey}
                              onClick={() => onOpenChange?.(false)}
                              className={cn(
                                "group relative flex min-h-[2.9rem] items-center justify-center overflow-hidden rounded-2xl px-2 py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 dark:text-slate-300",
                                "hover:bg-white/90 hover:text-slate-900 hover:shadow-[0_8px_20px_rgba(15,23,42,0.05)] dark:hover:bg-slate-900/90 dark:hover:text-slate-100 dark:hover:shadow-[0_8px_20px_rgba(2,6,23,0.4)]",
                                parentActive && "bg-white text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/90 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800",
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute inset-y-2 left-1 w-1 rounded-full bg-transparent transition-all duration-200",
                                  parentActive && "bg-[linear-gradient(180deg,#10b981,#14b8a6)] shadow-[0_0_14px_rgba(16,185,129,0.45)]",
                                )}
                              />
                              <span
                                className={cn(
                                  "flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                                  iconStyle,
                                  parentActive && "scale-105 shadow-[0_10px_22px_rgba(15,23,42,0.08)] saturate-150",
                                )}
                              >
                                <item.icon className="size-4" />
                              </span>
                            </Link>
                          );
                        }

                        return (
                          <div key={item.id} className="space-y-1">
                            <button
                              type="button"
                              data-tour={item.tourKey}
                              onClick={() => setTeamManagementOpen((current) => !current)}
                              className={cn(
                                "group relative flex min-h-[2.9rem] w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-all duration-200 dark:text-slate-300",
                                "hover:bg-white/90 hover:text-slate-900 hover:shadow-[0_8px_20px_rgba(15,23,42,0.05)] dark:hover:bg-slate-900/90 dark:hover:text-slate-100 dark:hover:shadow-[0_8px_20px_rgba(2,6,23,0.4)]",
                                parentActive && "bg-white text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/90 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800",
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute inset-y-2 left-1 w-1 rounded-full bg-transparent transition-all duration-200",
                                  parentActive && "bg-[linear-gradient(180deg,#10b981,#14b8a6)] shadow-[0_0_14px_rgba(16,185,129,0.45)]",
                                )}
                              />
                              <span
                                className={cn(
                                  "flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                                  iconStyle,
                                  parentActive && "scale-105 shadow-[0_10px_22px_rgba(15,23,42,0.08)] saturate-150",
                                )}
                              >
                                <item.icon className="size-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate">{item.title}</span>
                              </div>
                              <ChevronDown className={cn("size-4 text-slate-400 transition-transform dark:text-slate-500", teamManagementOpen && "rotate-180")} />
                            </button>

                            {teamManagementOpen ? (
                              <div className="ml-6 space-y-1 border-l border-slate-200/80 pl-4 dark:border-slate-800/80">
                                {item.children.map((child) => (
                                  <SidebarChildLink
                                    key={child.id}
                                    child={child}
                                    active={matchesHref(pathname, searchParams, child.href)}
                                    onOpenChange={onOpenChange}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      const active = matchesHref(pathname, searchParams, item.href);
                      const iconStyle = navIconStyles[item.id] ?? navIconStyles.settings;

                      return (
                        <Link
                          key={item.id}
                          href={item.href ?? "/dashboard"}
                          title={item.title}
                          data-tour={item.tourKey}
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
                            <item.icon className="size-4" />
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
        <div className={cn("shrink-0 border-t border-slate-200/80 bg-white/80 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/75", collapsed ? "px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
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

function SidebarChildLink({
  child,
  active,
  onOpenChange,
}: {
  child: SidebarChildItem;
  active: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Link
      href={child.href}
      data-tour={child.tourKey}
      onClick={() => onOpenChange?.(false)}
      className={cn(
        "flex min-h-[2.5rem] items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-200",
        active
          ? "bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
          : "text-slate-500 hover:bg-white/85 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/85 dark:hover:text-slate-100",
      )}
    >
      <span className={cn("size-2 rounded-full", active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")} />
      <span className="truncate">{child.title}</span>
    </Link>
  );
}
