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

const APPLY = process.argv.includes("--apply");

const UPDATED_AT_DEFAULT_TABLES = [
  "profiles",
  "roles",
  "organization_subscriptions",
  "team_invitations",
  "companies",
  "documents",
];

const NOT_NULL_FIXES = [
  {
    label: "companies.name",
    fillSql: `update public.companies set name = coalesce(name, 'Unnamed Company') where name is null;`,
    countSql: `select count(*)::int as count from public.companies where name is null;`,
    alterSql: `alter table public.companies alter column name set not null;`,
  },
  {
    label: "documents.company_id",
    fillSql: null,
    countSql: `select count(*)::int as count from public.documents where company_id is null;`,
    alterSql: `alter table public.documents alter column company_id set not null;`,
  },
  {
    label: "documents.title",
    fillSql: `update public.documents set title = coalesce(title, 'Untitled Document') where title is null;`,
    countSql: `select count(*)::int as count from public.documents where title is null;`,
    alterSql: `alter table public.documents alter column title set not null;`,
  },
  {
    label: "documents.file_name",
    fillSql: `update public.documents set file_name = coalesce(file_name, 'document') where file_name is null;`,
    countSql: `select count(*)::int as count from public.documents where file_name is null;`,
    alterSql: `alter table public.documents alter column file_name set not null;`,
  },
  {
    label: "documents.file_path",
    fillSql: null,
    countSql: `select count(*)::int as count from public.documents where file_path is null;`,
    alterSql: `alter table public.documents alter column file_path set not null;`,
  },
  {
    label: "followups.created_by",
    fillSql: null,
    countSql: `select count(*)::int as count from public.followups where created_by is null;`,
    alterSql: `alter table public.followups alter column created_by set not null;`,
  },
  {
    label: "followups.updated_by",
    fillSql: null,
    countSql: `select count(*)::int as count from public.followups where updated_by is null;`,
    alterSql: `alter table public.followups alter column updated_by set not null;`,
  },
];

const INDEX_RENAMES = [
  {
    oldName: "documents_org_company_created_idx",
    newName: "documents_organization_id_company_id_created_at_idx",
  },
  {
    oldName: "documents_org_status_created_idx",
    newName: "documents_organization_id_status_created_at_idx",
  },
  {
    oldName: "wallet_transactions_org_user_created_idx",
    newName: "wallet_transactions_organization_id_user_id_created_at_idx",
  },
  {
    oldName: "scoring_activity_logs_org_user_created_idx",
    newName: "scoring_activity_logs_organization_id_user_id_created_at_idx",
  },
  {
    oldName: "user_performance_targets_org_user_idx",
    newName: "user_performance_targets_organization_id_user_id_period_typ_idx",
  },
];

const FOREIGN_KEYS = [
  fk("activity_logs", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("activity_logs", ["actor_user_id"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("challenge_templates", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("companies", ["industry_id"], "industries", ["id"], "SET NULL", "CASCADE"),
  fk("companies", ["category_id"], "company_categories", ["id"], "SET NULL", "CASCADE"),
  fk("companies", ["assigned_user_id"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("companies", ["pipeline_stage_id"], "pipeline_stages", ["id"], "SET NULL", "CASCADE"),
  fk("companies", ["referred_by_user_id"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("company_categories", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("company_categories", ["created_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("company_categories", ["updated_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("contact_persons", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("contact_persons", ["company_id"], "companies", ["id"], "CASCADE", "CASCADE"),
  fk("contact_persons", ["created_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("contact_persons", ["updated_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("document_download_logs", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("document_download_logs", ["document_id"], "documents", ["id"], "CASCADE", "CASCADE"),
  fk("document_download_logs", ["downloaded_by"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("documents", ["company_id"], "companies", ["id"], "CASCADE", "CASCADE"),
  fk("documents", ["contact_person_id"], "contact_persons", ["id"], "SET NULL", "CASCADE"),
  fk("documents", ["interaction_id"], "interactions", ["id"], "SET NULL", "CASCADE"),
  fk("documents", ["followup_id"], "followups", ["id"], "SET NULL", "CASCADE"),
  fk("documents", ["created_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("documents", ["updated_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("documents", ["uploaded_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("email_reminder_logs", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("email_reminder_logs", ["followup_id"], "followups", ["id"], "CASCADE", "CASCADE"),
  fk("email_reminder_logs", ["user_id"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("followups", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("followups", ["company_id"], "companies", ["id"], "CASCADE", "CASCADE"),
  fk("followups", ["contact_person_id"], "contact_persons", ["id"], "SET NULL", "CASCADE"),
  fk("followups", ["interaction_id"], "interactions", ["id"], "SET NULL", "CASCADE"),
  fk("followups", ["assigned_user_id"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("followups", ["completed_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("followups", ["created_by"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("followups", ["updated_by"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("help_request_comments", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("help_request_comments", ["help_request_id"], "help_requests", ["id"], "CASCADE", "CASCADE"),
  fk("help_request_comments", ["user_id"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("help_requests", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("help_requests", ["company_id"], "companies", ["id"], "CASCADE", "CASCADE"),
  fk("help_requests", ["contact_person_id"], "contact_persons", ["id"], "SET NULL", "CASCADE"),
  fk("help_requests", ["interaction_id"], "interactions", ["id"], "SET NULL", "CASCADE"),
  fk("help_requests", ["followup_id"], "followups", ["id"], "SET NULL", "CASCADE"),
  fk("help_requests", ["document_id"], "documents", ["id"], "SET NULL", "CASCADE"),
  fk("help_requests", ["requested_by"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("help_requests", ["assigned_to"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("help_requests", ["resolved_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("help_requests", ["created_by"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("help_requests", ["updated_by"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("industries", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("industries", ["created_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("industries", ["updated_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("interactions", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("interactions", ["company_id"], "companies", ["id"], "CASCADE", "CASCADE"),
  fk("interactions", ["contact_person_id"], "contact_persons", ["id"], "SET NULL", "CASCADE"),
  fk("interactions", ["assigned_user_id"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("interactions", ["created_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("interactions", ["updated_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("lead_score_rules", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("lead_source_score_rules", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("pipeline_stages", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("reward_redemptions", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("reward_redemptions", ["user_id"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("reward_redemptions", ["reward_id"], "rewards_catalog", ["id"], "RESTRICT", "CASCADE"),
  fk("reward_redemptions", ["processed_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("rewards_catalog", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("scoring_activity_logs", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("scoring_activity_logs", ["wallet_transaction_id"], "wallet_transactions", ["id"], "SET NULL", "CASCADE"),
  fk("scoring_activity_logs", ["user_id"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("scoring_activity_logs", ["actor_user_id"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("scoring_activity_logs", ["company_id"], "companies", ["id"], "SET NULL", "CASCADE"),
  fk("scoring_activity_logs", ["followup_id"], "followups", ["id"], "SET NULL", "CASCADE"),
  fk("scoring_activity_logs", ["challenge_id"], "challenge_templates", ["id"], "SET NULL", "CASCADE"),
  fk("scoring_activity_logs", ["reward_id"], "rewards_catalog", ["id"], "SET NULL", "CASCADE"),
  fk("user_badges", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("user_badges", ["user_id"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("user_badges", ["reward_id"], "rewards_catalog", ["id"], "SET NULL", "CASCADE"),
  fk("user_badges", ["awarded_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("user_challenge_progress", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("user_challenge_progress", ["user_id"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("user_challenge_progress", ["challenge_template_id"], "challenge_templates", ["id"], "CASCADE", "CASCADE"),
  fk("user_challenge_progress", ["bonus_awarded_transaction_id"], "wallet_transactions", ["id"], "SET NULL", "CASCADE"),
  fk("user_performance_targets", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("user_performance_targets", ["user_id"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("user_performance_targets", ["assigned_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
  fk("user_streaks", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("user_streaks", ["user_id"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("wallet_transactions", ["organization_id"], "organizations", ["id"], "CASCADE", "CASCADE"),
  fk("wallet_transactions", ["user_id"], "profiles", ["id"], "CASCADE", "CASCADE"),
  fk("wallet_transactions", ["company_id"], "companies", ["id"], "SET NULL", "CASCADE"),
  fk("wallet_transactions", ["followup_id"], "followups", ["id"], "SET NULL", "CASCADE"),
  fk("wallet_transactions", ["challenge_id"], "challenge_templates", ["id"], "SET NULL", "CASCADE"),
  fk("wallet_transactions", ["reward_id"], "rewards_catalog", ["id"], "SET NULL", "CASCADE"),
  fk("wallet_transactions", ["created_by"], "profiles", ["id"], "SET NULL", "CASCADE"),
];

try {
  console.log(`Mode: ${APPLY ? "apply" : "dry-run"}`);

  for (const tableName of UPDATED_AT_DEFAULT_TABLES) {
    const sql = `alter table if exists public.${tableName} alter column updated_at set default now();`;
    if (APPLY) {
      await prisma.$executeRawUnsafe(sql);
      console.log(`[default] ${tableName}.updated_at`);
    } else {
      console.log(`[pending default] ${tableName}.updated_at`);
    }
  }

  for (const fix of NOT_NULL_FIXES) {
    if (APPLY && fix.fillSql) {
      await prisma.$executeRawUnsafe(fix.fillSql);
    }

    const [{ count }] = await prisma.$queryRawUnsafe(fix.countSql);
    if (count === 0) {
      if (APPLY) {
        await prisma.$executeRawUnsafe(fix.alterSql);
        console.log(`[not-null] ${fix.label}`);
      } else {
        console.log(`[ready] ${fix.label}`);
      }
    } else {
      console.log(`[blocked] ${fix.label} -> remaining nulls: ${count}`);
    }
  }

  for (const rename of INDEX_RENAMES) {
    const exists = await indexExists(rename.oldName);
    if (!exists) {
      continue;
    }

    if (APPLY) {
      await prisma.$executeRawUnsafe(`alter index if exists public.${rename.oldName} rename to ${rename.newName};`);
      console.log(`[renamed index] ${rename.oldName} -> ${rename.newName}`);
    } else {
      console.log(`[pending index rename] ${rename.oldName} -> ${rename.newName}`);
    }
  }

  for (const spec of FOREIGN_KEYS) {
    if (APPLY) {
      const names = await getForeignKeyNames(spec.table, spec.columns);
      for (const name of names) {
        await prisma.$executeRawUnsafe(`alter table public.${spec.table} drop constraint if exists "${name}";`);
      }

      await prisma.$executeRawUnsafe(
        `alter table public.${spec.table} add constraint "${spec.constraintName}" foreign key (${spec.columns.join(", ")}) references public.${spec.refTable} (${spec.refColumns.join(", ")}) on delete ${spec.onDelete} on update ${spec.onUpdate};`,
      );
      console.log(`[fk] ${spec.constraintName}`);
    } else {
      console.log(`[pending fk] ${spec.constraintName}`);
    }
  }
} finally {
  await prisma.$disconnect();
}

function fk(table, columns, refTable, refColumns, onDelete, onUpdate) {
  return {
    table,
    columns,
    refTable,
    refColumns,
    onDelete,
    onUpdate,
    constraintName: `${table}_${columns.join("_")}_fkey`,
  };
}

async function getForeignKeyNames(tableName, columns) {
  const rows = await prisma.$queryRawUnsafe(
    `
      select c.conname as name
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = $1
        and c.contype = 'f'
        and (
          select array_agg(a.attname::text order by x.ord)
          from unnest(c.conkey) with ordinality as x(attnum, ord)
          join pg_attribute a
            on a.attrelid = t.oid
           and a.attnum = x.attnum
        ) = $2::text[]
    `,
    tableName,
    columns,
  );

  return rows.map((row) => row.name);
}

async function indexExists(indexName) {
  const rows = await prisma.$queryRawUnsafe(
    `
      select exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'i'
          and c.relname = $1
      ) as present
    `,
    indexName,
  );

  return Boolean(rows[0]?.present);
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
