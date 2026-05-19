import { redirect } from "next/navigation";
import { TeamDashboardView } from "@/components/dashboard/team-dashboard-view";
import { getCurrentOrganization } from "@/lib/auth/session";
import { getTeamDashboardData, normalizeTeamDashboardFilters, resolveTeamDashboardScope } from "@/lib/dashboard/team-dashboard";
import { getWorkspaceSwitcherState } from "@/lib/workspace/queries";

export default async function TeamDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; memberId?: string; managerId?: string; teamId?: string }>;
}) {
  const params = await searchParams;
  const normalizedFilters = normalizeTeamDashboardFilters(params);
  const [scope, organization, workspaceSwitcherState] = await Promise.all([
    resolveTeamDashboardScope(normalizedFilters),
    getCurrentOrganization(),
    getWorkspaceSwitcherState(),
  ]);

  const activeWorkspace = workspaceSwitcherState.workspaces.find((workspace) => workspace.id === organization?.id) ?? null;
  const activeRoleSlug = activeWorkspace?.is_owner ? "organization-admin" : activeWorkspace?.role_slug ?? null;
  const isAllowedRole = activeRoleSlug === "organization-admin" || activeRoleSlug === "sales-manager";

  if (!isAllowedRole) {
    redirect("/unauthorized");
  }

  const normalizedScope = activeRoleSlug === "sales-manager" && scope.viewerMode !== "team"
    ? {
        ...scope,
        visibleUserIds: [],
        selectedUserIds: [],
        selectedManagerId: null,
        selectedTeamId: null,
        selectedMemberId: null,
        selectedMember: null,
        availableMembers: [],
        availableManagers: [],
        availableTeams: [],
      }
    : scope;

  const teamDashboardData = await getTeamDashboardData(normalizedScope, normalizedFilters);
  return <TeamDashboardView data={teamDashboardData} />;
}
