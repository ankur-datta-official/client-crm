import fs from "node:fs";
import path from "node:path";
import pg from "pg";

loadLocalEnv();

const APPLY = process.argv.includes("--apply");
const SOURCE_DATABASE_URL = process.env.SUPABASE_SOURCE_DATABASE_URL;
const TARGET_DATABASE_URL = process.env.DATABASE_URL;

if (!TARGET_DATABASE_URL) {
  throw new Error("Missing DATABASE_URL.");
}

if (!SOURCE_DATABASE_URL) {
  throw new Error(
    "Missing SUPABASE_SOURCE_DATABASE_URL. Add the source Supabase Postgres connection string to .env.local for this one-time migration.",
  );
}

const { Client } = pg;

const source = new Client({
  connectionString: SOURCE_DATABASE_URL,
  ssl: SOURCE_DATABASE_URL.includes("supabase.co")
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

const target = new Client({
  connectionString: TARGET_DATABASE_URL,
});

const MIGRATION_TABLES = [
  "organizations",
  "subscription_plans",
  "organization_subscriptions",
  "permissions",
  "roles",
  "role_permissions",
  "team_invitations",
  "pipeline_stages",
  "industries",
  "company_categories",
  "companies",
  "contact_persons",
  "interactions",
  "followups",
  "documents",
  "notifications",
  "activity_logs",
  "document_download_logs",
  "email_reminder_logs",
  "help_requests",
  "help_request_comments",
  "lead_score_rules",
  "lead_source_score_rules",
  "challenge_templates",
  "rewards_catalog",
  "wallet_transactions",
  "user_challenge_progress",
  "user_streaks",
  "reward_redemptions",
  "user_badges",
  "scoring_activity_logs",
  "user_performance_targets",
  "user_roles",
];

try {
  await source.connect();
  await target.connect();

  console.log(`Mode: ${APPLY ? "apply" : "dry-run"}`);

  const sourceCounts = await getSourceCounts();
  console.log("[source counts]");
  for (const entry of sourceCounts) {
    console.log(`- ${entry.table}: ${entry.count}`);
  }

  await migrateUsers();

  for (const tableName of MIGRATION_TABLES) {
    await migrateGenericTable(tableName);
  }

  console.log("Done.");
} finally {
  await Promise.allSettled([source.end(), target.end()]);
}

async function getSourceCounts() {
  const tables = ["auth.users", "public.profiles", ...MIGRATION_TABLES.map((table) => `public.${table}`)];
  const result = [];

  for (const fullName of tables) {
    const [schemaName, tableName] = fullName.split(".");
    const count = await scalarCount(source, schemaName, tableName).catch(() => null);
    result.push({
      table: fullName,
      count,
    });
  }

  return result;
}

async function migrateUsers() {
  const rows = await source.query(`
    select
      u.id,
      p.organization_id,
      lower(u.email) as email,
      (u.email_confirmed_at is not null) as auth_email_verified,
      coalesce(p.email_verified, u.email_confirmed_at) as email_verified,
      coalesce(
        p.full_name,
        nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(u.raw_user_meta_data ->> 'name'), '')
      ) as full_name,
      p.avatar_url,
      p.job_title,
      p.department,
      p.phone,
      p.manager_user_id,
      coalesce(p.is_active, true) as is_active,
      coalesce(p.is_super_admin, false) as is_super_admin,
      coalesce(p.wallet_balance, 0) as wallet_balance,
      coalesce(p.wallet_lifetime_earned, 0) as wallet_lifetime_earned,
      p.product_tour_last_completed_version,
      p.product_tour_last_skipped_version,
      p.product_tour_last_started_at,
      coalesce(p.created_at, u.created_at, now()) as created_at,
      coalesce(p.updated_at, now()) as updated_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.email is not null
    order by u.created_at asc
  `);

  console.log(`[users] source rows: ${rows.rowCount}`);

  if (!APPLY || rows.rowCount === 0) {
    return;
  }

  const columns = [
    "id",
    "organization_id",
    "email",
    "auth_email_verified",
    "email_verified",
    "full_name",
    "avatar_url",
    "job_title",
    "department",
    "phone",
    "manager_user_id",
    "is_active",
    "is_super_admin",
    "wallet_balance",
    "wallet_lifetime_earned",
    "product_tour_last_completed_version",
    "product_tour_last_skipped_version",
    "product_tour_last_started_at",
    "created_at",
    "updated_at",
  ];

  await upsertRows({
    client: target,
    tableName: "profiles",
    columns,
    primaryKeyColumns: ["id"],
    rows: rows.rows,
    updateColumns: [
      "organization_id",
      "email",
      "auth_email_verified",
      "email_verified",
      "full_name",
      "avatar_url",
      "job_title",
      "department",
      "phone",
      "manager_user_id",
      "is_active",
      "is_super_admin",
      "wallet_balance",
      "wallet_lifetime_earned",
      "product_tour_last_completed_version",
      "product_tour_last_skipped_version",
      "product_tour_last_started_at",
      "updated_at",
    ],
    tableAlias: "profiles",
  });
}

async function migrateGenericTable(tableName) {
  const sourceColumns = await getColumns(source, "public", tableName);
  const targetColumns = await getColumns(target, "public", tableName);
  const primaryKeyColumns = await getPrimaryKeyColumns(target, "public", tableName);

  if (targetColumns.length === 0) {
    console.log(`[skip] ${tableName} -> target table missing`);
    return;
  }

  if (primaryKeyColumns.length === 0) {
    console.log(`[skip] ${tableName} -> no primary key found on target`);
    return;
  }

  const commonColumns = targetColumns.filter((column) => sourceColumns.includes(column));
  if (commonColumns.length === 0) {
    console.log(`[skip] ${tableName} -> no common columns`);
    return;
  }

  const result = await source.query(
    `select ${commonColumns.map(quoteIdentifier).join(", ")} from public.${quoteIdentifier(tableName)}`,
  );

  console.log(`[table] ${tableName}: ${result.rowCount} row(s), ${commonColumns.length} common column(s)`);

  if (!APPLY || result.rowCount === 0) {
    return;
  }

  await upsertRows({
    client: target,
    tableName,
    columns: commonColumns,
    primaryKeyColumns,
    rows: result.rows,
  });
}

async function upsertRows({
  client,
  tableName,
  columns,
  primaryKeyColumns,
  rows,
  updateColumns = columns.filter((column) => !primaryKeyColumns.includes(column)),
  tableAlias = null,
}) {
  if (rows.length === 0) {
    return;
  }

  const chunkSize = Math.max(1, Math.floor(6000 / Math.max(columns.length, 1)));
  const columnList = columns.map(quoteIdentifier).join(", ");
  const conflictList = primaryKeyColumns.map(quoteIdentifier).join(", ");
  const targetAlias = tableAlias ? quoteIdentifier(tableAlias) : null;
  const updateClause =
    updateColumns.length > 0
      ? updateColumns
          .map((column) => {
            const left = quoteIdentifier(column);
            const current = targetAlias ? `${targetAlias}.${left}` : left;
            return `${left} = coalesce(EXCLUDED.${left}, ${current})`;
          })
          .join(", ")
      : null;

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values = [];
    const valueGroups = chunk.map((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        values.push(row[column]);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    const sql = `
      insert into public.${quoteIdentifier(tableName)} ${targetAlias ? `as ${targetAlias}` : ""} (${columnList})
      values ${valueGroups.join(", ")}
      on conflict (${conflictList})
      ${updateClause ? `do update set ${updateClause}` : "do nothing"}
    `;

    await client.query(sql, values);
  }
}

async function getColumns(client, schemaName, tableName) {
  const result = await client.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = $1
        and table_name = $2
      order by ordinal_position
    `,
    [schemaName, tableName],
  );

  return result.rows.map((row) => row.column_name);
}

async function getPrimaryKeyColumns(client, schemaName, tableName) {
  const result = await client.query(
    `
      select a.attname as column_name
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(i.indkey) with ordinality as x(attnum, ord) on true
      join pg_attribute a on a.attrelid = t.oid and a.attnum = x.attnum
      where n.nspname = $1
        and t.relname = $2
        and i.indisprimary = true
      order by x.ord
    `,
    [schemaName, tableName],
  );

  return result.rows.map((row) => row.column_name);
}

async function scalarCount(client, schemaName, tableName) {
  const result = await client.query(`select count(*)::int as count from ${schemaName}.${quoteIdentifier(tableName)}`);
  return result.rows[0]?.count ?? 0;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
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
