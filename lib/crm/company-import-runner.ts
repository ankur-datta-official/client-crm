import { prisma } from "@/lib/prisma";
import { temperatureFromRating } from "@/lib/crm/schemas";
import {
  type CompanyImportRow,
  type ContactImportRow,
  normalizeCompanyKey,
  normalizeEmail,
  normalizePhone,
  normalizeWebsite,
  parsePrimaryContactFlag,
} from "@/lib/crm/company-import-shared";
import { applyScoringEvent, buildScoreIdempotencyKey } from "@/lib/scoring/service";

export type CompanyImportResult = {
  companiesImported: number;
  contactsImported: number;
  errors: string[];
};

type IndustryRow = { id: string; name: string };

function phonesFromCompanyRow(row: CompanyImportRow): string[] {
  return [row.primary_phone, row.phone_2, row.phone_3]
    .map((p) => normalizePhone(p))
    .filter((p): p is string => Boolean(p));
}

function emailsFromCompanyRow(row: CompanyImportRow): string[] {
  return [row.primary_email, row.email_2]
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => Boolean(e));
}

function phonesFromContactRow(row: ContactImportRow): string[] {
  return [row.primary_phone, row.phone_2]
    .map((p) => normalizePhone(p))
    .filter((p): p is string => Boolean(p));
}

function emailsFromContactRow(row: ContactImportRow): string[] {
  return [row.primary_email, row.email_2]
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => Boolean(e));
}

function appendNote(base: string | null | undefined, extra: string) {
  const b = (base ?? "").trim();
  if (!b) return extra;
  return `${b}\n\n${extra}`;
}

export async function runCompanyContactImport(params: {
  organizationId: string;
  userId: string;
  companies: CompanyImportRow[];
  contacts: ContactImportRow[];
}): Promise<CompanyImportResult> {
  const { organizationId, userId } = params;
  const errors: string[] = [];
  let companiesImported = 0;
  let contactsImported = 0;

  const [stageRows, industryRows, existingCompanies] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>`
      select id
      from public.pipeline_stages
      where organization_id = ${organizationId}::uuid
        and is_active = true
      order by position asc
      limit 1
    `,
    prisma.$queryRaw<IndustryRow[]>`
      select id, name
      from public.industries
      where organization_id = ${organizationId}::uuid
        and status <> 'archived'
    `,
    prisma.$queryRaw<Array<{ id: string; name: string }>>`
      select id, name
      from public.companies
      where organization_id = ${organizationId}::uuid
        and status <> 'archived'
    `,
  ]);

  const stageRow = stageRows[0] ?? null;
  if (!stageRow?.id) {
    errors.push("Companies: could not resolve default pipeline stage.");
    return { companiesImported: 0, contactsImported: 0, errors };
  }

  const industryByKey = new Map<string, string>();
  for (const row of industryRows) {
    industryByKey.set(normalizeCompanyKey(row.name), row.id);
  }

  const companyNameToId = new Map<string, string>();
  for (const company of existingCompanies) {
    companyNameToId.set(normalizeCompanyKey(company.name), company.id);
  }

  const processedCompanyKeysFromFile = new Set<string>();
  const pipelineStageId = stageRow.id;

  for (let i = 0; i < params.companies.length; i++) {
    const excelRow = i + 2;
    const row = params.companies[i]!;
    const label = `Row ${excelRow} Companies`;

    try {
      const rawName = row.company_name?.trim() ?? "";
      if (!rawName) continue;

      const key = normalizeCompanyKey(rawName);
      if (processedCompanyKeysFromFile.has(key)) {
        errors.push(`${label}: duplicate company_name '${rawName}' in file.`);
        continue;
      }
      processedCompanyKeysFromFile.add(key);

      if (rawName.length < 2) {
        errors.push(`${label}: company_name must be at least 2 characters.`);
        continue;
      }

      if (companyNameToId.has(key)) {
        errors.push(`${label}: company '${rawName}' already exists in this workspace.`);
        continue;
      }

      const phones = phonesFromCompanyRow(row);
      const emails = emailsFromCompanyRow(row);
      const industryCell = row.industry?.trim() ?? "";
      let industryId: string | null = null;

      if (industryCell) {
        const found = industryByKey.get(normalizeCompanyKey(industryCell));
        if (!found) {
          errors.push(`${label}: industry '${industryCell}' was not found.`);
          continue;
        }
        industryId = found;
      }

      const website = normalizeWebsite(row.website);
      let notes = row.notes?.trim() ?? "";
      if (phones.length > 1) {
        notes = appendNote(notes, `Additional phones: ${phones.slice(1).join(", ")}`);
      }
      if (emails.length > 1) {
        notes = appendNote(notes, `Additional emails: ${emails.slice(1).join(", ")}`);
      }

      const leadSource = row.sl?.trim() || null;
      const insertedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        insert into public.companies (
          organization_id,
          name,
          industry_id,
          pipeline_stage_id,
          status,
          phone,
          email,
          website,
          address,
          city,
          notes,
          lead_source,
          assigned_user_id,
          success_rating,
          lead_temperature,
          created_by,
          updated_by
        )
        values (
          ${organizationId}::uuid,
          ${rawName},
          ${industryId}::uuid,
          ${pipelineStageId}::uuid,
          'active',
          ${phones[0] ?? null},
          ${emails[0] ?? null},
          ${website},
          ${row.address?.trim() || null},
          ${row.city?.trim() || null},
          ${notes || null},
          ${leadSource},
          ${userId}::uuid,
          5,
          ${temperatureFromRating(5)},
          ${userId}::uuid,
          ${userId}::uuid
        )
        returning id
      `;

      const insertedId = insertedRows[0]?.id ?? null;
      if (!insertedId) {
        errors.push(`${label}: insert failed.`);
        continue;
      }

      companyNameToId.set(key, insertedId);
      companiesImported += 1;

      try {
        await applyScoringEvent({
          organizationId,
          userId,
          actionKey: "lead_created",
          companyId: insertedId,
          sourceRecordId: insertedId,
          sourceRecordType: "company",
          metadata: {
            company_name: rawName,
            lead_source: leadSource,
            source: "bulk_import",
          },
          actorUserId: userId,
          addToLeadScore: true,
          idempotencyKey: buildScoreIdempotencyKey(["lead_created", insertedId, "bulk_import"]),
        });
      } catch {
        // scoring remains best-effort
      }
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}.`);
    }
  }

  type ContactWork = {
    excelRow: number;
    companyKey: string;
    companyId: string;
    name: string;
    designation: string | null;
    mobile: string | null;
    whatsapp: string | null;
    email: string | null;
    remarks: string | null;
    is_primary: boolean;
  };

  const contactQueue: ContactWork[] = [];

  for (let i = 0; i < params.contacts.length; i++) {
    const excelRow = i + 2;
    const row = params.contacts[i]!;
    const label = `Row ${excelRow} Contacts`;

    try {
      const contactName = row.contact_name?.trim() ?? "";
      if (!contactName) continue;

      if (contactName.length < 2) {
        errors.push(`${label}: contact_name must be at least 2 characters.`);
        continue;
      }

      const companyNameRaw = row.company_name?.trim() ?? "";
      const companyKey = normalizeCompanyKey(companyNameRaw);
      if (!companyNameRaw) {
        errors.push(`${label}: company_name is required.`);
        continue;
      }

      const companyId = companyNameToId.get(companyKey);
      if (!companyId) {
        errors.push(`${label}: company '${companyNameRaw}' not found.`);
        continue;
      }

      const phones = phonesFromContactRow(row);
      const emails = emailsFromContactRow(row);
      let remarks: string | null = null;
      if (phones.length > 1) {
        remarks = appendNote(null, `Alt phone: ${phones[1]}`);
      }
      if (emails.length > 1) {
        remarks = appendNote(remarks, `Alt email: ${emails[1]}`);
      }

      contactQueue.push({
        excelRow,
        companyKey,
        companyId,
        name: contactName,
        designation: row.designation?.trim() || null,
        mobile: phones[0] ?? null,
        whatsapp: phones[1] ?? null,
        email: emails[0] ?? null,
        remarks,
        is_primary: parsePrimaryContactFlag(row.is_primary_contact),
      });
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}.`);
    }
  }

  const byCompany = new Map<string, ContactWork[]>();
  for (const contact of contactQueue) {
    const list = byCompany.get(contact.companyId) ?? [];
    list.push(contact);
    byCompany.set(contact.companyId, list);
  }

  for (const [, list] of byCompany) {
    list.sort((a, b) => a.excelRow - b.excelRow);
    if (!list.some((x) => x.is_primary)) {
      list[0]!.is_primary = true;
    } else {
      let seen = false;
      for (const item of list) {
        if (item.is_primary) {
          if (seen) item.is_primary = false;
          seen = true;
        }
      }
    }
  }

  const nonPrimaryFirst = [...contactQueue].sort((a, b) => {
    if (a.companyId !== b.companyId) return a.companyId.localeCompare(b.companyId);
    if (a.is_primary === b.is_primary) return a.excelRow - b.excelRow;
    return a.is_primary ? 1 : -1;
  });

  for (const contact of nonPrimaryFirst) {
    const label = `Row ${contact.excelRow} Contacts`;

    try {
      await prisma.$executeRaw`
        insert into public.contact_persons (
          organization_id,
          company_id,
          name,
          designation,
          mobile,
          whatsapp,
          email,
          remarks,
          is_primary,
          status,
          created_by,
          updated_by
        )
        values (
          ${organizationId}::uuid,
          ${contact.companyId}::uuid,
          ${contact.name},
          ${contact.designation},
          ${contact.mobile},
          ${contact.whatsapp},
          ${contact.email},
          ${contact.remarks},
          ${contact.is_primary},
          'active',
          ${userId}::uuid,
          ${userId}::uuid
        )
      `;

      contactsImported += 1;
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}.`);
    }
  }

  return {
    companiesImported,
    contactsImported,
    errors,
  };
}
