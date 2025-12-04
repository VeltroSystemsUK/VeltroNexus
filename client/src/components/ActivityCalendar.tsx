import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, ListTodo, Video, Phone, FileText, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertActivitySchema, type InsertActivity } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface ProspectWithCompany {
  id: number;
  company: {
    companyName: string;
  };
}

const activityFormSchema = z.object({
  prospectId: z.number().int().positive().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  activityType: z.enum(["task", "event", "meeting", "call", "note"]).default("task"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.date().optional(),
  dueTime: z.string().optional(),
  completed: z.number().int().min(0).max(1).default(0),
});

type ActivityFormData = z.infer<typeof activityFormSchema>;

const activityTypeIcons = {
  task: ListTodo,
  event: CalendarIcon,
  meeting: Video,
  call: Phone,
  note: FileText,
};

const activityTypeColors = {
  task: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  event: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  meeting: "bg-green-500/10 text-green-700 dark:text-green-300",
  call: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  note: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
};

export default function ActivityCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const { data: prospects = [] } = useQuery<ProspectWithCompany[]>({
    queryKey: ["/api/prospects"],
  });

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      title: "",
      description: "",
      activityType: "task",
      priority: "medium",
      dueDate: undefined,
      dueTime: "",
      completed: 0,
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: ActivityFormData) => {
      let combinedDateTime = null;
      if (data.dueDate) {
        combinedDateTime = new Date(data.dueDate);
        if (data.dueTime) {
          const [hours, minutes] = data.dueTime.split(':');
          combinedDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }
      }
      
      const payload = {
        title: data.title,
        description: data.description,
        activityType: data.activityType,
        priority: data.priority,
        prospectId: data.prospectId,
        completed: data.completed,
        dueDate: combinedDateTime ? combinedDateTime.toISOString() : null,
      };
      return await apiRequest("/api/activities", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "Activity created",
        description: "Your activity has been added to the calendar.",
      });
      setShowCreateDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create activity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDateClick = (day: Date) => {
    setSelectedDate(day);
    form.setValue("dueDate", day);
    setShowCreateDialog(true);
  };

  const onSubmit = (data: ActivityFormData) => {
    createActivityMutation.mutate(data);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getActivitiesForDay = (day: Date) => {
    return activities.filter((activity) => {
      if (!activity.dueDate) return false;
      return isSameDay(new Date(activity.dueDate), day);
    });
  };

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <>
      <Card data-testid="card-activity-calendar">
        <CardHeader className="pb-4 pt-5 px-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={previousMonth}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-base font-semibold min-w-[140px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-7 gap-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="text-xs font-medium text-muted-foreground text-center p-2"
              >
                {day}
              </div>
            ))}
            
            {/* Empty cells for days before month starts */}
            {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}
            
            {days.map((day) => {
              const dayActivities = getActivitiesForDay(day);
              const hasActivities = dayActivities.length > 0;
              
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDateClick(day)}
                  className={`
                    relative min-h-[70px] p-2 border rounded-md cursor-pointer
                    ${!isSameMonth(day, currentMonth) ? "text-muted-foreground bg-muted/30" : ""}
                    ${isToday(day) ? "border-primary border-2 bg-primary/5" : ""}
                    hover-elevate active-elevate-2
                  `}
                  data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-medium">
                      {format(day, "d")}
                    </div>
                    <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                  {hasActivities && (
                    <div className="space-y-1">
                      {dayActivities.slice(0, 2).map((activity) => {
                        const Icon = activityTypeIcons[activity.activityType as keyof typeof activityTypeIcons] || ListTodo;
                        const colorClass = activityTypeColors[activity.activityType as keyof typeof activityTypeColors] || activityTypeColors.task;
                        const activityDate = activity.dueDate ? new Date(activity.dueDate) : null;
                        const hasTime = activityDate && (activityDate.getHours() !== 0 || activityDate.getMinutes() !== 0);
                        const priorityColor = activity.priority === "urgent"
                          ? "border-l-red-500"
                          : activity.priority === "high"
                          ? "border-l-orange-500"
                          : activity.priority === "medium"
                          ? "border-l-yellow-500"
                          : "border-l-green-500";
                        
                        return (
                          <div
                            key={activity.id}
                            className={`text-xs truncate px-1.5 py-0.5 rounded flex items-center gap-1 border-l-2 ${colorClass} ${priorityColor}`}
                            title={`${activity.title}${hasTime ? ` - ${format(activityDate, 'HH:mm')}` : ''} [${activity.priority}]`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Icon className="h-3 w-3 flex-shrink-0" />
                            {activity.completed === 1 && (
                              <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                            )}
                            {hasTime && (
                              <span className="font-medium">{format(activityDate, 'HH:mm')}</span>
                            )}
                            <span className="truncate">{activity.title}</span>
                          </div>
                        );
                      })}
                      {dayActivities.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayActivities.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ListTodo className="h-3 w-3" />
              <span>Task</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Video className="h-3 w-3" />
              <span>Meeting</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              <span>Call</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-3 w-3" />
              <span>Event</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-activity">
          <DialogHeader>
            <DialogTitle>Create New Activity</DialogTitle>
            <DialogDescription>
              Add a task, event, meeting, call, or note for {selectedDate && format(selectedDate, "MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="activityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-activity-type">
                          <SelectValue placeholder="Select activity type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="task">
                          <div className="flex items-center gap-2">
                            <ListTodo className="h-4 w-4" />
                            Task
                          </div>
                        </SelectItem>
                        <SelectItem value="event">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Event
                          </div>
                        </SelectItem>
                        <SelectItem value="meeting">
                          <div className="flex items-center gap-2">
                            <Video className="h-4 w-4" />
                            Meeting
                          </div>
                        </SelectItem>
                        <SelectItem value="call">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Call
                          </div>
                        </SelectItem>
                        <SelectItem value="note">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Note
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-activity-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="time"
                        data-testid="input-activity-time"
                      />
                    </FormControl>
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
                        placeholder="e.g., Client meeting, Follow-up call"
                        data-testid="input-activity-title"
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
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Add details about this activity..."
                        data-testid="input-activity-description"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prospectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Prospect (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-activity-prospect">
                          <SelectValue placeholder="Select a prospect (optional)" />
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

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  data-testid="button-cancel-activity"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createActivityMutation.isPending}
                  data-testid="button-submit-activity"
                >
                  {createActivityMutation.isPending ? "Creating..." : "Create Activity"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
