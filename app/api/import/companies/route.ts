import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentProfile, getCurrentUser, hasPermission } from "@/lib/auth/session";
import { buildSampleImportWorkbook, parseCompaniesCsv, parseImportWorkbook } from "@/lib/crm/company-import-shared";
import { runCompanyContactImport } from "@/lib/crm/company-import-runner";
import { logServerError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canCreate = await hasPermission("companies.create");
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await getCurrentProfile();

    if (!profile?.organization_id || !profile.is_active || !profile.workspace_is_active) {
      return NextResponse.json({ error: "Workspace not available." }, { status: 400 });
    }

    const organizationId = profile.organization_id;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file field." }, { status: 400 });
    }

    const name = "name" in file && typeof file.name === "string" ? file.name : "upload";
    const ext = name.split(".").pop()?.toLowerCase() ?? "";

    let companies: import("@/lib/crm/company-import-shared").CompanyImportRow[] = [];
    let contacts: import("@/lib/crm/company-import-shared").ContactImportRow[] = [];
    const parseErrors: string[] = [];

    if (ext === "csv") {
      const text = await file.text();
      const parsed = parseCompaniesCsv(text);
      parseErrors.push(...parsed.errors);
      companies = parsed.rows;
      contacts = [];
    } else if (ext === "xlsx" || ext === "xls") {
      const buffer = await file.arrayBuffer();
      const parsed = parseImportWorkbook(buffer);
      parseErrors.push(...parsed.errors);
      companies = parsed.companies;
      contacts = parsed.contacts;
    } else {
      return NextResponse.json({ error: "Upload a .xlsx, .xls, or .csv file." }, { status: 400 });
    }

    if (parseErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          companiesImported: 0,
          contactsImported: 0,
          errors: parseErrors,
        },
        { status: 400 },
      );
    }

    const result = await runCompanyContactImport({
      organizationId,
      userId: user.id,
      companies,
      contacts,
    });

    revalidatePath("/companies");
    revalidatePath("/contacts");

    return NextResponse.json({
      success: true,
      companiesImported: result.companiesImported,
      contactsImported: result.contactsImported,
      errors: result.errors,
    });
  } catch (error) {
    logServerError("api.import.companies", error);
    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canCreate = await hasPermission("companies.create");
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await getCurrentProfile();

    if (!profile?.organization_id || !profile.is_active || !profile.workspace_is_active) {
      return NextResponse.json({ error: "Workspace not available." }, { status: 400 });
    }

    const buf = buildSampleImportWorkbook();
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="crm-import-template.xlsx"',
      },
    });
  } catch (error) {
    logServerError("api.import.companies.template", error);
    return NextResponse.json({ error: "Unable to build template." }, { status: 500 });
  }
}
