import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  href?: string;
  title?: string;
  subtitle?: string;
  className?: string;
};

export function BrandLogo({
  compact = false,
  href = "/dashboard",
  title = "Client CRM",
  subtitle = "Sales Workspace",
  className,
}: BrandLogoProps) {
  return (
    <Link href={href} className={cn("group relative flex min-w-0 items-center", compact ? "justify-center" : "gap-3", className)}>
      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[1.15rem] border border-cyan-100/80 bg-white shadow-[0_16px_32px_rgba(14,165,233,0.16)] ring-1 ring-slate-200/70 transition-transform duration-200 group-hover:scale-[1.02] dark:border-cyan-400/20 dark:bg-slate-950 dark:ring-slate-800 dark:shadow-[0_16px_32px_rgba(2,6,23,0.38)]">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(241,245,249,0.94))] dark:bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_48%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]" />
        <Image
          src="/brand/crm-logo.png"
          alt={`${title} logo`}
          width={96}
          height={96}
          priority
          className="relative z-10 size-10 object-contain"
        />
        <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.14)] dark:border-slate-950" />
      </span>
      {!compact ? (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</span>
          <span className="mt-0.5 block truncate text-xs font-medium text-slate-500 dark:text-slate-400">{subtitle}</span>
        </span>
      ) : null}
    </Link>
  );
}
