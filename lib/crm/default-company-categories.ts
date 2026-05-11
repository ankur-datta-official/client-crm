import { Prisma } from "@prisma/client";

export const DEFAULT_COMPANY_CATEGORIES = [
  {
    name: "A+ High Value",
    code: "A_PLUS",
    description: "Top priority accounts with strong revenue or strategic impact.",
    priorityLevel: 1,
  },
  {
    name: "A High Potential",
    code: "A_HIGH",
    description: "Highly promising companies that deserve close follow-up.",
    priorityLevel: 2,
  },
  {
    name: "B Warm Leads",
    code: "B_WARM",
    description: "Qualified companies with active interest and medium urgency.",
    priorityLevel: 3,
  },
  {
    name: "C Nurture",
    code: "C_NURTURE",
    description: "Early-stage or slower-moving companies that need regular nurturing.",
    priorityLevel: 4,
  },
  {
    name: "D Low Priority",
    code: "D_LOW",
    description: "Low-priority accounts with limited current opportunity.",
    priorityLevel: 5,
  },
] as const;

type CategorySeedRow = {
  id: string;
  code: string;
  status: string;
};

type SqlExecutor = {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<number>;
};

export async function ensureDefaultCompanyCategories(params: {
  db: SqlExecutor;
  organizationId: string;
  userId: string;
}) {
  const existingRows = await params.db.$queryRaw<CategorySeedRow[]>(Prisma.sql`
    select id::text as id, code, status
    from public.company_categories
    where organization_id = ${params.organizationId}::uuid
  `);

  const existingByCode = new Map(existingRows.map((row) => [row.code.trim().toUpperCase(), row]));

  for (const category of DEFAULT_COMPANY_CATEGORIES) {
    const existing = existingByCode.get(category.code);

    if (existing) {
      if (existing.status === "archived") {
        await params.db.$executeRaw(Prisma.sql`
          update public.company_categories
          set
            status = 'active',
            name = ${category.name},
            description = ${category.description},
            priority_level = ${category.priorityLevel},
            updated_by = null,
            updated_at = now()
          where id = ${existing.id}::uuid
        `);
      }

      continue;
    }

    await params.db.$executeRaw(Prisma.sql`
      insert into public.company_categories (
        organization_id,
        name,
        code,
        description,
        priority_level,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      values (
        ${params.organizationId}::uuid,
        ${category.name},
        ${category.code},
        ${category.description},
        ${category.priorityLevel},
        'active',
        null,
        null,
        now(),
        now()
      )
    `);
  }
}
