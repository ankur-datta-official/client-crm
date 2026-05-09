import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const TABLES = [
  "organizations",
  "profiles",
  "roles",
  "permissions",
  "user_roles",
  "subscription_plans",
  "organization_subscriptions",
  "companies",
  "contact_persons",
  "interactions",
  "followups",
  "documents",
  "notifications",
  "team_invitations",
  "pipeline_stages",
  "industries",
  "company_categories",
  "help_requests",
  "help_request_comments",
  "wallet_transactions",
  "reward_redemptions",
  "rewards_catalog",
  "scoring_activity_logs",
  "user_performance_targets",
];

try {
  const rows = [];

  for (const tableName of TABLES) {
    const result = await prisma.$queryRawUnsafe(`select count(*)::int as count from public.${tableName}`);
    rows.push({
      table: tableName,
      count: result[0]?.count ?? 0,
    });
  }

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await prisma.$disconnect();
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
