"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const adminItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/admin/access-requests", label: "Access Requests", icon: ShieldCheck },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export function AdminConsoleNav() {
  const pathname = usePathname();

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-soft dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
      <div className="flex flex-wrap gap-2">
        {adminItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-100",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
