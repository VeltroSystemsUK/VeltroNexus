import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Upload,
    CheckCircle,
    FileText,
    AlertCircle,
    Info,
    ChevronDown,
    ChevronUp,
    Building2,
    User,
    Hash,
    Phone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";

interface DocumentRequirement {
    id: string;
    label: string;
    description: string;
    longDescription?: string;
    category: string;
    required: boolean;
    status: "pending" | "uploaded";
    document?: {
        id: number;
        fileName: string;
        uploadedAt: string;
    };
}

interface DocumentPortalData {
    dealType: string;
    businessName: string;
    contactName: string;
    referenceNumber: string;
    checklist: DocumentRequirement[];
}

interface DocumentPortalProps {
    prospectId: number;
    className?: string;
}

export function DocumentUploadPortal({ prospectId, className }: DocumentPortalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [uploading, setUploading] = useState<string | null>(null);

    // Fetch Requirements
    const { data, isLoading } = useQuery<DocumentPortalData>({
        queryKey: ["/api/prospects", prospectId, "requirements"],
        enabled: !!prospectId,
    });

    // Upload Mutation
    const uploadMutation = useMutation({
        mutationFn: async ({ file, category }: { file: File, category: string }) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("category", category);

            const res = await fetch(`/api/prospects/${prospectId}/documents/upload`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Upload failed");
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Document Uploaded",
                description: "The file has been successfully uploaded and sent for validation.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "requirements"] });
            setUploading(null);
        },
        onError: () => {
            toast({
                title: "Upload Failed",
                description: "Please try again.",
                variant: "destructive",
            });
            setUploading(null);
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(category);
            uploadMutation.mutate({ file: e.target.files[0], category });
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                <p className="text-slate-500">Retrieving secure session...</p>
            </div>
        );
    }

    const checklist = data?.checklist || [];
    const completedCount = checklist.filter(i => i.status === "uploaded").length;
    const totalCount = checklist.length;
    const progress = Math.round((completedCount / totalCount) * 100) || 0;

    return (
        <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-8", className)}>

            {/* Sidebar / Top Summary */}
            <div className="lg:col-span-1 space-y-6">
                <Card className="border-emerald-100 shadow-sm">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-emerald-600" />
                            Application Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Company</p>
                            <p className="font-medium text-slate-900">{data?.businessName}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Applicant</p>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-slate-400" />
                                <p className="font-medium text-slate-900">{data?.contactName}</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Reference</p>
                            <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-slate-400" />
                                <p className="font-medium text-slate-900 font-mono">{data?.referenceNumber}</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Deal Type</p>
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 uppercase text-[10px]">
                                {data?.dealType.replace(/_/g, " ")}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-600 text-white border-none shadow-md hidden lg:block">
                    <CardContent className="pt-6">
                        <h3 className="font-semibold text-lg mb-2">Need Help?</h3>
                        <p className="text-emerald-100 text-sm mb-4">
                            If you're unsure about any document, please contact your Case Manager.
                        </p>
                        <div className="flex items-center gap-3 text-sm font-medium">
                            <div className="p-2 bg-emerald-500 rounded-full">
                                <Phone className="w-4 h-4" />
                            </div>
                            020 7123 4567
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Document Tasks</h1>
                        <p className="text-slate-500 mt-1">
                            {completedCount} of {totalCount} documents uploaded
                        </p>
                    </div>
                    <div className="w-full sm:w-32 bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-emerald-600 h-full transition-all duration-700 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    {checklist.map((item) => (
                        <Card key={item.id} className={cn(
                            "transition-all duration-200 border",
                            item.status === "uploaded" ? "border-green-200 bg-green-50/30" : "border-slate-200 hover:border-emerald-300"
                        )}>
                            <div className="p-5">
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "p-3 rounded-xl shrink-0 transition-colors",
                                        item.status === "uploaded" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {item.status === "uploaded" ? <CheckCircle className="w-6 h-6" /> : <LinkIcon category={item.category} />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-slate-900 text-lg">{item.label}</h3>
                                            {item.required && item.status !== "uploaded" && (
                                                <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 border-amber-200 h-5">Required</Badge>
                                            )}
                                        </div>

                                        <p className="text-slate-600 text-sm">{item.description}</p>

                                        {item.longDescription && item.status !== "uploaded" && (
                                            <div className="mt-3 text-sm bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/50 text-emerald-900 flex gap-2">
                                                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                <span>{item.longDescription}</span>
                                            </div>
                                        )}

                                        {item.status === "uploaded" && (
                                            <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-white/50 w-fit px-3 py-1.5 rounded-full border border-green-100">
                                                <FileText className="w-4 h-4" />
                                                <span className="truncate max-w-[200px]">{item.document?.fileName}</span>
                                                <span className="text-green-400 text-xs ml-2">Uploaded just now</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="shrink-0 self-center">
                                        {item.status === "uploaded" ? (
                                            <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700 hover:bg-green-100" disabled>
                                                <CheckCircle className="w-6 h-6" />
                                            </Button>
                                        ) : (
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    id={`upload-${item.id}`}
                                                    className="hidden"
                                                    onChange={(e) => handleFileChange(e, item.id)}
                                                    disabled={uploading === item.id}
                                                />
                                                <label htmlFor={`upload-${item.id}`}>
                                                    <Button
                                                        size="lg"
                                                        className={cn(
                                                            "bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all active:scale-95",
                                                            uploading === item.id && "opacity-70"
                                                        )}
                                                        asChild
                                                        disabled={!!uploading}
                                                    >
                                                        <span className="cursor-pointer flex items-center gap-2">
                                                            {uploading === item.id ? (
                                                                <>Processing...</>
                                                            ) : (
                                                                <>
                                                                    <Upload className="w-5 h-5" />
                                                                    Upload
                                                                </>
                                                            )}
                                                        </span>
                                                    </Button>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}

function LinkIcon({ category }: { category: string }) {
    // Simple icon mapping
    return <FileText className="w-6 h-6" />;
}
