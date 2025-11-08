import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from "date-fns";

interface Activity {
  id: number;
  prospectId: number;
  title: string;
  description: string | null;
  dueDate: Date | null;
  completed: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function ActivityCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

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
    <Card data-testid="card-activity-calendar">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={previousMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
            const completedCount = dayActivities.filter(a => a.completed === 1).length;
            
            return (
              <div
                key={day.toISOString()}
                className={`
                  relative min-h-[60px] p-2 border rounded-md
                  ${!isSameMonth(day, currentMonth) ? "text-muted-foreground bg-muted/30" : ""}
                  ${isToday(day) ? "border-primary border-2 bg-primary/5" : ""}
                  hover-elevate
                `}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className="text-xs font-medium mb-1">
                  {format(day, "d")}
                </div>
                {hasActivities && (
                  <div className="space-y-1">
                    {dayActivities.slice(0, 2).map((activity) => (
                      <div
                        key={activity.id}
                        className="text-xs truncate bg-primary/10 px-1 py-0.5 rounded flex items-center gap-1"
                        title={activity.title}
                      >
                        {activity.completed === 1 && (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        )}
                        <span className="truncate">{activity.title}</span>
                      </div>
                    ))}
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
        
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-primary/10" />
            <span>Has tasks</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Completed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
