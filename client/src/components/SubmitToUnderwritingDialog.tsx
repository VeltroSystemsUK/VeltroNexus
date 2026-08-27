import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Send, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AttachmentsChecklistForm } from "@/components/AttachmentsChecklistForm";

const submitToUnderwritingSchema = z.object({
  priority: z.enum(["low", "normal", "high", "urgent"]),
  brokerComments: z.string().optional(),
});

type SubmitToUnderwritingForm = z.infer<typeof submitToUnderwritingSchema>;

interface SubmitToUnderwritingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: number;
  companyName: string;
}

export default function SubmitToUnderwritingDialog({
  open,
  onOpenChange,
  prospectId,
  companyName,
}: SubmitToUnderwritingDialogProps) {
  const form = useForm<SubmitToUnderwritingForm>({
    resolver: zodResolver(submitToUnderwritingSchema),
    defaultValues: {
      priority: "normal",
      brokerComments: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitToUnderwritingForm) => {
      const response = await apiRequest("/api/underwriting/submissions", "POST", {
        prospectId,
        priority: data.priority,
        brokerComments: data.brokerComments || undefined,
      });
      return response;
    },
    onSuccess: () => {
      toast.success("Application submitted to the Underwriting Inbox");
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/underwriting/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/underwriting/my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/underwriting/status"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit application");
    },
  });

  const onSubmit = (data: SubmitToUnderwritingForm) => {
    submitMutation.mutate(data);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!submitMutation.isPending) {
          onOpenChange(isOpen);
          if (!isOpen) {
            form.reset();
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit for Underwriting</DialogTitle>
          <DialogDescription>
            Submit <span className="font-medium">{companyName}</span> to the credit underwriting
            team for review.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Once submitted, a Credit Underwriter will review this application and the
                Strata Packaging Process starts in Underwriting Studio (the standalone Strata
                app still runs separately).
              </AlertDescription>
            </Alert>

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AttachmentsChecklistForm prospectId={prospectId} compact />

            <FormField
              control={form.control}
              name="brokerComments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments for Underwriter (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add any notes or context for the underwriting team..."
                      rows={4}
                      data-testid="input-broker-comments"
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
                onClick={() => onOpenChange(false)}
                disabled={submitMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitMutation.isPending}
                data-testid="button-submit-underwriting"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit for Review
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
