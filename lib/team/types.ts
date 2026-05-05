export type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  organization_id: string | null;
  created_at: string;
  is_active: boolean;
  last_login_at: string | null;
  role_id: string | null;
  role_name: string | null;
  role_slug: string | null;
  manager_user_id?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
};

export type TeamInvitation = {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  invited_by: string | null;
  token: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  role_name?: string | null;
  role_slug?: string | null;
  invited_by_name?: string;
  invite_link?: string;
};

export type RoleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  organization_id: string;
};

export type RoleWithPermissions = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  organization_id: string;
  permissions: string[];
};

export type Permission = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

export const PERFORMANCE_TARGET_METRICS = {
  leads_created: "Leads created",
  meetings_logged: "Meetings logged",
  followups_completed: "Follow-ups completed",
} as const;

export const PERFORMANCE_TARGET_PERIODS = ["daily", "monthly"] as const;

export type PerformanceTargetMetric = keyof typeof PERFORMANCE_TARGET_METRICS;
export type PerformanceTargetPeriod = (typeof PERFORMANCE_TARGET_PERIODS)[number];

export type UserPerformanceTarget = {
  id: string;
  organization_id: string;
  user_id: string;
  metric_key: PerformanceTargetMetric;
  period_type: PerformanceTargetPeriod;
  target_value: number;
  effective_date: string;
  notes: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    full_name: string | null;
    email: string;
  } | null;
};

export type PerformanceTrendPoint = {
  date: string;
  label: string;
  target: number;
  achievement: number;
};

export type PerformanceMetricSnapshot = {
  metric: PerformanceTargetMetric;
  label: string;
  dailyTarget: number;
  dailyActual: number;
  monthlyTarget: number;
  monthlyActual: number;
};

export type CurrentUserPerformanceSnapshot = {
  metrics: PerformanceMetricSnapshot[];
  trend: PerformanceTrendPoint[];
};

export type ManagedActivityReportItem = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  actor_user_id: string | null;
  actor_name: string;
  actor_email: string;
};

export const PERMISSION_GROUPS = {
  dashboard: {
    label: "Dashboard",
    permissions: ["dashboard.view"],
  },
  companies: {
    label: "Companies",
    permissions: [
      "companies.view",
      "companies.create",
      "companies.update",
      "companies.archive",
      "companies.delete",
    ],
  },
  contacts: {
    label: "Contacts",
    permissions: [
      "contacts.view",
      "contacts.create",
      "contacts.update",
      "contacts.archive",
    ],
  },
  meetings: {
    label: "Meetings",
    permissions: [
      "meetings.view",
      "meetings.create",
      "meetings.update",
      "meetings.archive",
    ],
  },
  followups: {
    label: "Follow-ups",
    permissions: [
      "followups.view",
      "followups.create",
      "followups.update",
      "followups.complete",
      "followups.cancel",
      "followups.archive",
    ],
  },
  documents: {
    label: "Documents",
    permissions: [
      "documents.view",
      "documents.upload",
      "documents.update",
      "documents.download",
      "documents.archive",
    ],
  },
  help_requests: {
    label: "Need Help",
    permissions: [
      "help_requests.view",
      "help_requests.create",
      "help_requests.assign",
      "help_requests.resolve",
      "help_requests.reject",
      "help_requests.archive",
    ],
  },
  reports: {
    label: "Reports",
    permissions: ["reports.view", "reports.export"],
  },
  team: {
    label: "Team",
    permissions: [
      "team.view",
      "team.invite",
      "team.update_role",
      "team.deactivate",
    ],
  },
  settings: {
    label: "Settings",
    permissions: ["settings.view", "settings.manage"],
  },
  subscription: {
    label: "Subscription",
    permissions: ["subscription.view", "subscription.manage"],
  },
  scoring: {
    label: "Scoring",
    permissions: [
      "scoring.view",
      "scoring.manage",
      "rewards.manage",
      "leaderboard.view",
    ],
  },
} as const;
