import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/session";
import { buildSampleImportWorkbook, parseCompaniesCsv, parseImportWorkbook } from "@/lib/crm/company-import-shared";
import { runCompanyContactImport } from "@/lib/crm/company-import-runner";
import { logServerError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { checkFileSizeLimit, hasPlanFeatureForOrganization } from "@/lib/subscription/subscription-queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canCreate = await hasPermission("companies.create");
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.organization_id || !profile.is_active) {
      return NextResponse.json({ error: "Workspace not available." }, { status: 400 });
    }

    const organizationId = profile.organization_id;

    const csvImportEnabled = await hasPlanFeatureForOrganization(organizationId, "csv_import");
    if (!csvImportEnabled) {
      return NextResponse.json(
        { error: "Bulk import is not available on your current plan." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file field." }, { status: 400 });
    }

    const sizeCheck = await checkFileSizeLimit(file.size);
    if (!sizeCheck.allowed) {
      return NextResponse.json({ error: sizeCheck.message ?? "File too large." }, { status: 400 });
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
      supabase,
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canCreate = await hasPermission("companies.create");
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id || !profile.is_active) {
      return NextResponse.json({ error: "Workspace not available." }, { status: 400 });
    }

    const csvImportEnabled = await hasPlanFeatureForOrganization(profile.organization_id, "csv_import");
    if (!csvImportEnabled) {
      return NextResponse.json({ error: "Bulk import is not available on your current plan." }, { status: 403 });
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
