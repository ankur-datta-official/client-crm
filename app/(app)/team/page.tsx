import { Mail, Shield, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GuidanceStrip } from "@/components/shared/guidance-strip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvitationTable } from "@/components/team/invitation-table";
import { InviteUserForm } from "@/components/team/invite-user-form";
import { RoleTable } from "@/components/team/role-table";
import { TeamHierarchyManager } from "@/components/team/team-hierarchy-manager";
import { TeamMemberTable } from "@/components/team/team-member-table";
import { TeamTargetManager } from "@/components/team/team-target-manager";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { getManagedActivityReport, getPerformanceTargetsForOrganization } from "@/lib/team/performance-queries";
import {
  getCurrentUserId,
  getPermissions,
  getRolesWithPermissions,
  getTeamInvitations,
  getTeamMembers,
} from "@/lib/team/team-queries";

export default async function TeamPage() {
  await requirePermission("team.view");

  const [members, invitations, roles, permissions, currentUserId, canInvite, canUpdateRole, canDeactivate, canManageRoles, performanceTargets, managedActivity] =
    await Promise.all([
      getTeamMembers(),
      getTeamInvitations(),
      getRolesWithPermissions(),
      getPermissions(),
      getCurrentUserId(),
      hasPermission("team.invite"),
      hasPermission("team.update_role"),
      hasPermission("team.deactivate"),
      hasPermission("settings.manage"),
      getPerformanceTargetsForOrganization(),
      getManagedActivityReport(),
    ]);

  const pendingInvitationCount = invitations.filter((invitation) => invitation.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage organization members, invitation links, roles, and CRM access permissions."
        actions={canInvite ? <InviteUserForm roles={roles} /> : undefined}
      />
      <GuidanceStrip dismissible storageKey="crm-tip-team">
        Team invitations now send an authentication email automatically. You can still copy the invite link manually as a backup.
      </GuidanceStrip>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-auto">
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" />
            Team Members
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="mr-2 h-4 w-4" />
            Invitations
            {pendingInvitationCount > 0 ? <Badge className="ml-2">{pendingInvitationCount}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="mr-2 h-4 w-4" />
            Roles & Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <TeamHierarchyManager members={members} canManage={canManageRoles} />
          <TeamTargetManager members={members} targets={performanceTargets} canManage={canManageRoles} />

          {managedActivity.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Junior activity report</CardTitle>
                <CardDescription>Recent company, meeting, and follow-up updates from your directly managed team members.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {managedActivity.map((item) => (
                  <div key={item.id} className="rounded-xl border bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/85">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="font-medium text-foreground">{item.actor_name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {formatManagedActivity(item.action, item.entity_type)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <TeamMemberTable
            members={members}
            roles={roles}
            currentUserId={currentUserId}
            canUpdateRole={canUpdateRole}
            canDeactivate={canDeactivate}
          />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          {!canInvite ? (
            <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/85">
              You can review invitation history here, but you do not have permission to create or manage invites.
            </div>
          ) : null}
          <InvitationTable invitations={invitations} canManage={canInvite} />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          {!canManageRoles ? (
            <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/85">
              You can review roles and permissions here. Editing is limited to users with settings management access.
            </div>
          ) : null}
          <RoleTable roles={roles} permissions={permissions} canManage={canManageRoles} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatManagedActivity(action: string, entityType: string | null) {
  const normalizedAction = action.replaceAll(".", " ");
  const normalizedEntity = entityType ? entityType.replaceAll("_", " ") : "record";
  return `${normalizedAction} on ${normalizedEntity}`;
}
