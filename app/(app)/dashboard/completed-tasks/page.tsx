import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CompletedTaskRow, CompactEmptyState, DashboardCard } from "@/components/dashboard/dashboard-animations";
import { DashboardDateRangePicker } from "@/components/dashboard/dashboard-date-range-picker";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getDashboardCompletedTasks } from "@/lib/crm/queries";
import { formatDateTimeBD } from "@/lib/format/datetime";

type DashboardCompletedTaskItem = {
  id: string;
  title: string;
  context: string;
  completedAtLabel: string;
  href: string;
  badge: string;
  tone: "emerald" | "blue" | "amber";
};

export default async function DashboardCompletedTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const completedTaskRecords = await getDashboardCompletedTasks(
    from ?? todayStart.toISOString(),
    to ? new Date(new Date(to).setHours(23, 59, 59, 999)).toISOString() : todayEnd.toISOString(),
  );

  const completedTasks: DashboardCompletedTaskItem[] = completedTaskRecords.map((task) => ({
    ...task,
    completedAtLabel: `Completed ${formatDateTimeBD(task.completedAt)}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={from || to ? "Completed Tasks" : "Today's Completed Tasks"}
        description="Browse the full list of completed meetings, follow-ups, and resolved help requests for the selected dashboard date range."
        actions={
          <>
            <DashboardDateRangePicker />
            <Button asChild variant="outline">
              <Link href={buildDashboardHref(from, to)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </>
        }
      />

      <GuidanceStrip>
        This list follows the same dashboard date filter, so you can review completed work day by day or across a wider date range.
      </GuidanceStrip>

      <DashboardCard
        title={from || to ? "Completed Task History" : "Today's Completed Task History"}
        description={`Showing ${completedTasks.length} completed item${completedTasks.length === 1 ? "" : "s"} in the selected date range.`}
        className="h-full"
        contentClassName="pt-0"
        delay={0.1}
      >
        {completedTasks.length === 0 ? (
          <CompactEmptyState
            title="No completed tasks found."
            description="Completed meetings, follow-ups, and resolved help requests for this date range will appear here."
          />
        ) : (
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <CompletedTaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}

function buildDashboardHref(from?: string, to?: string) {
  const params = new URLSearchParams();

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}
