import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CompactEmptyState, DashboardCard, TaskRow } from "@/components/dashboard/dashboard-animations";
import { DashboardDateRangePicker } from "@/components/dashboard/dashboard-date-range-picker";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getDashboardTodoTasks, type DashboardTodoTask } from "@/lib/crm/queries";

export default async function DashboardTodoTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const tasks: DashboardTodoTask[] = await getDashboardTodoTasks(
    from ?? todayStart.toISOString(),
    to ? new Date(new Date(to).setHours(23, 59, 59, 999)).toISOString() : todayEnd.toISOString(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={getTodoTasksPageTitle(from, to)}
        description="Browse the full list of overdue follow-ups, today's to-do follow-ups, open help requests, and upcoming meetings for the selected dashboard date range."
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
        This page follows the same dashboard date filter, so you can review the full to-do workload for today or any selected date range in one place.
      </GuidanceStrip>

      <DashboardCard
        title={getTodoTasksHistoryTitle(from, to)}
        description={`Showing ${tasks.length} to-do item${tasks.length === 1 ? "" : "s"} in the selected date range.`}
        className="h-full"
        contentClassName="pt-0"
        delay={0.1}
      >
        {tasks.length === 0 ? (
          <CompactEmptyState
            title="You're all caught up."
            description="No overdue follow-ups, help requests, or upcoming meetings need attention for this date range."
          />
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}

function getTodoTasksPageTitle(from?: string, to?: string) {
  return from || to ? "Tasks To Do" : "Today's Tasks To Do";
}

function getTodoTasksHistoryTitle(from?: string, to?: string) {
  return from || to ? "To-Do Task History" : "Today's To-Do Task History";
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
