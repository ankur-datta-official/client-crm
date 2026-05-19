"use server";

import "server-only";

import * as XLSX from "xlsx";
import { getCurrentProfile, getCurrentUser, hasPermission } from "@/lib/auth/session";
import { getTeamDashboardData, normalizeTeamDashboardFilters, resolveTeamDashboardScope, type TeamDashboardData } from "@/lib/dashboard/team-dashboard";

type TeamDashboardExportInput = {
  from?: string | null;
  to?: string | null;
  managerId?: string | null;
  teamId?: string | null;
  memberId?: string | null;
};

type TeamDashboardExportResult = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
};

function formatTimestampForFile(value: Date) {
  return value.toISOString().replace(/[:.]/g, "-");
}

function buildSheetFromRows(rows: Array<Record<string, unknown>>, headers: string[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });

  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  const widths: Array<{ wch: number }> = [];

  for (let col = range.s.c; col <= range.e.c; col++) {
    let maxWidth = 12;
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cell = worksheet[XLSX.utils.encode_cell({ c: col, r: row })];
      const value = cell?.v == null ? "" : String(cell.v);
      maxWidth = Math.min(48, Math.max(maxWidth, value.length + 2));
    }
    widths.push({ wch: maxWidth });
  }

  worksheet["!cols"] = widths;
  return worksheet;
}

function buildSummarySheet(data: TeamDashboardData, exportedBy: string, exportedAtIso: string) {
  const rows: Array<Array<string | number>> = [
    ["Dashboard", "Team Performance Dashboard"],
    ["Exported By", exportedBy],
    ["Exported At (UTC)", exportedAtIso],
    ["Date From", data.range.from],
    ["Date To", data.range.to],
    ["Selected Team", data.scope.selectedTeamId ?? "All Teams"],
    ["Selected Manager", data.scope.availableManagers.find((manager) => manager.id === data.scope.selectedManagerId)?.name ?? "All Managers"],
    ["Selected Member", data.scope.selectedMember?.name ?? "All Visible Members"],
    [],
    ["KPI", "Value"],
    ["Pipeline Value", data.kpis.pipelineValue],
    ["Active Deals", data.kpis.activeDeals],
    ["Due Follow-ups", data.kpis.dueFollowups],
    ["Open Help Requests", data.kpis.openHelpRequests],
    ["Target Achievement", `${data.kpis.targetAchievement}%`],
    ["Low Performer Count", data.kpis.lowPerformerCount],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 28 }, { wch: 40 }];
  return worksheet;
}

function buildMemberRowsSheet(data: TeamDashboardData) {
  const rows = data.memberRows.map((row) => ({
    "Member Name": row.name,
    Email: row.email,
    Role: row.roleName ?? "",
    "Leads Created": row.leadsCreated,
    "Lead Target": row.targetLeads,
    "Meetings Logged": row.meetingsLogged,
    "Meeting Target": row.targetMeetings,
    "Follow-ups Completed": row.followupsCompleted,
    "Follow-up Target": row.targetFollowups,
    "Deal Value Managed": row.dealValueManaged,
    "Active Deals": row.activeDeals,
    "Open Help Requests": row.openHelpRequests,
    "Documents Uploaded": row.documentsUploaded,
    "Actual Total": row.actualTotal,
    "Target Total": row.targetTotal,
    Achievement: `${row.achievement}%`,
    Status: row.statusLabel,
  }));

  return buildSheetFromRows(rows, [
    "Member Name",
    "Email",
    "Role",
    "Leads Created",
    "Lead Target",
    "Meetings Logged",
    "Meeting Target",
    "Follow-ups Completed",
    "Follow-up Target",
    "Deal Value Managed",
    "Active Deals",
    "Open Help Requests",
    "Documents Uploaded",
    "Actual Total",
    "Target Total",
    "Achievement",
    "Status",
  ]);
}

function buildMetricSheet(data: TeamDashboardData) {
  const rows = data.metrics.map((metric) => ({
    Metric: metric.label,
    Actual: metric.actual,
    Target: metric.target,
    Achievement: `${metric.achievement}%`,
  }));

  return buildSheetFromRows(rows, ["Metric", "Actual", "Target", "Achievement"]);
}

function buildActivitySheet(data: TeamDashboardData) {
  const rows = data.recentActivity.map((item) => ({
    Title: item.title,
    Subtitle: item.subtitle,
    "Time Label": item.timeLabel,
    Link: item.href,
  }));

  return buildSheetFromRows(rows, ["Title", "Subtitle", "Time Label", "Link"]);
}

function buildStageSheet(data: TeamDashboardData) {
  const rows = data.pipelineStageDistribution.map((item) => ({
    Stage: item.name,
    Count: item.count,
    Color: item.color,
  }));

  return buildSheetFromRows(rows, ["Stage", "Count", "Color"]);
}

export async function buildTeamDashboardExport(input: TeamDashboardExportInput): Promise<TeamDashboardExportResult> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const allowed = await Promise.all([
    hasPermission("settings.manage"),
    hasPermission("team.manage_hierarchy"),
    hasPermission("team.view_activity"),
    hasPermission("team.manage_targets"),
  ]);

  if (!allowed.some(Boolean)) {
    throw new Error("Forbidden");
  }

  const profile = await getCurrentProfile();
  if (!profile?.organization_id || !profile.is_active || !profile.workspace_is_active) {
    throw new Error("Workspace not available.");
  }

  const filters = normalizeTeamDashboardFilters(input);
  const scope = await resolveTeamDashboardScope(filters);
  const data = await getTeamDashboardData(scope, filters);
  const workbook = XLSX.utils.book_new();
  const exportedAt = new Date();
  const exportedBy = profile.full_name ?? profile.email;

  XLSX.utils.book_append_sheet(workbook, buildSummarySheet(data, exportedBy, exportedAt.toISOString()), "Summary");
  XLSX.utils.book_append_sheet(workbook, buildMemberRowsSheet(data), "Members");
  XLSX.utils.book_append_sheet(workbook, buildMetricSheet(data), "Metrics");
  XLSX.utils.book_append_sheet(workbook, buildStageSheet(data), "Pipeline Stages");
  XLSX.utils.book_append_sheet(workbook, buildActivitySheet(data), "Recent Activity");

  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  return {
    buffer,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: `team-dashboard-export-${formatTimestampForFile(exportedAt)}.xlsx`,
  };
}
