import { cn } from "@/lib/utils";

type LoadingSkeletonProps = {
  className?: string;
  rows?: number;
};

export function LoadingSkeleton({ className, rows = 3 }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950/80", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
      ))}
    </div>
  );
}
