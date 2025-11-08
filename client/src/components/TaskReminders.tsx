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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Urgent Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {urgentTasks.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No urgent tasks</p>
              <p className="text-xs">You're all caught up!</p>
            </div>
          ) : (
            urgentTasks.map((task, index) => {
              const { label, variant, icon: Icon } = getDueDateLabel(new Date(task.dueDate!));
              
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
                    <Badge variant="outline" className="text-xs">
                      {getProspectName(task.prospectId)}
                    </Badge>
                    <Badge variant={variant} className="text-xs">
                      <Icon className="h-3 w-3 mr-1" />
                      {label}
                    </Badge>
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
