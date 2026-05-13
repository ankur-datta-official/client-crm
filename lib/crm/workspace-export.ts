"use server";

import "server-only";

import JSZip from "jszip";
import * as XLSX from "xlsx";
import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCompanies, getContacts, getInteractions } from "@/lib/crm/queries";
import { getFollowups } from "@/lib/crm/followup-queries";
import { getDocuments } from "@/lib/crm/document-queries";
import { getHelpRequests } from "@/lib/crm/help-request-queries";
import { isLocalStoredFilePath, readPrivateUpload, sanitizeStoredFileName } from "@/lib/storage/local";
import { slugify } from "@/lib/crm/utils";

type ExportMode = "xlsx" | "zip";

type ExportOptions = {
  includeFiles: boolean;
};

type WorkspaceExportResult = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
};

type ExportHelpRequestCommentRow = {
  id: string;
  help_request_id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  help_request_title: string | null;
};

type SummaryCount = {
  sheet: string;
  rows: number;
};

function formatTimestampForFile(value: Date) {
  return value.toISOString().replace(/[:.]/g, "-");
}

function getLabeledValues(values: string[] | null | undefined, primaryLabel: string, baseLabel: string) {
  const normalized = (values ?? []).filter((value) => value.trim().length > 0);
  const count = Math.max(1, normalized.length);

  return Array.from({ length: count }, (_, index) => ({
    label: index === 0 ? primaryLabel : `${baseLabel} ${index + 1}`,
    value: normalized[index] ?? "",
  }));
}

function buildSheetFromRows(rows: Array<Record<string, unknown>>, headers: string[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");

  const widths: Array<{ wch: number }> = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    let maxWidth = 12;
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cell = worksheet[XLSX.utils.encode_cell({ c: col, r: row })];
      const cellValue = cell?.v == null ? "" : String(cell.v);
      maxWidth = Math.min(40, Math.max(maxWidth, cellValue.length + 2));
    }
    widths.push({ wch: maxWidth });
  }
  worksheet["!cols"] = widths;

  return worksheet;
}

function buildSummarySheet(input: {
  workspaceName: string;
  exportedBy: string;
  exportedAt: string;
  mode: ExportMode;
  includeFiles: boolean;
  counts: SummaryCount[];
  warnings: string[];
}) {
  const rows: Array<Array<string | number>> = [
    ["Workspace Name", input.workspaceName],
    ["Exported By", input.exportedBy],
    ["Exported At (UTC)", input.exportedAt],
    ["Export Mode", input.mode.toUpperCase()],
    ["Included Files", input.includeFiles ? "Yes" : "No"],
    [],
    ["Sheet", "Row Count"],
    ...input.counts.map((item) => [item.sheet, item.rows]),
    [],
    ["Warnings", input.warnings.length],
    ...(
      input.warnings.length > 0
        ? input.warnings.map((warning) => [warning])
        : [["No warnings"]]
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 28 }, { wch: 60 }];
  return worksheet;
}

async function getHelpRequestCommentsForExport(organizationId: string) {
  return prisma.$queryRaw<ExportHelpRequestCommentRow[]>`
    select
      hc.id::text as id,
      hc.help_request_id::text as help_request_id,
      hc.comment,
      coalesce(hc.is_internal, true) as is_internal,
      hc.created_at::text as created_at,
      hc.updated_at::text as updated_at,
      hc.user_id::text as user_id,
      p.full_name as user_name,
      p.email as user_email,
      hr.title as help_request_title
    from public.help_request_comments hc
    left join public.profiles p on p.id = hc.user_id
    left join public.help_requests hr on hr.id = hc.help_request_id
    where hc.organization_id = ${organizationId}::uuid
    order by hc.created_at asc
  `;
}

function getDocumentStorageMode(document: Awaited<ReturnType<typeof getDocuments>>[number]) {
  if (document.file_path && isLocalStoredFilePath(document.file_path)) {
    return "local";
  }

  if (document.file_url) {
    return "external";
  }

  if (document.file_path) {
    return "remote";
  }

  return "metadata_only";
}

export async function buildWorkspaceCrmExport(options: ExportOptions): Promise<WorkspaceExportResult> {
  const [user, organization] = await Promise.all([requireAuth(), requireOrganization()]);
  const exportedAt = new Date();
  const exportedAtIso = exportedAt.toISOString();
  const warnings: string[] = [];

  const [companies, contacts, meetings, followups, documents, helpRequests, helpRequestComments] = await Promise.all([
    getCompanies({}, true),
    getContacts({}, true),
    getInteractions({}, true),
    getFollowups({}),
    getDocuments({}),
    getHelpRequests({}),
    getHelpRequestCommentsForExport(organization.id),
  ]);

  const companyPhoneColumns = Math.max(1, ...companies.map((item) => item.phone_numbers?.filter(Boolean).length || 0));
  const companyEmailColumns = Math.max(1, ...companies.map((item) => item.email_addresses?.filter(Boolean).length || 0));
  const contactPhoneColumns = Math.max(1, ...contacts.map((item) => item.mobile_numbers?.filter(Boolean).length || 0));
  const contactEmailColumns = Math.max(1, ...contacts.map((item) => item.email_addresses?.filter(Boolean).length || 0));

  const companyRows = companies.map((company) => {
    const row: Record<string, unknown> = {
      "Company ID": company.id,
      "Company Name": company.name,
      Industry: company.industries?.name ?? "",
      Category: company.company_categories?.name ?? "",
      "Pipeline Stage": company.pipeline_stages?.name ?? "",
      WhatsApp: company.whatsapp ?? "",
      Website: company.website ?? "",
      Address: company.address ?? "",
      City: company.city ?? "",
      Country: company.country ?? "",
      "Lead Source": company.lead_source ?? "",
      Priority: company.priority,
      Status: company.status,
      "Assigned User": company.assigned_profile?.full_name ?? company.assigned_profile?.email ?? "",
      "Primary Contact": company.primary_contact?.name ?? "",
      "Estimated Value": company.estimated_value ?? "",
      "Success Rating": company.success_rating ?? "",
      "Lead Temperature": company.lead_temperature ?? "",
      Notes: company.notes ?? "",
      "Created At": company.created_at,
      "Updated At": company.updated_at,
    };

    for (const item of getLabeledValues(company.phone_numbers, "Primary Phone", "Phone")) {
      row[item.label] = item.value;
    }

    for (const item of getLabeledValues(company.email_addresses, "Primary Email", "Email")) {
      row[item.label] = item.value;
    }

    for (let index = getLabeledValues(company.phone_numbers, "Primary Phone", "Phone").length; index < companyPhoneColumns; index++) {
      row[index === 0 ? "Primary Phone" : `Phone ${index + 1}`] = "";
    }

    for (let index = getLabeledValues(company.email_addresses, "Primary Email", "Email").length; index < companyEmailColumns; index++) {
      row[index === 0 ? "Primary Email" : `Email ${index + 1}`] = "";
    }

    return row;
  });
  const companyHeaders = [
    "Company ID",
    "Company Name",
    "Industry",
    "Category",
    "Pipeline Stage",
    ...Array.from({ length: companyPhoneColumns }, (_, index) => (index === 0 ? "Primary Phone" : `Phone ${index + 1}`)),
    "WhatsApp",
    ...Array.from({ length: companyEmailColumns }, (_, index) => (index === 0 ? "Primary Email" : `Email ${index + 1}`)),
    "Website",
    "Address",
    "City",
    "Country",
    "Lead Source",
    "Priority",
    "Status",
    "Assigned User",
    "Primary Contact",
    "Estimated Value",
    "Success Rating",
    "Lead Temperature",
    "Notes",
    "Created At",
    "Updated At",
  ];

  const contactRows = contacts.map((contact) => {
    const row: Record<string, unknown> = {
      "Contact ID": contact.id,
      "Company ID": contact.company_id,
      Company: contact.companies?.name ?? "",
      Name: contact.name,
      Designation: contact.designation ?? "",
      Department: contact.department ?? "",
      WhatsApp: contact.whatsapp ?? "",
      LinkedIn: contact.linkedin ?? "",
      "Decision Role": contact.decision_role ?? "",
      "Relationship Level": contact.relationship_level ?? "",
      "Preferred Method": contact.preferred_contact_method ?? "",
      "Is Primary": contact.is_primary ? "Yes" : "No",
      Status: contact.status,
      Remarks: contact.remarks ?? "",
      "Created By": contact.created_profile?.full_name ?? contact.created_profile?.email ?? "",
      "Created At": contact.created_at,
      "Updated At": contact.updated_at,
    };

    for (const item of getLabeledValues(contact.mobile_numbers, "Primary Phone", "Phone")) {
      row[item.label] = item.value;
    }

    for (const item of getLabeledValues(contact.email_addresses, "Primary Email", "Email")) {
      row[item.label] = item.value;
    }

    for (let index = getLabeledValues(contact.mobile_numbers, "Primary Phone", "Phone").length; index < contactPhoneColumns; index++) {
      row[index === 0 ? "Primary Phone" : `Phone ${index + 1}`] = "";
    }

    for (let index = getLabeledValues(contact.email_addresses, "Primary Email", "Email").length; index < contactEmailColumns; index++) {
      row[index === 0 ? "Primary Email" : `Email ${index + 1}`] = "";
    }

    return row;
  });
  const contactHeaders = [
    "Contact ID",
    "Company ID",
    "Company",
    "Name",
    "Designation",
    "Department",
    ...Array.from({ length: contactPhoneColumns }, (_, index) => (index === 0 ? "Primary Phone" : `Phone ${index + 1}`)),
    "WhatsApp",
    ...Array.from({ length: contactEmailColumns }, (_, index) => (index === 0 ? "Primary Email" : `Email ${index + 1}`)),
    "LinkedIn",
    "Decision Role",
    "Relationship Level",
    "Preferred Method",
    "Is Primary",
    "Status",
    "Remarks",
    "Created By",
    "Created At",
    "Updated At",
  ];

  const meetingRows = meetings.map((meeting) => ({
    "Meeting ID": meeting.id,
    "Company ID": meeting.company_id,
    Company: meeting.companies?.name ?? "",
    "Contact ID": meeting.contact_person_id ?? "",
    Contact: meeting.contact_persons?.name ?? "",
    Type: meeting.interaction_type,
    "Meeting DateTime": meeting.meeting_datetime,
    Location: meeting.location ?? "",
    "Online Link": meeting.online_meeting_link ?? "",
    "Discussion Details": meeting.discussion_details,
    "Client Requirement": meeting.client_requirement ?? "",
    "Pain Point": meeting.pain_point ?? "",
    "Proposed Solution": meeting.proposed_solution ?? "",
    "Budget Discussion": meeting.budget_discussion ?? "",
    "Competitor Mentioned": meeting.competitor_mentioned ?? "",
    "Decision Timeline": meeting.decision_timeline ?? "",
    "Success Rating": meeting.success_rating ?? "",
    "Lead Temperature": meeting.lead_temperature ?? "",
    "Next Action": meeting.next_action ?? "",
    "Next Followup At": meeting.next_followup_at ?? "",
    "Assigned User": meeting.assigned_profile?.full_name ?? meeting.assigned_profile?.email ?? "",
    Status: meeting.status,
    "Created At": meeting.created_at,
    "Updated At": meeting.updated_at,
  }));
  const meetingHeaders = meetingRows.length > 0 ? Object.keys(meetingRows[0]!) : [
    "Meeting ID", "Company ID", "Company", "Contact ID", "Contact", "Type", "Meeting DateTime", "Location", "Online Link",
    "Discussion Details", "Client Requirement", "Pain Point", "Proposed Solution", "Budget Discussion", "Competitor Mentioned",
    "Decision Timeline", "Success Rating", "Lead Temperature", "Next Action", "Next Followup At", "Assigned User", "Status",
    "Created At", "Updated At",
  ];

  const followupRows = followups.map((followup) => ({
    "Followup ID": followup.id,
    "Company ID": followup.company_id,
    Company: followup.companies?.name ?? "",
    "Contact ID": followup.contact_person_id ?? "",
    Contact: followup.contact_persons?.name ?? "",
    "Interaction ID": followup.interaction_id ?? "",
    Interaction: followup.interactions?.interaction_type ?? "",
    Title: followup.title,
    Type: followup.followup_type,
    Priority: followup.priority,
    Status: followup.status,
    Description: followup.description ?? "",
    "Scheduled At": followup.scheduled_at,
    "Reminder Before Minutes": followup.reminder_before_minutes,
    "Assigned User": followup.assigned_profile?.full_name ?? followup.assigned_profile?.email ?? "",
    "Created By": followup.created_profile?.full_name ?? followup.created_profile?.email ?? "",
    "Completed At": followup.completed_at ?? "",
    "Rescheduled From": followup.rescheduled_from ?? "",
    "Cancelled Reason": followup.cancelled_reason ?? "",
    "Created At": followup.created_at,
    "Updated At": followup.updated_at,
  }));
  const followupHeaders = followupRows.length > 0 ? Object.keys(followupRows[0]!) : [
    "Followup ID", "Company ID", "Company", "Contact ID", "Contact", "Interaction ID", "Interaction", "Title", "Type", "Priority",
    "Status", "Description", "Scheduled At", "Reminder Before Minutes", "Assigned User", "Created By", "Completed At",
    "Rescheduled From", "Cancelled Reason", "Created At", "Updated At",
  ];

  const documentRows = documents.map((document) => ({
    "Document ID": document.id,
    "Company ID": document.company_id,
    Company: document.companies?.name ?? "",
    "Contact ID": document.contact_person_id ?? "",
    Contact: document.contact_persons?.name ?? "",
    "Interaction ID": document.interaction_id ?? "",
    Interaction: document.interactions?.interaction_type ?? "",
    "Followup ID": document.followup_id ?? "",
    Followup: document.followups?.title ?? "",
    Title: document.title,
    "Document Type": document.document_type,
    Status: document.status,
    Description: document.description ?? "",
    "File Name": document.file_name,
    "Storage Mode": getDocumentStorageMode(document),
    "File Path": document.file_path ?? "",
    "File URL": document.file_url ?? "",
    "File Size MB": document.file_size_mb ?? "",
    "MIME Type": document.mime_type ?? "",
    "File Extension": document.file_extension ?? "",
    "Submitted To": document.submitted_to ?? "",
    "Submitted At": document.submitted_at ?? "",
    "Expiry Date": document.expiry_date ?? "",
    Remarks: document.remarks ?? "",
    "Uploaded By": document.uploaded_profile?.full_name ?? document.uploaded_profile?.email ?? "",
    "Created At": document.created_at,
    "Updated At": document.updated_at,
  }));
  const documentHeaders = documentRows.length > 0 ? Object.keys(documentRows[0]!) : [
    "Document ID", "Company ID", "Company", "Contact ID", "Contact", "Interaction ID", "Interaction", "Followup ID", "Followup",
    "Title", "Document Type", "Status", "Description", "File Name", "Storage Mode", "File Path", "File URL", "File Size MB",
    "MIME Type", "File Extension", "Submitted To", "Submitted At", "Expiry Date", "Remarks", "Uploaded By", "Created At", "Updated At",
  ];

  const helpRequestRows = helpRequests.map((item) => ({
    "Help Request ID": item.id,
    "Company ID": item.company_id,
    Company: item.companies?.name ?? "",
    "Contact ID": item.contact_person_id ?? "",
    Contact: item.contact_persons?.name ?? "",
    "Interaction ID": item.interaction_id ?? "",
    Interaction: item.interactions?.interaction_type ?? "",
    "Followup ID": item.followup_id ?? "",
    Followup: item.followups?.title ?? "",
    "Document ID": item.document_id ?? "",
    Document: item.documents?.title ?? "",
    Title: item.title,
    "Help Type": item.help_type,
    Priority: item.priority,
    Status: item.status,
    Description: item.description ?? "",
    "Resolution Note": item.resolution_note ?? "",
    "Requested By": item.requested_profile?.full_name ?? item.requested_profile?.email ?? "",
    "Assigned To": item.assigned_profile?.full_name ?? item.assigned_profile?.email ?? "",
    "Resolved By": item.resolved_profile?.full_name ?? item.resolved_profile?.email ?? "",
    "Resolved At": item.resolved_at ?? "",
    "Created At": item.created_at,
    "Updated At": item.updated_at,
  }));
  const helpRequestHeaders = helpRequestRows.length > 0 ? Object.keys(helpRequestRows[0]!) : [
    "Help Request ID", "Company ID", "Company", "Contact ID", "Contact", "Interaction ID", "Interaction", "Followup ID", "Followup",
    "Document ID", "Document", "Title", "Help Type", "Priority", "Status", "Description", "Resolution Note", "Requested By",
    "Assigned To", "Resolved By", "Resolved At", "Created At", "Updated At",
  ];

  const helpRequestCommentRows = helpRequestComments.map((comment) => ({
    "Comment ID": comment.id,
    "Help Request ID": comment.help_request_id,
    "Help Request Title": comment.help_request_title ?? "",
    "User ID": comment.user_id,
    User: comment.user_name ?? comment.user_email ?? "",
    Internal: comment.is_internal ? "Yes" : "No",
    Comment: comment.comment,
    "Created At": comment.created_at,
    "Updated At": comment.updated_at,
  }));
  const helpRequestCommentHeaders = helpRequestCommentRows.length > 0 ? Object.keys(helpRequestCommentRows[0]!) : [
    "Comment ID", "Help Request ID", "Help Request Title", "User ID", "User", "Internal", "Comment", "Created At", "Updated At",
  ];

  const workbook = XLSX.utils.book_new();
  const counts: SummaryCount[] = [
    { sheet: "Companies", rows: companyRows.length },
    { sheet: "Contacts", rows: contactRows.length },
    { sheet: "Meetings", rows: meetingRows.length },
    { sheet: "Followups", rows: followupRows.length },
    { sheet: "Documents", rows: documentRows.length },
    { sheet: "Help Requests", rows: helpRequestRows.length },
    { sheet: "Help Request Comments", rows: helpRequestCommentRows.length },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    buildSummarySheet({
      workspaceName: organization.name,
      exportedBy: user.name ?? user.email ?? user.id,
      exportedAt: exportedAtIso,
      mode: options.includeFiles ? "zip" : "xlsx",
      includeFiles: options.includeFiles,
      counts,
      warnings,
    }),
    "Summary",
  );
  XLSX.utils.book_append_sheet(workbook, buildSheetFromRows(companyRows, companyHeaders), "Companies");
  XLSX.utils.book_append_sheet(workbook, buildSheetFromRows(contactRows, contactHeaders), "Contacts");
  XLSX.utils.book_append_sheet(workbook, buildSheetFromRows(meetingRows, meetingHeaders), "Meetings");
  XLSX.utils.book_append_sheet(workbook, buildSheetFromRows(followupRows, followupHeaders), "Followups");
  XLSX.utils.book_append_sheet(workbook, buildSheetFromRows(documentRows, documentHeaders), "Documents");
  XLSX.utils.book_append_sheet(workbook, buildSheetFromRows(helpRequestRows, helpRequestHeaders), "Help Requests");
  XLSX.utils.book_append_sheet(workbook, buildSheetFromRows(helpRequestCommentRows, helpRequestCommentHeaders), "Help Request Comments");

  const workbookBuffer = Buffer.from(
    XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer,
  );
  const fileBaseName = `${slugify(organization.name) || "workspace"}-crm-export-${formatTimestampForFile(exportedAt)}`;

  if (!options.includeFiles) {
    const finalWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      finalWorkbook,
      buildSummarySheet({
        workspaceName: organization.name,
        exportedBy: user.name ?? user.email ?? user.id,
        exportedAt: exportedAtIso,
        mode: "xlsx",
        includeFiles: false,
        counts,
        warnings,
      }),
      "Summary",
    );
    for (const sheetName of workbook.SheetNames.filter((name) => name !== "Summary")) {
      XLSX.utils.book_append_sheet(finalWorkbook, workbook.Sheets[sheetName]!, sheetName);
    }

    return {
      buffer: Buffer.from(XLSX.write(finalWorkbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: `${fileBaseName}.xlsx`,
    };
  }

  const zip = new JSZip();
  zip.file(`${fileBaseName}.xlsx`, workbookBuffer);

  for (const document of documents) {
    const storageMode = getDocumentStorageMode(document);
    if (storageMode !== "local") {
      if (storageMode === "external") {
        warnings.push(`Document "${document.title}" uses an external file URL and was exported as metadata only.`);
      }
      continue;
    }

    if (!document.file_path) {
      warnings.push(`Document "${document.title}" is marked local but missing a stored file path.`);
      continue;
    }

    try {
      const uploadedFile = await readPrivateUpload(document.file_path);
      const safeName = sanitizeStoredFileName(`${document.id}-${document.file_name}`, "document");
      zip.file(`documents/${document.company_id}/${safeName}`, uploadedFile.content);
    } catch {
      warnings.push(`Document file for "${document.title}" could not be read and was skipped from the ZIP archive.`);
    }
  }

  const finalWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    finalWorkbook,
    buildSummarySheet({
      workspaceName: organization.name,
      exportedBy: user.name ?? user.email ?? user.id,
      exportedAt: exportedAtIso,
      mode: "zip",
      includeFiles: true,
      counts,
      warnings,
    }),
    "Summary",
  );
  for (const sheetName of workbook.SheetNames.filter((name) => name !== "Summary")) {
    XLSX.utils.book_append_sheet(finalWorkbook, workbook.Sheets[sheetName]!, sheetName);
  }

  zip.file(
    `${fileBaseName}.xlsx`,
    Buffer.from(XLSX.write(finalWorkbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer),
  );

  return {
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
    contentType: "application/zip",
    fileName: `${fileBaseName}.zip`,
  };
}
