import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  X,
  FileText,
  File,
  Image,
  Loader2,
  Send,
  Paperclip,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { UnderwritingAttachment } from "@shared/schema";

interface ReplyToQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: number;
  prospectId: number;
  queryMessage?: string;
}

const FILE_SIZE_LIMIT = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "txt",
  "rtf",
  "odt",
  "ods",
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.includes("pdf")) return FileText;
  return File;
}

export default function ReplyToQueryDialog({
  open,
  onOpenChange,
  submissionId,
  prospectId,
  queryMessage,
}: ReplyToQueryDialogProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<UnderwritingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/underwriting/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload files");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setAttachments((prev) => [...prev, ...data.files]);
      toast.success(`${data.files.length} file(s) uploaded successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/underwriting/submissions/${submissionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message,
          attachments,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit response");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/underwriting/prospects/${prospectId}/submission`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/underwriting/submissions/${submissionId}/activities`],
      });
      toast.success("Response submitted successfully");
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setMessage("");
    setAttachments([]);
    onOpenChange(false);
  };

  const validateFile = (file: File): string | null => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return `File type .${extension} is not allowed`;
    }
    if (file.size > FILE_SIZE_LIMIT) {
      return `File exceeds ${formatFileSize(FILE_SIZE_LIMIT)} limit`;
    }
    return null;
  };

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const validFiles: File[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      });

      if (errors.length > 0) {
        toast.error(errors.join("\n"));
      }

      if (validFiles.length > 0) {
        setIsUploading(true);
        try {
          const dataTransfer = new DataTransfer();
          validFiles.forEach((file) => dataTransfer.items.add(file));
          await uploadMutation.mutateAsync(dataTransfer.files);
        } finally {
          setIsUploading(false);
        }
      }
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!message.trim()) {
      toast.error("Please provide a response message");
      return;
    }
    submitMutation.mutate();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setMessage("");
      setAttachments([]);
      setDragOver(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-purple-600" />
            Reply to Underwriter Query
          </DialogTitle>
          <DialogDescription>
            Provide your response to the underwriter's query and attach any supporting documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {queryMessage && (
            <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-purple-900 dark:text-purple-100 mb-1">
                      Underwriter Query:
                    </p>
                    <p className="text-sm text-purple-800 dark:text-purple-200">{queryMessage}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="response-message">Your Response</Label>
            <Textarea
              id="response-message"
              placeholder="Enter your response to the query..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px] resize-none"
              data-testid="input-query-response"
            />
          </div>

          <div className="space-y-3">
            <Label>Supporting Documents</Label>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                id="file-upload"
                data-testid="input-file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                    <span className="text-sm text-muted-foreground">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium">Drop files here or click to upload</span>
                    <span className="text-xs text-muted-foreground">
                      PDF, Word, Excel, Images up to 10MB each
                    </span>
                  </>
                )}
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((attachment, index) => {
                  const Icon = getFileIcon(attachment.fileType);
                  return (
                    <div
                      key={`${attachment.storagePath}-${index}`}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.fileSize)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeAttachment(index)}
                        className="flex-shrink-0"
                        data-testid={`button-remove-attachment-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={submitMutation.isPending}
            data-testid="button-cancel-response"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!message.trim() || submitMutation.isPending}
            data-testid="button-submit-response"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Response
                {attachments.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    <Paperclip className="h-3 w-3 mr-1" />
                    {attachments.length}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
