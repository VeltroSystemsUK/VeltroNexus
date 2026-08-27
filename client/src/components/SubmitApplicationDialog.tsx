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
import { useLocation } from "wouter";
import type { Lender } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { AttachmentsChecklistForm } from "@/components/AttachmentsChecklistForm";

export const STRATA_LENDER_VALUE = "strata";

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
  const [, setLocation] = useLocation();
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

  const selectedLender = form.watch("lenderId");
  const sendingToStrata = selectedLender === STRATA_LENDER_VALUE;

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitApplicationForm) => {
      if (data.lenderId === STRATA_LENDER_VALUE) {
        const response = await apiRequest("/api/underwriting/submissions", "POST", {
          prospectId,
          priority: "normal",
          destination: "strata",
          brokerComments: data.commentary || undefined,
        });
        return { destination: "strata" as const, ...(await response.json()) };
      }
      const submission = await apiRequest("/api/submissions", "POST", {
        prospectId,
        lenderId: Number(data.lenderId),
        commentary: data.commentary || undefined,
      });
      return { destination: "lender" as const, ...(await submission.json()) };
    },
    onSuccess: (result: any) => {
      if (result.destination === "strata") {
        toast({
          title: "Sent to Underwriting Inbox",
          description: "Open it there to start Strata and copy the Nexus file across.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/underwriting/submissions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/underwriting/my-submissions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/underwriting/status"] });
        form.reset();
        onOpenChange(false);
        setLocation("/underwriting");
        return;
      } else {
        let description = "The application has been submitted.";
        let variant: "default" | "destructive" = "default";

        if (result.emailSent) {
          description = "The application has been emailed to the lender with a PDF attachment.";
        } else if (result.emailError) {
          description = `Email delivery failed: ${result.emailError}. The submission was created but please contact the lender directly.`;
          variant = "destructive";
        } else {
          description =
            "The application was submitted but email delivery failed. Please contact the lender directly.";
          variant = "destructive";
        }

        toast({
          title: result.emailSent ? "Application sent" : "Application submitted",
          description,
          variant,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/strata-packaging`] });
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (/409/.test(error.message) && sendingToStrata) {
        toast({
          title: "Already in the Underwriting Inbox",
          description: "Open it there to start Strata.",
        });
        onOpenChange(false);
        setLocation("/underwriting");
        return;
      }
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
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
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
          <DialogTitle>Submit to Lender</DialogTitle>
          <DialogDescription>
            {sendingToStrata
              ? `Send ${companyName} to the Underwriting Inbox. From there, open Strata to copy the Nexus file into the pack.`
              : `Submit the loan application for ${companyName} to a lender. This action will be logged as a task.`}
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
                    value={field.value}
                    disabled={isLoadingLenders}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-lender">
                        <SelectValue
                          placeholder={isLoadingLenders ? "Loading lenders..." : "Choose a lender"}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={STRATA_LENDER_VALUE} data-testid="select-lender-option-strata">
                        Strata — CDFI packaging
                      </SelectItem>
                      {lenders.map((lender) => (
                        <SelectItem
                          key={lender.id}
                          value={lender.id!.toString()}
                          data-testid={`select-lender-option-${lender.id!}`}
                        >
                          {lender.institutionName}
                          {lender.contactName && ` - ${lender.contactName}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AttachmentsChecklistForm prospectId={prospectId} compact />

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
                disabled={submitMutation.isPending}
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
                  sendingToStrata ? "Send to Inbox" : "Submit Application"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
