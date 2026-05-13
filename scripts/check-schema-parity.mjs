import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL.");
}

const prisma = new PrismaClient();

const REQUIRED_COLUMNS = {
  profiles: [
    "id",
    "organization_id",
    "email",
    "full_name",
    "avatar_url",
    "is_active",
    "is_super_admin",
  ],
  documents: [
    "id",
    "organization_id",
    "company_id",
    "file_path",
    "file_name",
    "mime_type",
    "status",
  ],
  companies: [
    "id",
    "organization_id",
    "name",
    "pipeline_stage_id",
    "assigned_user_id",
    "status",
  ],
  team_invitations: [
    "id",
    "organization_id",
    "email",
    "role_id",
    "token",
    "status",
  ],
};

let hasMismatch = false;

try {
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    const columns = await getColumns(tableName);
    const missingColumns = requiredColumns.filter((columnName) => !columns.includes(columnName));

    if (missingColumns.length > 0) {
      hasMismatch = true;
      console.log(`[mismatch] ${tableName}`);
      console.log(`  missing: ${missingColumns.join(", ")}`);
    } else {
      console.log(`[ok] ${tableName}`);
    }
  }
} finally {
  await prisma.$disconnect();
}

if (hasMismatch) {
  process.exitCode = 1;
}

async function getColumns(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
      order by ordinal_position asc
    `,
    tableName,
  );

  return rows.map((row) => row.column_name);
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
