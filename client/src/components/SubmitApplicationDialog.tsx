import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Lender } from "@shared/schema";
import { Loader2 } from "lucide-react";

const submitApplicationSchema = z.object({
  lenderId: z.string().min(1, "Please select a lender"),
  commentary: z.string().optional(),
});

type SubmitApplicationForm = z.infer<typeof submitApplicationSchema>;

interface SubmitApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: number;
  companyName: string;
}

export default function SubmitApplicationDialog({
  open,
  onOpenChange,
  prospectId,
  companyName,
}: SubmitApplicationDialogProps) {
  const { data: lenders = [], isLoading: isLoadingLenders } = useQuery<Lender[]>({
    queryKey: ["/api/lenders"],
    enabled: open,
  });

  const form = useForm<SubmitApplicationForm>({
    resolver: zodResolver(submitApplicationSchema),
    defaultValues: {
      lenderId: "",
      commentary: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitApplicationForm) => {
      const response = await apiRequest(
        "/api/submissions",
        "POST",
        {
          prospectId,
          lenderId: parseInt(data.lenderId),
          commentary: data.commentary || undefined,
        }
      );
      return response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: result.emailSent ? "Application sent via email" : "Application submitted",
        description: result.emailSent 
          ? "The application has been emailed to the lender with a PDF attachment and logged as a task."
          : "The application has been submitted but email delivery failed. Please contact the lender directly.",
        variant: result.emailSent ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SubmitApplicationForm) => {
    submitMutation.mutate(data);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        // Prevent closing during submission
        if (!submitMutation.isPending) {
          onOpenChange(isOpen);
        }
      }}
    >
      <DialogContent 
        className="sm:max-w-[525px]" 
        data-testid="dialog-submit-application"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside during submission
          if (submitMutation.isPending) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          // Prevent closing when interacting outside during submission
          if (submitMutation.isPending) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Submit Application</DialogTitle>
          <DialogDescription>
            Submit the loan application for {companyName} to a lender. This action will be logged as a task.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lenderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Lender</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoadingLenders}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-lender">
                        <SelectValue placeholder={isLoadingLenders ? "Loading lenders..." : "Choose a lender"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lenders.length === 0 && !isLoadingLenders ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No lenders available. Add lenders in the Lender Database.
                        </div>
                      ) : (
                        lenders.map((lender) => (
                          <SelectItem
                            key={lender.id}
                            value={lender.id.toString()}
                            data-testid={`select-lender-option-${lender.id}`}
                          >
                            {lender.institutionName}
                            {lender.contactName && ` - ${lender.contactName}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="commentary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commentary (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes or commentary about this submission..."
                      className="resize-none"
                      rows={4}
                      data-testid="textarea-commentary"
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenChange(false);
                }}
                disabled={submitMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitMutation.isPending || lenders.length === 0}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                data-testid="button-submit-application"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
