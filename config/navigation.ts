import {
  BarChart3,
  Building2,
  CalendarClock,
  CircleHelp,
  FileText,
  Gift,
  Gauge,
  Handshake,
  KanbanSquare,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  WalletCards,
} from "lucide-react";

export const sidebarItems = [
  { title: "Dashboard", href: "/dashboard", icon: Gauge, section: "Overview" },
  { title: "Companies / Leads", href: "/companies", icon: Building2, section: "Workspace" },
  { title: "Contacts", href: "/contacts", icon: Users, section: "Workspace" },
  { title: "Meetings", href: "/meetings", icon: CalendarClock, section: "Workspace" },
  { title: "Follow-ups", href: "/followups", icon: Handshake, section: "Workspace" },
  { title: "Pipeline", href: "/pipeline", icon: KanbanSquare, section: "Workspace" },
  { title: "Documents", href: "/documents", icon: FileText, section: "Workspace" },
  { title: "Need Help", href: "/need-help", icon: CircleHelp, section: "Workspace" },
  { title: "Leaderboard", href: "/leaderboard", icon: Trophy, section: "Performance" },
  { title: "Rewards", href: "/rewards", icon: Gift, section: "Performance" },
  { title: "Reports", href: "/reports", icon: BarChart3, section: "Performance" },
  { title: "Team", href: "/team", icon: ShieldCheck, section: "Admin" },
  { title: "Subscription", href: "/subscription", icon: WalletCards, section: "Admin" },
  { title: "Settings", href: "/settings", icon: Settings, section: "Admin" },
] as const;

export type SidebarItem = (typeof sidebarItems)[number];
