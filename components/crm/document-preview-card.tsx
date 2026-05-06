import Image from "next/image";
import { FileIcon, FileText, ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentDownloadButton } from "./document-download";
import type { Document } from "@/lib/crm/types";

const imageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

function getNormalizedExtension(document: Document) {
  return document.file_extension?.toLowerCase() ?? "";
}

function isImageDocument(document: Document) {
  const extension = getNormalizedExtension(document);
  return imageExtensions.has(extension) || document.mime_type?.startsWith("image/") === true;
}

function isPdfDocument(document: Document) {
  const extension = getNormalizedExtension(document);
  return extension === "pdf" || document.mime_type === "application/pdf";
}

export function DocumentPreviewCard({
  document,
  signedViewUrl,
}: {
  document: Document;
  signedViewUrl: string | null;
}) {
  const isImage = isImageDocument(document);
  const isPdf = isPdfDocument(document);
  const canPreview = Boolean(signedViewUrl) && (isImage || isPdf);

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 shadow-soft dark:border-slate-800 dark:bg-slate-900/85">
      <CardHeader>
        <CardTitle>File Preview</CardTitle>
        <CardDescription>
          {canPreview
            ? "Preview the stored file directly from the private bucket using a short-lived signed URL."
            : "Preview is not available for this file type. You can still download the original file."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canPreview && signedViewUrl ? (
          isImage ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
              <Image
                src={signedViewUrl}
                alt={document.title}
                width={1600}
                height={1200}
                unoptimized
                className="max-h-[32rem] w-full object-contain bg-slate-50"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                <iframe
                  src={signedViewUrl}
                  title={`${document.title} preview`}
                  className="h-[32rem] w-full"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                If your browser cannot preview this PDF, use the download button below.
              </p>
              <DocumentDownloadButton documentId={document.id} fileName={document.file_name} />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <div className="mb-4 rounded-full bg-white p-3 text-slate-600 shadow-sm">
              {isImage ? <ImageIcon className="h-6 w-6" /> : isPdf ? <FileText className="h-6 w-6" /> : <FileIcon className="h-6 w-6" />}
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{document.file_name}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Preview not available for this file type.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {document.file_size_mb ? `${document.file_size_mb} MB` : "File size unavailable"}
            </p>
            <div className="mt-5">
              <DocumentDownloadButton documentId={document.id} fileName={document.file_name} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
