import * as XLSX from "xlsx";

/** Legacy companies-sheet headers. */
export const COMPANY_IMPORT_HEADERS = [
  "industry",
  "sl",
  "company_name",
  "address",
  "city",
  "primary_phone",
  "phone_2",
  "phone_3",
  "primary_email",
  "email_2",
  "website",
  "notes",
  "lead_source",
] as const;

/** Legacy contacts-sheet headers. */
export const CONTACT_IMPORT_HEADERS = [
  "company_name",
  "contact_name",
  "designation",
  "department",
  "primary_phone",
  "phone_2",
  "primary_email",
  "email_2",
  "is_primary_contact",
] as const;

export const LEGACY_COMPANY_IMPORT_HEADERS = COMPANY_IMPORT_HEADERS.slice(0, 12);

export const LEGACY_CONTACT_IMPORT_HEADERS = [
  "company_name",
  "contact_name",
  "designation",
  "primary_phone",
  "phone_2",
  "primary_email",
  "email_2",
  "is_primary_contact",
] as const;

export const SINGLE_SHEET_IMPORT_HEADERS = [
  "SL",
  "Industry",
  "Company Name",
  "City/Zilla",
  "Address",
  "Primary Phone",
  "Phone 2",
  "Phone 3",
  "Primary Email",
  "Email 2",
  "Website",
  "Note",
  "Contact Person 1 Name",
  "Designation",
  "Department",
  "Phone 1",
  "Phone 2",
  "Email 1",
  "Email 2",
  "Contact Person 2 Name",
  "Designation",
  "Department",
  "Phone 1",
  "Phone 2",
  "Email 1",
  "Email 2",
  "Lead Source",
] as const;

export type ImportRowMeta = {
  __rowNum?: number;
};

export type CompanyImportRow = ImportRowMeta & Record<(typeof COMPANY_IMPORT_HEADERS)[number], string>;
export type ContactImportRow = ImportRowMeta & Record<(typeof CONTACT_IMPORT_HEADERS)[number], string>;

export function normalizeCompanyKey(name: string) {
  return name.trim().toLowerCase();
}

/** Strip spaces, dashes, parentheses; keep leading + and digits. */
export function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const core = digits.replace(/\D/g, "");
  if (!core) return null;
  return hasPlus ? `+${core}` : core;
}

export function normalizeEmail(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

export function parsePrimaryContactFlag(raw: unknown): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1";
}

export function normalizeWebsite(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[\w.-]+/i.test(s)) return `https://${s}`;
  return null;
}

function escapeForIlikeExact(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Case-insensitive exact match filter for PostgREST ilike without wildcards. */
export function companyNameIlikeFilter(name: string) {
  return escapeForIlikeExact(name.trim());
}

function rowHasAnyData(values: readonly unknown[]) {
  return values.some((value) => String(value ?? "").trim().length > 0);
}

function pickRowCell(line: unknown[], index: number) {
  return String(line[index] ?? "").trim();
}

function buildLegacyCompanyRow(line: unknown[], rowNum: number): CompanyImportRow {
  const obj = {
    __rowNum: rowNum,
  } as CompanyImportRow;

  for (let c = 0; c < COMPANY_IMPORT_HEADERS.length; c++) {
    obj[COMPANY_IMPORT_HEADERS[c]!] = pickRowCell(line, c);
  }

  if (!obj.lead_source) {
    obj.lead_source = "";
  }

  return obj;
}

function buildLegacyContactRow(line: unknown[], rowNum: number): ContactImportRow {
  return {
    __rowNum: rowNum,
    company_name: pickRowCell(line, 0),
    contact_name: pickRowCell(line, 1),
    designation: pickRowCell(line, 2),
    department: "",
    primary_phone: pickRowCell(line, 3),
    phone_2: pickRowCell(line, 4),
    primary_email: pickRowCell(line, 5),
    email_2: pickRowCell(line, 6),
    is_primary_contact: pickRowCell(line, 7),
  };
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isLegacyCompaniesHeader(row: unknown[]) {
  return LEGACY_COMPANY_IMPORT_HEADERS.every((header, index) => normalizeHeader(row[index]) === header);
}

function isLegacyContactsHeader(row: unknown[]) {
  return LEGACY_CONTACT_IMPORT_HEADERS.every((header, index) => normalizeHeader(row[index]) === header);
}

function isSingleSheetHeader(row: unknown[]) {
  return SINGLE_SHEET_IMPORT_HEADERS.every((header, index) => String(row[index] ?? "").trim() === header);
}

export function sheetToKeyedRows(
  ws: XLSX.WorkSheet,
  expectedHeaders: readonly string[],
  sheetLabel: string,
): { rows: Record<string, string>[]; errors: string[] } {
  const errors: string[] = [];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (matrix.length === 0) {
    errors.push(`${sheetLabel}: sheet is empty.`);
    return { rows: [], errors };
  }

  const headerCells = (matrix[0] ?? []).map((cell) => String(cell ?? "").trim());
  const normalizedHeader = headerCells.map((h) => h.toLowerCase());
  if (normalizedHeader.length < expectedHeaders.length) {
    errors.push(`${sheetLabel}: not enough columns in row 1.`);
  }
  for (let i = 0; i < expectedHeaders.length; i++) {
    const want = expectedHeaders[i]!.toLowerCase();
    if (normalizedHeader[i] !== want) {
      errors.push(
        `${sheetLabel}: row 1 headers must match the template (column ${i + 1}: expected "${expectedHeaders[i]}", got "${headerCells[i] ?? ""}").`,
      );
    }
  }

  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const obj: Record<string, string> = {};
    for (let c = 0; c < expectedHeaders.length; c++) {
      obj[expectedHeaders[c]!] = String(line[c] ?? "").trim();
    }
    rows.push(obj);
  }

  return { rows, errors: [] };
}

export function parseCompaniesCsv(text: string): { rows: CompanyImportRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    errors.push("CSV: need a header row and at least one data row.");
    return { rows: [], errors };
  }

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((cell) => cell.trim().replace(/^"|"$/g, ""));
  };

  const headerCells = parseLine(lines[0]!);
  const normalizedHeader = headerCells.map((h) => h.toLowerCase());
  const csvHeaders = LEGACY_COMPANY_IMPORT_HEADERS;
  if (normalizedHeader.length < csvHeaders.length) {
    errors.push("CSV: not enough columns in row 1.");
  }
  for (let i = 0; i < csvHeaders.length; i++) {
    const want = csvHeaders[i]!.toLowerCase();
    if (normalizedHeader[i] !== want) {
      errors.push(
        `CSV: row 1 headers must match the template (column ${i + 1}: expected "${csvHeaders[i]}", got "${headerCells[i] ?? ""}").`,
      );
    }
  }
  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const rows: CompanyImportRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = parseLine(lines[r]!);
    rows.push({
      __rowNum: r + 1,
      industry: String(cells[0] ?? "").trim(),
      sl: String(cells[1] ?? "").trim(),
      company_name: String(cells[2] ?? "").trim(),
      address: String(cells[3] ?? "").trim(),
      city: String(cells[4] ?? "").trim(),
      primary_phone: String(cells[5] ?? "").trim(),
      phone_2: String(cells[6] ?? "").trim(),
      phone_3: String(cells[7] ?? "").trim(),
      primary_email: String(cells[8] ?? "").trim(),
      email_2: String(cells[9] ?? "").trim(),
      website: String(cells[10] ?? "").trim(),
      notes: String(cells[11] ?? "").trim(),
      lead_source: "",
    });
  }

  return { rows, errors: [] };
}

function parseSingleSheetWorkbook(wb: XLSX.WorkBook): ParsedImportSheets {
  const errors: string[] = [];
  const sheetName = wb.SheetNames[0] ?? "";
  const ws = wb.Sheets[sheetName];

  if (!ws) {
    return { companies: [], contacts: [], errors: ["Workbook: missing import sheet."] };
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  const headerRow = matrix[0] ?? [];

  if (!isSingleSheetHeader(headerRow)) {
    for (let i = 0; i < SINGLE_SHEET_IMPORT_HEADERS.length; i++) {
      const got = pickRowCell(headerRow, i);
      const want = SINGLE_SHEET_IMPORT_HEADERS[i]!;
      if (got !== want) {
        errors.push(`Workbook: row 1 headers must match the template (column ${i + 1}: expected "${want}", got "${got}").`);
      }
    }
  }

  if (errors.length > 0) {
    return { companies: [], contacts: [], errors };
  }

  const companies: CompanyImportRow[] = [];
  const contacts: ContactImportRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const rowNum = r + 1;

    if (!rowHasAnyData(line.slice(0, SINGLE_SHEET_IMPORT_HEADERS.length))) {
      continue;
    }

    companies.push({
      __rowNum: rowNum,
      sl: pickRowCell(line, 0),
      industry: pickRowCell(line, 1),
      company_name: pickRowCell(line, 2),
      city: pickRowCell(line, 3),
      address: pickRowCell(line, 4),
      primary_phone: pickRowCell(line, 5),
      phone_2: pickRowCell(line, 6),
      phone_3: pickRowCell(line, 7),
      primary_email: pickRowCell(line, 8),
      email_2: pickRowCell(line, 9),
      website: pickRowCell(line, 10),
      notes: pickRowCell(line, 11),
      lead_source: pickRowCell(line, 26),
    });

    contacts.push({
      __rowNum: rowNum,
      company_name: pickRowCell(line, 2),
      contact_name: pickRowCell(line, 12),
      designation: pickRowCell(line, 13),
      department: pickRowCell(line, 14),
      primary_phone: pickRowCell(line, 15),
      phone_2: pickRowCell(line, 16),
      primary_email: pickRowCell(line, 17),
      email_2: pickRowCell(line, 18),
      is_primary_contact: pickRowCell(line, 12) ? "YES" : "",
    });

    contacts.push({
      __rowNum: rowNum,
      company_name: pickRowCell(line, 2),
      contact_name: pickRowCell(line, 19),
      designation: pickRowCell(line, 20),
      department: pickRowCell(line, 21),
      primary_phone: pickRowCell(line, 22),
      phone_2: pickRowCell(line, 23),
      primary_email: pickRowCell(line, 24),
      email_2: pickRowCell(line, 25),
      is_primary_contact: "",
    });
  }

  return { companies, contacts, errors: [] };
}

function parseLegacyWorkbook(wb: XLSX.WorkBook): ParsedImportSheets {
  const errors: string[] = [];

  const companiesSheet = wb.Sheets["Companies"] ?? wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!companiesSheet) {
    errors.push('Workbook: missing "Companies" sheet.');
    return { companies: [], contacts: [], errors };
  }

  const companiesMatrix = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(companiesSheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  const companyHeaderRow = companiesMatrix[0] ?? [];
  if (!isLegacyCompaniesHeader(companyHeaderRow)) {
    const headerCells = companyHeaderRow.map((cell) => String(cell ?? "").trim());
    const normalizedHeader = headerCells.map((h) => h.toLowerCase());
    if (normalizedHeader.length < LEGACY_COMPANY_IMPORT_HEADERS.length) {
      errors.push("Companies: not enough columns in row 1.");
    }
    for (let i = 0; i < LEGACY_COMPANY_IMPORT_HEADERS.length; i++) {
      const want = LEGACY_COMPANY_IMPORT_HEADERS[i]!.toLowerCase();
      if (normalizedHeader[i] !== want) {
        errors.push(
          `Companies: row 1 headers must match the template (column ${i + 1}: expected "${LEGACY_COMPANY_IMPORT_HEADERS[i]}", got "${headerCells[i] ?? ""}").`,
        );
      }
    }
  }

  const companies: CompanyImportRow[] = [];
  for (let r = 1; r < companiesMatrix.length; r++) {
    const line = companiesMatrix[r] ?? [];
    if (!rowHasAnyData(line.slice(0, LEGACY_COMPANY_IMPORT_HEADERS.length))) {
      continue;
    }
    companies.push(buildLegacyCompanyRow(line, r + 1));
  }

  const contactsSheet = wb.Sheets["Contacts"];
  const contacts: ContactImportRow[] = [];
  if (contactsSheet) {
    const contactsMatrix = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(contactsSheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];

    const contactHeaderRow = contactsMatrix[0] ?? [];
    if (!isLegacyContactsHeader(contactHeaderRow)) {
      const headerCells = contactHeaderRow.map((cell) => String(cell ?? "").trim());
      const normalizedHeader = headerCells.map((h) => h.toLowerCase());
      if (normalizedHeader.length < LEGACY_CONTACT_IMPORT_HEADERS.length) {
        errors.push("Contacts: not enough columns in row 1.");
      }
      for (let i = 0; i < LEGACY_CONTACT_IMPORT_HEADERS.length; i++) {
        const want = LEGACY_CONTACT_IMPORT_HEADERS[i]!.toLowerCase();
        if (normalizedHeader[i] !== want) {
          errors.push(
            `Contacts: row 1 headers must match the template (column ${i + 1}: expected "${LEGACY_CONTACT_IMPORT_HEADERS[i]}", got "${headerCells[i] ?? ""}").`,
          );
        }
      }
    }

    for (let r = 1; r < contactsMatrix.length; r++) {
      const line = contactsMatrix[r] ?? [];
      if (!rowHasAnyData(line.slice(0, LEGACY_CONTACT_IMPORT_HEADERS.length))) {
        continue;
      }
      contacts.push(buildLegacyContactRow(line, r + 1));
    }
  }

  if (errors.length > 0) {
    return { companies: [], contacts: [], errors };
  }

  return { companies, contacts, errors: [] };
}

export type ParsedImportSheets = {
  companies: CompanyImportRow[];
  contacts: ContactImportRow[];
  errors: string[];
};

export function parseImportWorkbook(buffer: ArrayBuffer): ParsedImportSheets {
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheetName = wb.SheetNames[0] ?? "";
  const firstSheet = wb.Sheets[firstSheetName];

  if (firstSheet) {
    const matrix = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(firstSheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];

    if (isSingleSheetHeader(matrix[0] ?? [])) {
      return parseSingleSheetWorkbook(wb);
    }
  }

  return parseLegacyWorkbook(wb);
}

export function buildSampleImportWorkbook(): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([
    [...SINGLE_SHEET_IMPORT_HEADERS],
    [
      "1",
      "Manufacturing",
      "Acme Manufacturing Ltd",
      "Dubai",
      "12 Industrial Road",
      "+971 50 111 2222",
      "04-1234567",
      "",
      "info@acme.example",
      "sales@acme.example",
      "https://acme.example",
      "Key account; follow up weekly.",
      "Sara Al-Mansoori",
      "Procurement Manager",
      "Procurement",
      "+971501112222",
      "",
      "sara@acme.example",
      "",
      "Omar Nayeem",
      "Finance Lead",
      "Finance",
      "+971501112333",
      "",
      "omar@acme.example",
      "",
      "Website",
    ],
    [
      "2",
      "Retail",
      "Northwind Trading",
      "Abu Dhabi",
      "Suite 3",
      "0509998888",
      "",
      "",
      "hello@northwind.example",
      "",
      "northwind.example",
      "",
      "Omar Khan",
      "Owner",
      "Management",
      "0509998888",
      "",
      "hello@northwind.example",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Referral",
    ],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Companies Import");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
