import { PageHeader } from "@/components/shared/page-header";
import { ChallengeProgressPanel, LeaderboardPanel } from "@/components/scoring/scoring-ui";
import { requireOrganization } from "@/lib/auth/session";
import { getCurrentUserWalletSummary, getWalletLeaderboard } from "@/lib/scoring/queries";

export default async function LeaderboardPage() {
  await requireOrganization();
  const [allTime, weekly, daily, summary] = await Promise.all([
    getWalletLeaderboard("all_time", 20),
    getWalletLeaderboard("weekly", 20),
    getWalletLeaderboard("daily", 20),
    getCurrentUserWalletSummary(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description="See who is leading the workspace, compare scoring periods, and keep an eye on your current challenge progress."
      />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <LeaderboardPanel entries={allTime} title="All-Time Leaders" description="The highest balances across the workspace." />
          <div className="grid gap-6 lg:grid-cols-2">
            <LeaderboardPanel entries={weekly} title="This Week" description="Weekly point race." />
            <LeaderboardPanel entries={daily} title="Today" description="Today's live scoring sprint." />
          </div>
        </div>
        <ChallengeProgressPanel challenges={summary?.challenge_progress ?? []} />
      </div>
    </div>
  );
}
