"use client";

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";
import { FileArchive, FileText, UploadCloud, UserSquare2 } from "lucide-react";
import { ReportChartCard } from "./report-chart-card";
import { ReportDataTable } from "./report-data-table";
import { ReportChartLegend, ReportChartTooltip, REPORT_CHART_COLORS, ReportMetricCard } from "./report-visuals";
import type { DocumentReportData } from "@/lib/crm/report-queries";
import { DocumentStatusBadge, DocumentTypeBadge } from "@/components/crm/document-badges";
import Link from "next/link";

export function DocumentReport({ data }: { data: DocumentReportData }) {
  const topUploader = [...data.documentsByUser].sort((a, b) => b.count - a.count)[0];
  const topType = [...data.documentsByType].sort((a, b) => b.count - a.count)[0];

  const columns = [
    { 
      header: "Title", 
      accessorKey: "title",
      cell: (item: any) => (
        <Link href={`/documents/${item.id}`} className="font-medium text-primary hover:underline">
          {item.title}
        </Link>
      )
    },
    { 
      header: "Company", 
      accessorKey: "companies.name",
      cell: (item: any) => (
        <Link href={`/companies/${item.companies?.id}`} className="font-medium text-primary hover:underline">
          {item.companies?.name}
        </Link>
      )
    },
    { 
      header: "Type", 
      accessorKey: "document_type",
      cell: (item: any) => <DocumentTypeBadge type={item.document_type} />
    },
    { 
      header: "Status", 
      accessorKey: "status",
      cell: (item: any) => <DocumentStatusBadge status={item.status} />
    },
    { header: "Uploaded By", accessorKey: "uploaded_profile.full_name" },
    { 
      header: "Date", 
      accessorKey: "created_at",
      cell: (item: any) => new Date(item.created_at).toLocaleDateString()
    },
    { header: "Size", accessorKey: "file_size_mb", cell: (item: any) => `${item.file_size_mb} MB` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard title="Total Documents" value={String(data.totalDocuments)} detail="Documents in the selected range" tone="slate" icon={FileText} badge="volume" />
        <ReportMetricCard title="Top Uploader" value={topUploader?.user || "N/A"} detail={topUploader ? `${topUploader.count} uploads in this view` : "No uploader data yet"} tone="sky" icon={UploadCloud} badge="owner" />
        <ReportMetricCard title="Top Document Type" value={topType?.type || "N/A"} detail={topType ? `${topType.count} files submitted in this type` : "No type data yet"} tone="teal" icon={FileArchive} badge="mix" />
        <ReportMetricCard title="Latest Document" value={data.recentDocuments[0]?.title || "N/A"} detail="Most recently uploaded file" tone="amber" icon={UserSquare2} badge="recent" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Documents by Type" description="Review which document types are being submitted most often." badge="Type mix" headerRight={<MiniStat label="Top type" value={topType?.type || "N/A"} />} isEmpty={data.documentsByType.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.documentsByType}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={92}
                paddingAngle={5}
                dataKey="count"
                nameKey="type"
                stroke="#ffffff"
                strokeWidth={4}
              >
                {data.documentsByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ReportChartTooltip />} />
              <Legend content={<ReportChartLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Documents by Status" description="Check how documents are distributed across submission statuses." badge="Status" headerRight={<MiniStat label="Top uploader" value={topUploader?.user || "N/A"} />} isEmpty={data.documentsByStatus.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.documentsByStatus}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" fontSize={12} tick={{ fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" fill="#0284c7" radius={[10, 10, 0, 0]} barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard title="Documents by Uploader" description="Compare document contribution across your team." height={260} badge="Contributors" isEmpty={data.documentsByUser.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.documentsByUser}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="user" fontSize={10} interval={0} tick={{ width: 60, fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<ReportChartTooltip />} />
              <Bar dataKey="count" fill="#0f766e" radius={[10, 10, 0, 0]} barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartCard>

        <ReportChartCard title="Submission Snapshot" description="Use this quick view to interpret recent document momentum." height={260} badge="Summary">
          <div className="grid h-full gap-3 p-2">
            <ReportMetricCard title="Recent Uploads" value={String(data.recentDocuments.length)} detail="Documents included in the recent submission table" tone="slate" icon={UploadCloud} align="center" />
            <ReportMetricCard title="Team Contributors" value={String(data.documentsByUser.length)} detail="Distinct uploaders in the selected range" tone="sky" icon={UserSquare2} align="center" />
          </div>
        </ReportChartCard>
      </div>

      <ReportDataTable 
        title="Recent Document Submissions" 
        columns={columns} 
        data={data.recentDocuments} 
        exportFileName="recent-documents"
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right ring-1 ring-slate-200 dark:bg-slate-900/85 dark:ring-slate-700">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
