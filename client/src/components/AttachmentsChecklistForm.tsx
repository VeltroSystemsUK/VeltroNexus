import { useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { storeProspectFile } from "@/lib/storeProspectFile";
import { ATTACHMENT_ITEMS } from "@shared/attachmentsChecklist";
import {
  attachmentCategoryFromFilename,
  attachmentsFromDocuments,
} from "@shared/sterlingPortal";
import { ClipboardCheck, Paperclip, Upload } from "lucide-react";

type ProspectDocument = {
  id: number;
  fileName: string;
  category?: string | null;
};

interface AttachmentsChecklistFormProps {
  prospectId: number;
  compact?: boolean;
}

export function AttachmentsChecklistForm({ prospectId, compact }: AttachmentsChecklistFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryKey = [`/api/prospects/${prospectId}/documents`];
  const { data: documents = [], isLoading } = useQuery<ProspectDocument[]>({
    queryKey,
    enabled: prospectId > 0,
  });

  const items = useMemo(() => attachmentsFromDocuments(documents), [documents]);
  const attachedCount = items.filter((item) => item.attached).length;
  const fileCount = items.reduce((n, item) => n + (item.files?.length || 0), 0);
  const missing = items.filter((item) => !item.attached);

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await storeProspectFile(prospectId, file, attachmentCategoryFromFilename(file.name));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
      toast.success("Files added to this record");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not add files");
    },
  });

  const list = (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.id} className="rounded-md px-1 py-1.5" data-testid={`attachment-item-${item.id}`}>
          <div className="flex items-start justify-between gap-3">
            <p className={`text-sm ${item.attached ? "text-foreground" : "text-muted-foreground"}`}>
              {item.label}
            </p>
            <span className={`text-xs font-medium shrink-0 ${item.attached ? "text-emerald-700" : "text-destructive"}`}>
              {item.attached ? "On file" : "Missing"}
            </span>
          </div>
          {item.files?.length ? (
            <ul className="mt-1 space-y-0.5">
              {item.files.map((file) => (
                <li key={file.id} className="flex items-center gap-1.5 text-xs text-primary">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <a
                    href={`/api/prospects/${prospectId}/documents/${file.id}/download`}
                    className="truncate underline-offset-2 hover:underline"
                  >
                    {file.fileName}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );

  const summary = isLoading
    ? "Checking files on this record…"
    : `${fileCount} file${fileCount === 1 ? "" : "s"} already on Due Diligence · ${attachedCount} of ${ATTACHMENT_ITEMS.length} items complete${
        missing.length ? ` · missing ${missing.length}` : ""
      }`;

  if (compact) {
    return (
      <div className="space-y-2" data-testid="attachments-checklist">
        <div>
          <p className="text-sm font-medium">File completion</p>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>
        <div className="max-h-48 overflow-y-auto rounded-md border p-2">{list}</div>
        {missing.length ? (
          <p className="text-xs text-muted-foreground">
            Missing files were uploaded on Assessment / Due Diligence, or add them there before sending. Submit is not
            blocked.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">All expected supporting files are already on this record.</p>
        )}
      </div>
    );
  }

  return (
    <Card data-testid="attachments-checklist">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Supporting files
            </CardTitle>
            <CardDescription>
              Files uploaded in Due Diligence and Documents are matched automatically. David sees these in Sterling.
              Drop extra files here if something is still missing — you do not re-upload on submit.
            </CardDescription>
          </div>
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {attachedCount} / {ATTACHMENT_ITEMS.length}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{summary}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.zip"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) uploadMutation.mutate(files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploadMutation.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          {uploadMutation.isPending ? "Adding…" : "Add files"}
        </Button>
        {list}
      </CardContent>
    </Card>
  );
}
