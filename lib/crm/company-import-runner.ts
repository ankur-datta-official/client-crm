import type { SupabaseClient } from "@supabase/supabase-js";
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
import { checkCompanyLimitForOrganization } from "@/lib/subscription/subscription-queries";

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
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  companies: CompanyImportRow[];
  contacts: ContactImportRow[];
}): Promise<CompanyImportResult> {
  const { supabase, organizationId, userId } = params;
  const errors: string[] = [];
  let companiesImported = 0;
  let contactsImported = 0;

  const [{ data: stageRow, error: stageError }, { data: industryRows, error: industryError }, { data: existingCompanies, error: companiesError }] =
    await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from("industries").select("id, name").eq("organization_id", organizationId).neq("status", "archived"),
      supabase.from("companies").select("id, name").eq("organization_id", organizationId).neq("status", "archived"),
    ]);

  if (stageError || !stageRow?.id) {
    errors.push(`Companies: could not resolve default pipeline stage (${stageError?.message ?? "none"}).`);
    return { companiesImported: 0, contactsImported: 0, errors };
  }

  if (industryError) {
    errors.push(`Companies: failed to load industries (${industryError.message}).`);
    return { companiesImported: 0, contactsImported: 0, errors };
  }

  if (companiesError) {
    errors.push(`Companies: failed to load existing companies (${companiesError.message}).`);
    return { companiesImported: 0, contactsImported: 0, errors };
  }

  const industryByKey = new Map<string, string>();
  for (const row of (industryRows ?? []) as IndustryRow[]) {
    industryByKey.set(normalizeCompanyKey(row.name), row.id);
  }

  const companyNameToId = new Map<string, string>();
  for (const c of existingCompanies ?? []) {
    companyNameToId.set(normalizeCompanyKey(String(c.name)), String(c.id));
  }

  const processedCompanyKeysFromFile = new Set<string>();

  const pipeline_stage_id = stageRow.id;

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

      const limit = await checkCompanyLimitForOrganization(organizationId, 1);
      if (!limit.allowed) {
        errors.push(`${label}: ${limit.message ?? "Company limit reached."}`);
        continue;
      }

      const phones = phonesFromCompanyRow(row);
      const emails = emailsFromCompanyRow(row);
      const industryCell = row.industry?.trim() ?? "";
      let industry_id: string | null = null;
      if (industryCell) {
        const found = industryByKey.get(normalizeCompanyKey(industryCell));
        if (!found) {
          errors.push(`${label}: industry '${industryCell}' was not found.`);
          continue;
        }
        industry_id = found;
      }

      const website = normalizeWebsite(row.website);
      let notes = row.notes?.trim() ?? "";
      if (phones.length > 1) {
        notes = appendNote(notes, `Additional phones: ${phones.slice(1).join(", ")}`);
      }
      if (emails.length > 1) {
        notes = appendNote(notes, `Additional emails: ${emails.slice(1).join(", ")}`);
      }

      const sl = row.sl?.trim();
      const lead_source = sl || null;

      const { data: inserted, error: insertError } = await supabase
        .from("companies")
        .insert({
          organization_id: organizationId,
          name: rawName,
          industry_id,
          pipeline_stage_id,
          status: "active",
          phone: phones[0] ?? null,
          email: emails[0] ?? null,
          website,
          address: row.address?.trim() || null,
          city: row.city?.trim() || null,
          notes: notes || null,
          lead_source,
          assigned_user_id: userId,
          success_rating: 5,
          lead_temperature: temperatureFromRating(5),
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();

      if (insertError || !inserted?.id) {
        errors.push(`${label}: ${insertError?.message ?? "insert failed"}.`);
        continue;
      }

      companyNameToId.set(key, inserted.id);
      companiesImported += 1;

      try {
        await applyScoringEvent({
          organizationId: organizationId,
          userId,
          actionKey: "lead_created",
          companyId: inserted.id,
          sourceRecordId: inserted.id,
          sourceRecordType: "company",
          metadata: {
            company_name: rawName,
            lead_source,
            source: "bulk_import",
          },
          actorUserId: userId,
          addToLeadScore: true,
          idempotencyKey: buildScoreIdempotencyKey(["lead_created", inserted.id, "bulk_import"]),
        });
      } catch {
        /* scoring is best-effort */
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
      const cKey = normalizeCompanyKey(companyNameRaw);
      if (!companyNameRaw) {
        errors.push(`${label}: company_name is required.`);
        continue;
      }

      const companyId = companyNameToId.get(cKey);
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
        companyKey: cKey,
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
      errors.push(`Row ${i + 2} Contacts: ${e instanceof Error ? e.message : String(e)}.`);
    }
  }

  const byCompany = new Map<string, ContactWork[]>();
  for (const c of contactQueue) {
    const list = byCompany.get(c.companyId) ?? [];
    list.push(c);
    byCompany.set(c.companyId, list);
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

  for (const c of nonPrimaryFirst) {
    const label = `Row ${c.excelRow} Contacts`;
    try {
      const { error } = await supabase.from("contact_persons").insert({
        organization_id: organizationId,
        company_id: c.companyId,
        name: c.name,
        designation: c.designation,
        mobile: c.mobile,
        whatsapp: c.whatsapp,
        email: c.email,
        remarks: c.remarks,
        is_primary: c.is_primary,
        status: "active",
        created_by: userId,
        updated_by: userId,
      });

      if (error) {
        errors.push(`${label}: ${error.message}.`);
        continue;
      }
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
