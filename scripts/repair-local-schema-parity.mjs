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

const DRY_RUN = !process.argv.includes("--apply");

const STATEMENTS = [
  {
    name: "companies core columns",
    sql: `
      alter table if exists public.companies
        add column if not exists name text,
        add column if not exists industry_id uuid,
        add column if not exists category_id uuid,
        add column if not exists lead_source text,
        add column if not exists priority text default 'medium',
        add column if not exists assigned_user_id uuid,
        add column if not exists pipeline_stage_id uuid,
        add column if not exists phone text,
        add column if not exists whatsapp text,
        add column if not exists email text,
        add column if not exists website text,
        add column if not exists address text,
        add column if not exists city text,
        add column if not exists country text,
        add column if not exists success_rating integer,
        add column if not exists lead_temperature text default 'warm',
        add column if not exists estimated_value numeric(14, 2),
        add column if not exists expected_closing_date date,
        add column if not exists notes text,
        add column if not exists created_by uuid,
        add column if not exists updated_by uuid;
    `,
  },
  {
    name: "documents core columns",
    sql: `
      alter table if exists public.documents
        add column if not exists company_id uuid,
        add column if not exists contact_person_id uuid,
        add column if not exists interaction_id uuid,
        add column if not exists followup_id uuid,
        add column if not exists document_type text default 'Other',
        add column if not exists title text,
        add column if not exists description text,
        add column if not exists file_name text,
        add column if not exists file_path text,
        add column if not exists file_url text,
        add column if not exists file_size_mb numeric,
        add column if not exists mime_type text,
        add column if not exists file_extension text,
        add column if not exists status text default 'submitted',
        add column if not exists submitted_to text,
        add column if not exists submitted_at timestamptz,
        add column if not exists expiry_date date,
        add column if not exists remarks text,
        add column if not exists created_by uuid,
        add column if not exists updated_by uuid,
        add column if not exists uploaded_by uuid;
    `,
  },
  {
    name: "documents indexes",
    sql: `
      create index if not exists documents_org_status_created_idx
        on public.documents (organization_id, status, created_at desc);
      create index if not exists documents_org_company_created_idx
        on public.documents (organization_id, company_id, created_at desc);
    `,
  },
  {
    name: "companies indexes",
    sql: `
      create index if not exists companies_pipeline_stage_id_idx
        on public.companies (pipeline_stage_id);
      create index if not exists companies_assigned_user_id_idx
        on public.companies (assigned_user_id);
    `,
  },
];

try {
  if (DRY_RUN) {
    console.log("Mode: dry-run");
    for (const statement of STATEMENTS) {
      console.log(`[pending] ${statement.name}`);
    }
  } else {
    console.log("Mode: apply");
    for (const statement of STATEMENTS) {
      await prisma.$executeRawUnsafe(statement.sql);
      console.log(`[applied] ${statement.name}`);
    }
  }
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
