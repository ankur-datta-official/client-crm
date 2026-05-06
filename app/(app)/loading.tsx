import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-slate-100 dark:bg-slate-900" />
      </div>
      <LoadingSkeleton rows={6} />
    </div>
  );
}
