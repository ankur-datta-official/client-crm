import * as XLSX from "xlsx";

/** Row 1 headers (canonical keys after trim). */
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
] as const;

export const CONTACT_IMPORT_HEADERS = [
  "company_name",
  "contact_name",
  "designation",
  "primary_phone",
  "phone_2",
  "primary_email",
  "email_2",
  "is_primary_contact",
] as const;

export type CompanyImportRow = Record<(typeof COMPANY_IMPORT_HEADERS)[number], string>;
export type ContactImportRow = Record<(typeof CONTACT_IMPORT_HEADERS)[number], string>;

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
  if (normalizedHeader.length < COMPANY_IMPORT_HEADERS.length) {
    errors.push("CSV: not enough columns in row 1.");
  }
  for (let i = 0; i < COMPANY_IMPORT_HEADERS.length; i++) {
    const want = COMPANY_IMPORT_HEADERS[i]!.toLowerCase();
    if (normalizedHeader[i] !== want) {
      errors.push(
        `CSV: row 1 headers must match the template (column ${i + 1}: expected "${COMPANY_IMPORT_HEADERS[i]}", got "${headerCells[i] ?? ""}").`,
      );
    }
  }
  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const rows: CompanyImportRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = parseLine(lines[r]!);
    const obj = {} as CompanyImportRow;
    for (let c = 0; c < COMPANY_IMPORT_HEADERS.length; c++) {
      obj[COMPANY_IMPORT_HEADERS[c]!] = String(cells[c] ?? "").trim();
    }
    rows.push(obj);
  }

  return { rows, errors: [] };
}

export type ParsedImportSheets = {
  companies: CompanyImportRow[];
  contacts: ContactImportRow[];
  errors: string[];
};

export function parseImportWorkbook(buffer: ArrayBuffer): ParsedImportSheets {
  const errors: string[] = [];
  const wb = XLSX.read(buffer, { type: "array" });

  const companiesSheet = wb.Sheets["Companies"] ?? wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!companiesSheet) {
    errors.push('Workbook: missing "Companies" sheet.');
    return { companies: [], contacts: [], errors };
  }

  const { rows: companyRows, errors: cErr } = sheetToKeyedRows(
    companiesSheet,
    COMPANY_IMPORT_HEADERS,
    "Companies",
  );
  errors.push(...cErr);

  const contactsSheet = wb.Sheets["Contacts"];
  let contactRows: ContactImportRow[] = [];
  if (contactsSheet) {
    const { rows, errors: ctErr } = sheetToKeyedRows(contactsSheet, CONTACT_IMPORT_HEADERS, "Contacts");
    contactRows = rows as ContactImportRow[];
    errors.push(...ctErr);
  }

  return { companies: companyRows as CompanyImportRow[], contacts: contactRows, errors };
}

export function buildSampleImportWorkbook(): ArrayBuffer {
  const companiesWs = XLSX.utils.aoa_to_sheet([
    [...COMPANY_IMPORT_HEADERS],
    [
      "Manufacturing",
      "WEB",
      "Acme Manufacturing Ltd",
      "12 Industrial Road",
      "Dubai",
      "+971 50 111 2222",
      "04-1234567",
      "",
      "info@acme.example",
      "sales@acme.example",
      "https://acme.example",
      "Key account; follow up weekly.",
    ],
    [
      "Retail",
      "REF-9",
      "Northwind Trading",
      "Suite 3",
      "Abu Dhabi",
      "0509998888",
      "",
      "",
      "hello@northwind.example",
      "",
      "northwind.example",
      "",
    ],
  ]);

  const contactsWs = XLSX.utils.aoa_to_sheet([
    [...CONTACT_IMPORT_HEADERS],
    [
      "Acme Manufacturing Ltd",
      "Sara Al-Mansoori",
      "Procurement Manager",
      "+971501112222",
      "",
      "sara@acme.example",
      "",
      "YES",
    ],
    [
      "Northwind Trading",
      "Omar Khan",
      "Owner",
      "0509998888",
      "",
      "hello@northwind.example",
      "",
      "",
    ],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, companiesWs, "Companies");
  XLSX.utils.book_append_sheet(wb, contactsWs, "Contacts");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
