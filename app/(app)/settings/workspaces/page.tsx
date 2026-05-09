import { BriefcaseBusiness } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { WorkspaceManagementPanel } from "@/components/workspace/workspace-management-panel";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth/session";
import { getWorkspaceSwitcherState } from "@/lib/workspace/queries";

export default async function WorkspaceSettingsPage() {
  await requireAuth();
  const { workspaces, canCreateWorkspace } = await getWorkspaceSwitcherState();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspaces"
        description="Switch your active workspace, review where you have access, and create a new workspace when needed."
        actions={(
          <Badge className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100">
            <BriefcaseBusiness className="mr-1 size-3.5" />
            {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}
          </Badge>
        )}
      />
      <WorkspaceManagementPanel
        workspaces={workspaces}
        canCreateWorkspace={canCreateWorkspace}
      />
    </div>
  );
}
