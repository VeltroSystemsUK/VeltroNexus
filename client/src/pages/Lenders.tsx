import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Building2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLenderSchema, type InsertLender, type Lender } from "@shared/schema";

export default function Lenders() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLender, setEditingLender] = useState<Lender | null>(null);
  const [deletingLender, setDeletingLender] = useState<Lender | null>(null);

  const { data: lenders = [], isLoading, error } = useQuery<Lender[]>({
    queryKey: ["/api/lenders"],
    enabled: isAuthenticated,
  });

  const form = useForm<InsertLender>({
    resolver: zodResolver(insertLenderSchema),
    defaultValues: {
      institutionName: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      website: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertLender) =>
      apiRequest("/api/lenders", "POST", data),
    onSuccess: () => {
      toast.success("Lender created successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create lender: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: InsertLender }) =>
      apiRequest(`/api/lenders/${id}`, "PATCH", data),
    onSuccess: () => {
      toast.success("Lender updated successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      setIsDialogOpen(false);
      setEditingLender(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update lender: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/lenders/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("Lender deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/lenders"] });
      setDeletingLender(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete lender: ${error.message}`);
    },
  });

  const handleSubmit = (data: InsertLender) => {
    // Convert empty strings to undefined for optional fields
    const cleanedData = {
      ...data,
      contactName: data.contactName || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      website: data.website || undefined,
      notes: data.notes || undefined,
    };

    if (editingLender) {
      updateMutation.mutate({ id: editingLender.id, data: cleanedData });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (lender: Lender) => {
    setEditingLender(lender);
    form.reset({
      institutionName: lender.institutionName,
      contactName: lender.contactName || "",
      email: lender.email,
      phone: lender.phone || "",
      address: lender.address || "",
      website: lender.website || "",
      notes: lender.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingLender(null);
    form.reset({
      institutionName: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      website: "",
      notes: "",
    });
    setIsDialogOpen(true);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/pipeline")}
              data-testid="button-back"
            >
              ← Back to Pipeline
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold mb-2" data-testid="text-page-title">
                Lender Database
              </h2>
              <p className="text-muted-foreground" data-testid="text-page-description">
                Manage your network of lending institutions and contacts
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAdd} data-testid="button-add-lender">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lender
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]" data-testid="dialog-lender">
                <DialogHeader>
                  <DialogTitle>
                    {editingLender ? "Edit Lender" : "Add New Lender"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingLender
                      ? "Update the lender's information"
                      : "Add a new lending institution to your database"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="institutionName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Institution Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Barclays Business Finance"
                              data-testid="input-institution-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., John Smith"
                              data-testid="input-contact-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="email@example.com"
                                data-testid="input-email"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="+44 20 1234 5678"
                                data-testid="input-phone"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any additional information about this lender..."
                              className="resize-none"
                              rows={3}
                              data-testid="input-notes"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsDialogOpen(false);
                          setEditingLender(null);
                          form.reset();
                        }}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-submit"
                      >
                        {editingLender ? "Update" : "Add"} Lender
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive mb-2">Failed to load lenders</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "An error occurred"}
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Loading lenders...</p>
            </CardContent>
          </Card>
        ) : lenders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No lenders yet</h3>
              <p className="text-muted-foreground mb-4">
                Start building your lender database to streamline loan applications
              </p>
              <Button onClick={handleAdd} data-testid="button-add-first-lender">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Lender
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your Lenders ({lenders.length})</CardTitle>
              <CardDescription>
                Manage your network of lending institutions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institution</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lenders.map((lender) => (
                    <TableRow key={lender.id} data-testid={`row-lender-${lender.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {lender.institutionName}
                        </div>
                      </TableCell>
                      <TableCell>{lender.contactName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <a
                            href={`mailto:${lender.email}`}
                            className="text-primary hover:underline"
                            data-testid={`link-email-${lender.id}`}
                          >
                            {lender.email}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lender.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {lender.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(lender)}
                            data-testid={`button-edit-${lender.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingLender(lender)}
                            data-testid={`button-delete-${lender.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingLender}
        onOpenChange={(open) => !open && setDeletingLender(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lender?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingLender?.institutionName}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLender && deleteMutation.mutate(deletingLender.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
