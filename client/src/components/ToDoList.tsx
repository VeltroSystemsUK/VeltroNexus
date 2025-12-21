import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  ListTodo,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Video,
  Phone,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

interface Activity {
  id: number;
  prospectId: number;
  title: string;
  description: string | null;
  activityType: string;
  priority: string;
  dueDate: Date | null;
  completed: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const activityTypeIcons = {
  task: ListTodo,
  event: CalendarIcon,
  meeting: Video,
  call: Phone,
  note: FileText,
};

interface ProspectWithCompany {
  id: number;
  company: {
    companyName: string;
  };
}

const activitySchema = z.object({
  prospectId: z.number().int().positive(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

export default function ToDoList() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const { data: prospects = [] } = useQuery<ProspectWithCompany[]>({
    queryKey: ["/api/prospects"],
  });

  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: "",
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: z.infer<typeof activitySchema>) => {
      const payload = {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      };
      const response = await apiRequest(
        `/api/prospects/${data.prospectId}/activities`,
        "POST",
        payload
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast.success("Task created successfully");
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: number }) => {
      const response = await apiRequest(`/api/activities/${id}`, "PATCH", { completed });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/activities/${id}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast.success("Task deleted");
    },
  });

  const onSubmit = (data: z.infer<typeof activitySchema>) => {
    createActivityMutation.mutate(data);
  };

  const getProspectName = (prospectId: number) => {
    const prospect = prospects.find((p) => p.id === prospectId);
    return prospect?.company.companyName || "Unknown";
  };

  const sortedActivities = [...activities].sort((a, b) => {
    if (a.completed === 1 && b.completed !== 1) return 1;
    if (a.completed !== 1 && b.completed === 1) return -1;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <Card data-testid="card-todo-list">
      <CardHeader className="pb-4 pt-5 px-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
              <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            To Do List
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-task">
                <Plus className="h-5 w-5 mr-1.5" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="prospectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prospect</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-prospect">
                              <SelectValue placeholder="Select a prospect" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {prospects.map((prospect) => (
                              <SelectItem key={prospect.id} value={prospect.id.toString()}>
                                {prospect.company.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Task title"
                            data-testid="input-task-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Task description (optional)"
                            data-testid="input-task-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-task-due-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="button-submit-task">
                      Create Task
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {sortedActivities.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ListTodo className="h-14 w-14 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No tasks yet</p>
              <p className="text-sm mt-1">Create your first task!</p>
            </div>
          ) : (
            sortedActivities.map((activity) => (
              <div
                key={activity.id}
                className={`
                  flex items-start gap-3 p-3 rounded-lg border hover-elevate
                  ${activity.completed === 1 ? "opacity-60" : ""}
                `}
                data-testid={`task-item-${activity.id}`}
              >
                <Checkbox
                  checked={activity.completed === 1}
                  onCheckedChange={(checked) =>
                    toggleCompleteMutation.mutate({
                      id: activity.id,
                      completed: checked ? 1 : 0,
                    })
                  }
                  data-testid={`checkbox-task-${activity.id}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon =
                          activityTypeIcons[
                            activity.activityType as keyof typeof activityTypeIcons
                          ] || ListTodo;
                        return <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
                      })()}
                      <h4
                        className={`font-medium ${activity.completed === 1 ? "line-through" : ""}`}
                      >
                        {activity.title}
                      </h4>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteActivityMutation.mutate(activity.id)}
                      data-testid={`button-delete-task-${activity.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {activity.prospectId && (
                      <Badge variant="outline" className="text-xs">
                        {getProspectName(activity.prospectId)}
                      </Badge>
                    )}
                    {activity.dueDate &&
                      (() => {
                        const activityDate = new Date(activity.dueDate);
                        const hasTime =
                          activityDate.getHours() !== 0 || activityDate.getMinutes() !== 0;
                        return (
                          <Badge variant="secondary" className="text-xs">
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {format(activityDate, "MMM d, yyyy")}
                            {hasTime && ` ${format(activityDate, "HH:mm")}`}
                          </Badge>
                        );
                      })()}
                    {activity.priority && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          activity.priority === "urgent"
                            ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20"
                            : activity.priority === "high"
                              ? "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20"
                              : activity.priority === "medium"
                                ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20"
                                : "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
                        }`}
                      >
                        {activity.priority.charAt(0).toUpperCase() + activity.priority.slice(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
