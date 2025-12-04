import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar as CalendarIcon, AlertCircle, ListTodo, Video, Phone, FileText } from "lucide-react";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";

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

export default function TaskReminders() {
  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const { data: prospects = [] } = useQuery<ProspectWithCompany[]>({
    queryKey: ["/api/prospects"],
  });

  const getProspectName = (prospectId: number) => {
    const prospect = prospects.find((p) => p.id === prospectId);
    return prospect?.company.companyName || "Unknown";
  };

  const getDueDateLabel = (dueDate: Date) => {
    if (isPast(dueDate) && !isToday(dueDate)) {
      const days = Math.abs(differenceInDays(dueDate, new Date()));
      return {
        label: `${days} day${days > 1 ? 's' : ''} overdue`,
        variant: "destructive" as const,
        icon: AlertCircle,
      };
    }
    if (isToday(dueDate)) {
      return {
        label: "Due today",
        variant: "default" as const,
        icon: AlertCircle,
      };
    }
    if (isTomorrow(dueDate)) {
      return {
        label: "Due tomorrow",
        variant: "secondary" as const,
        icon: CalendarIcon,
      };
    }
    return {
      label: format(dueDate, "MMM d, yyyy"),
      variant: "outline" as const,
      icon: CalendarIcon,
    };
  };

  // Get top 3 most urgent incomplete tasks
  const urgentTasks = activities
    .filter((activity) => activity.completed !== 1 && activity.dueDate)
    .sort((a, b) => {
      const dateA = new Date(a.dueDate!);
      const dateB = new Date(b.dueDate!);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 3);

  return (
    <Card data-testid="card-task-reminders">
      <CardHeader className="pb-4 pt-5 px-5">
        <CardTitle className="flex items-center gap-2.5 text-lg">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          Urgent Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-3">
          {urgentTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No urgent tasks</p>
              <p className="text-sm mt-1">You're all caught up!</p>
            </div>
          ) : (
            urgentTasks.map((task, index) => {
              const activityDate = new Date(task.dueDate!);
              const { label, variant, icon: Icon } = getDueDateLabel(activityDate);
              const hasTime = activityDate.getHours() !== 0 || activityDate.getMinutes() !== 0;
              
              const TypeIcon = activityTypeIcons[task.activityType as keyof typeof activityTypeIcons] || ListTodo;
              
              return (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border hover-elevate"
                  data-testid={`urgent-task-${index}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`
                        flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                        ${variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : ''}
                        ${variant === 'default' ? 'bg-primary text-primary-foreground' : ''}
                        ${variant === 'secondary' ? 'bg-secondary text-secondary-foreground' : ''}
                        ${variant === 'outline' ? 'bg-muted text-muted-foreground' : ''}
                      `}>
                        {index + 1}
                      </div>
                      <TypeIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <h4 className="font-medium text-sm">{task.title}</h4>
                    </div>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.prospectId && (
                      <Badge variant="outline" className="text-xs">
                        {getProspectName(task.prospectId)}
                      </Badge>
                    )}
                    <Badge variant={variant} className="text-xs">
                      <Icon className="h-3 w-3 mr-1" />
                      {label}
                      {hasTime && ` ${format(activityDate, "HH:mm")}`}
                    </Badge>
                    {task.priority && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          task.priority === "urgent"
                            ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20"
                            : task.priority === "high"
                            ? "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20"
                            : task.priority === "medium"
                            ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20"
                            : "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
                        }`}
                      >
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
