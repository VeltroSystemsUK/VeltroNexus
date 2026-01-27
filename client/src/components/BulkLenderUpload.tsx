import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileUp, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { LENDER_TYPES, PRODUCT_TYPES } from "@shared/schema";

interface CSVRow {
    [key: string]: string;
}

export function BulkLenderUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const bulkCreateMutation = useMutation({
        mutationFn: async (lenders: any[]) => {
            const res = await apiRequest("/api/lenders/bulk-upload", "POST", { lenders });
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`Successfully uploaded ${data.count} lenders`);
            queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
            setFile(null);
            setPreviewData([]);
        },
        onError: (error: Error) => {
            toast.error(`Failed to upload lenders: ${error.message}`);
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
                toast.error("Please select a valid CSV file");
                return;
            }
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const parseFile = (file: File) => {
        setIsParsing(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const mappedData = results.data.map((row: any) => ({
                    institutionName: row["Company Name"] || row["Institution Name"] || row["Name"],
                    website: row["Website"] || row["URL"],
                    logoUrl: row["Clearbit Logo URL"] || row["Logo"],
                    lenderType: mapLenderType(row["Category"] || row["Type"]),
                    productTypes: parseArray(row["Products"] || row["Product Types"]),
                    sectors: parseArray(row["Sectors Served"] || row["Sectors"]),
                    regions: parseArray(row["Geographic Coverage"] || row["Regions"]),
                    contactName: row["Contact Name"],
                    email: row["Email"] || row["Email/Phone"]?.split(",")?.[0]?.trim(),
                    phone: row["Phone"] || row["Email/Phone"]?.split(",")?.[1]?.trim(),
                    notes: row["Notes"],
                })).filter(l => l.institutionName);

                setPreviewData(mappedData.slice(0, 50)); // Show first 50 for preview
                setIsParsing(false);
            },
            error: (error) => {
                console.error("CSV Parse Error:", error);
                toast.error("Failed to parse CSV file");
                setIsParsing(false);
            }
        });
    };

    const mapLenderType = (type?: string) => {
        if (!type) return "specialist_lender";
        const t = type.toLowerCase();
        if (t.includes("bank")) return "bank";
        if (t.includes("p2p")) return "p2p_platform";
        if (t.includes("building society")) return "building_society";
        return "specialist_lender";
    };

    const parseArray = (val?: string) => {
        if (!val) return [];
        return val.split(",").map(s => s.trim()).filter(Boolean);
    };

    const handleUpload = () => {
        if (!file) return;

        setIsParsing(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const mappedData = results.data.map((row: any) => ({
                    institutionName: row["Company Name"] || row["Institution Name"] || row["Name"],
                    website: row["Website"] || row["URL"],
                    logoUrl: row["Clearbit Logo URL"] || row["Logo"],
                    lenderType: mapLenderType(row["Category"] || row["Type"]),
                    productTypes: parseArray(row["Products"] || row["Product Types"]),
                    sectors: parseArray(row["Sectors Served"] || row["Sectors"]),
                    regions: parseArray(row["Geographic Coverage"] || row["Regions"]),
                    contactName: row["Contact Name"],
                    email: row["Email"] || row["Email/Phone"]?.split(",")?.[0]?.trim(),
                    phone: row["Phone"] || row["Email/Phone"]?.split(",")?.[1]?.trim(),
                    notes: row["Notes"],
                })).filter(l => l.institutionName);

                bulkCreateMutation.mutate(mappedData);
                setIsParsing(false);
            }
        });
    };

    const clearFile = () => {
        setFile(null);
        setPreviewData([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="space-y-6">
            <Card className="border-dashed border-2 bg-muted/30">
                <CardContent className="py-12">
                    <div className="flex flex-col items-center text-center">
                        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <FileUp className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Upload Lender Panel</h3>
                        <p className="text-muted-foreground max-w-md mb-8">
                            Upload a CSV file with your panel of lenders. We'll automatically map the headers like "Company Name", "Website", and "Products".
                        </p>

                        <div className="flex gap-4">
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            {!file ? (
                                <Button onClick={() => fileInputRef.current?.click()} size="lg">
                                    Select CSV File
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button onClick={handleUpload} size="lg" disabled={bulkCreateMutation.isPending || isParsing}>
                                        {bulkCreateMutation.isPending ? (
                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                                        ) : (
                                            <><CheckCircle2 className="h-4 w-4 mr-2" /> Start Import</>
                                        )}
                                    </Button>
                                    <Button variant="outline" size="lg" onClick={clearFile} disabled={bulkCreateMutation.isPending}>
                                        <X className="h-4 w-4 mr-2" /> Cancel
                                    </Button>
                                </div>
                            )}
                        </div>

                        {file && (
                            <div className="mt-4 flex items-center gap-2 text-sm font-medium">
                                <Badge variant="secondary" className="px-3 py-1">
                                    {file.name}
                                </Badge>
                                <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {previewData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Import Preview</CardTitle>
                        <CardDescription>
                            We found {previewData.length} lenders in this file. Here's how they will be imported:
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Lender Name</TableHead>
                                        <TableHead>Website</TableHead>
                                        <TableHead>Products</TableHead>
                                        <TableHead>Type</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.slice(0, 10).map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-bold">{row.institutionName}</TableCell>
                                            <TableCell className="text-muted-foreground">{row.website}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {row.productTypes.slice(0, 2).map((p: string) => (
                                                        <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                                                    ))}
                                                    {row.productTypes.length > 2 && <span className="text-[10px] text-muted-foreground">+{row.productTypes.length - 2}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{LENDER_TYPES.find(t => t.value === row.lenderType)?.label || row.lenderType}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {previewData.length > 10 && (
                                <div className="p-4 text-center border-t text-sm text-muted-foreground">
                                    And {previewData.length - 10} more lenders...
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 text-primary">
                        <AlertCircle className="h-5 w-5" />
                        <CardTitle className="text-base">CSV Formatting Guidance</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <p>For the best results, ensure your CSV has these headers:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li><strong>Company Name</strong> (Required)</li>
                        <li><strong>Website</strong> (Used for logo lookup)</li>
                        <li><strong>Products</strong> (Comma-separated list)</li>
                        <li><strong>Category</strong> (Lender type)</li>
                        <li><strong>Email/Phone</strong> (Contact info)</li>
                    </ul>
                </CardContent>
                <CardFooter>
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10" asChild>
                        <a href="https://docs.google.com/spreadsheets/d/1OksjzBN84wmHph2WYAfydqjtc-38MA-dbs31PnJt80w/edit?usp=sharing" target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" /> Download Google Sheets Template
                        </a>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
