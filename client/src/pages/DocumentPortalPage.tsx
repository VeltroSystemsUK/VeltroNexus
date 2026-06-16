import React from "react";
import { useParams } from "wouter";
import { DocumentUploadPortal } from "@/components/DocumentUploadPortal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldCheck, FileText, Phone, Building2 } from "lucide-react";

export default function DocumentPortalPage() {
    const params = useParams<{ id: string }>();
    const prospectId = params.id ? parseInt(params.id) : 0;

    if (!prospectId || isNaN(prospectId)) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Card className="w-full max-w-md border-red-100">
                    <CardHeader>
                        <CardTitle className="text-red-600 flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6" />
                            Invalid Link
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        The secure link appears to be invalid or expired. Please contact your account manager.
                    </CardContent>
                </Card>
            </div>
        );
    }

    // We'll let the DocumentUploadPortal fetch the prospect details for now, 
    // or we could hoist the query here. 
    // Since DocumentUploadPortal already has the query, we'll let it drive the UI content 
    // by passing a "renderHeader" prop or just accepting that the component manages the main content.
    // Actually, to make the page structure better, I should move the query UP to this page 
    // so I can populate the sidebar with the same data.
    // But for speed, I will update DocumentUploadPortal to expose this data or just have DocumentUploadPortal
    // render the whole main section and I'll wrap it.

    // Pivot: I'll update DocumentUploadPortal to handle the layout itself or I'll query here.
    // Querying here is cleaner for page layout.

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-emerald-50 shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-emerald-600 p-1.5 rounded-lg">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-xl text-slate-900 tracking-tight">Veltro<span className="text-emerald-600">Secure</span></span>
                    </div>
                    <div className="text-xs text-slate-500 hidden sm:block">
                        <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> 256-bit Encryption</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <DocumentUploadPortal prospectId={prospectId} />
            </main>

            {/* Simplified Footer */}
            <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-slate-400 text-xs">
                <p>&copy; 2026 Veltro Capital. All rights reserved.</p>
                <p className="mt-1">London • Manchester • Edinburgh</p>
            </footer>
        </div>
    );
}
