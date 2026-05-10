"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { 
  ArrowLeft, 
  Edit, 
  FileDown, 
  Archive, 
  Trash2, 
  MoreVertical,
  Calendar,
  User,
  Building2,
  FileIcon,
  Clock,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { DocumentTypeBadge, DocumentStatusBadge, FileSizeBadge } from "./document-badges";
import { archiveDocument, deleteDocument } from "@/lib/crm/document-actions";
import { formatDateBD } from "@/lib/format/datetime";
import { useDocumentDownload } from "./document-download";
import type { Document } from "@/lib/crm/types";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export function DocumentDetailHeader({ document }: { document: Document }) {
  const router = useRouter();
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { downloadDocument, downloadingDocumentId, downloadError, clearDownloadError } = useDocumentDownload();
  const isDownloading = downloadingDocumentId === document.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/documents">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{document.title}</h1>
              <DocumentStatusBadge status={document.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <Link href={`/companies/${document.company_id}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Building2 className="w-4 h-4" />
                {document.companies?.name}
              </Link>
              <div className="flex items-center gap-1.5">
                <FileIcon className="w-4 h-4" />
                {document.file_name}
                <FileSizeBadge sizeMb={document.file_size_mb} className="ml-1" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void downloadDocument(document.id)}
            disabled={isDownloading}
          >
            <FileDown className="w-4 h-4 mr-2" />
            {isDownloading ? "Downloading..." : "Download"}
          </Button>
          <Button asChild variant="outline">
            <Link href={`/documents/${document.id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsArchiveModalOpen(true)}>
                <Archive className="w-4 h-4 mr-2" />
                Archive Document
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive" 
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {downloadError ? (
        <p className="text-sm text-destructive">
          {downloadError}
          <button type="button" className="ml-2 underline underline-offset-2" onClick={clearDownloadError}>
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeaderCard 
          icon={<FileIcon className="w-4 h-4" />} 
          label="Document Type" 
          value={<DocumentTypeBadge type={document.document_type} />} 
        />
        <HeaderCard 
          icon={<User className="w-4 h-4" />} 
          label="Uploaded By" 
          value={document.uploaded_profile?.full_name || "Unknown"} 
        />
        <HeaderCard 
          icon={<Calendar className="w-4 h-4" />} 
          label="Submitted Date" 
          value={document.submitted_at ? formatDateBD(document.submitted_at) : "Not submitted"} 
        />
        <HeaderCard 
          icon={<Clock className="w-4 h-4" />} 
          label="Created At" 
          value={formatDateBD(document.created_at)} 
        />
      </div>

      <ConfirmModal
        open={isArchiveModalOpen}
        onOpenChange={setIsArchiveModalOpen}
        title="Archive Document"
        description="Are you sure you want to archive this document? It will be hidden from active lists but kept in history."
        confirmLabel="Archive"
        onConfirm={() => {
          startTransition(async () => {
            await archiveDocument(document.id);
            setIsArchiveModalOpen(false);
            router.refresh();
          });
        }}
      />

      <ConfirmModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Delete Document"
        description="This will permanently delete the document and its file from storage. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          startTransition(async () => {
            await deleteDocument(document.id);
            setIsDeleteModalOpen(false);
            router.push("/documents");
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function HeaderCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-white shadow-sm">
      <div className="p-2 rounded-md bg-muted text-muted-foreground mt-0.5">
        {icon}
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</p>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
