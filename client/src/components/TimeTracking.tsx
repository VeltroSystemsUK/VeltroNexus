import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Play, Square, Plus, Trash2, Timer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { TimeEntry } from "@shared/schema";

interface TimeTrackingProps {
  prospectId: number;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function TimeTracking({ prospectId }: TimeTrackingProps) {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [manualHours, setManualHours] = useState("0");
  const [manualMinutes, setManualMinutes] = useState("30");
  const [manualDescription, setManualDescription] = useState("");
  const [timerDescription, setTimerDescription] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: timeEntries = [], isLoading: entriesLoading, isError: entriesError } = useQuery<TimeEntry[]>({
    queryKey: ["/api/prospects", prospectId, "time-entries"],
  });

  const { data: totalTime, isLoading: totalLoading } = useQuery<{ totalMinutes: number }>({
    queryKey: ["/api/prospects", prospectId, "time-total"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { durationMinutes: number; entryType: string; description?: string; startedAt?: Date; endedAt?: Date }) =>
      apiRequest("POST", `/api/prospects/${prospectId}/time-entries`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "time-total"] });
      toast.success("Time entry added");
    },
    onError: () => {
      toast.error("Failed to add time entry");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/time-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "time-total"] });
      toast.success("Time entry deleted");
    },
    onError: () => {
      toast.error("Failed to delete time entry");
    },
  });

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  const handleStartTimer = () => {
    setTimerStartTime(new Date());
    setTimerSeconds(0);
    setIsTimerRunning(true);
  };

  const handleStopTimer = () => {
    setIsTimerRunning(false);
    setShowStopDialog(true);
  };

  const handleSaveTimerEntry = () => {
    const durationMinutes = Math.max(1, Math.round(timerSeconds / 60));
    createMutation.mutate({
      durationMinutes,
      entryType: "timer",
      description: timerDescription || undefined,
      startedAt: timerStartTime?.toISOString() as unknown as Date,
      endedAt: new Date().toISOString() as unknown as Date,
    });
    setShowStopDialog(false);
    setTimerSeconds(0);
    setTimerStartTime(null);
    setTimerDescription("");
  };

  const handleDiscardTimer = () => {
    setShowStopDialog(false);
    setTimerSeconds(0);
    setTimerStartTime(null);
    setTimerDescription("");
  };

  const handleManualEntry = () => {
    const hours = parseInt(manualHours) || 0;
    const mins = parseInt(manualMinutes) || 0;
    const totalMins = hours * 60 + mins;
    
    if (totalMins < 1) {
      toast.error("Please enter at least 1 minute");
      return;
    }

    createMutation.mutate({
      durationMinutes: totalMins,
      entryType: "manual",
      description: manualDescription || undefined,
    });
    setShowManualDialog(false);
    setManualHours("0");
    setManualMinutes("30");
    setManualDescription("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Time Tracking
          </CardTitle>
          <Badge variant="secondary" className="font-mono" data-testid="badge-total-time">
            {formatDuration(totalTime?.totalMinutes ?? 0)} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {isTimerRunning ? (
            <>
              <div className="flex-1 flex items-center gap-2">
                <Timer className="h-4 w-4 text-green-500 animate-pulse" />
                <span className="font-mono text-lg" data-testid="text-timer-display">
                  {formatElapsed(timerSeconds)}
                </span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopTimer}
                data-testid="button-stop-timer"
              >
                <Square className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleStartTimer}
                className="flex-1"
                data-testid="button-start-timer"
              >
                <Play className="h-4 w-4 mr-1" />
                Start Timer
              </Button>
              <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-add-manual-time">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Time
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Time Entry</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label htmlFor="hours">Hours</Label>
                        <Select value={manualHours} onValueChange={setManualHours}>
                          <SelectTrigger data-testid="select-hours">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...Array(13)].map((_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i}h
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="minutes">Minutes</Label>
                        <Select value={manualMinutes} onValueChange={setManualMinutes}>
                          <SelectTrigger data-testid="select-minutes">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 5, 10, 15, 20, 30, 45].map((m) => (
                              <SelectItem key={m} value={m.toString()}>
                                {m}m
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="manual-description">Description (optional)</Label>
                      <Textarea
                        id="manual-description"
                        value={manualDescription}
                        onChange={(e) => setManualDescription(e.target.value)}
                        placeholder="What did you work on?"
                        data-testid="input-time-description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowManualDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleManualEntry} disabled={createMutation.isPending} data-testid="button-save-time">
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>

        <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Time Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You worked for <span className="font-semibold">{formatElapsed(timerSeconds)}</span>
              </p>
              <div>
                <Label htmlFor="timer-description">Description (optional)</Label>
                <Textarea
                  id="timer-description"
                  value={timerDescription}
                  onChange={(e) => setTimerDescription(e.target.value)}
                  placeholder="What did you work on?"
                  data-testid="input-timer-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleDiscardTimer}>
                Discard
              </Button>
              <Button onClick={handleSaveTimerEntry} disabled={createMutation.isPending} data-testid="button-save-timer">
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {entriesLoading ? (
          <p className="text-sm text-muted-foreground" data-testid="text-loading-entries">Loading...</p>
        ) : entriesError ? (
          <p className="text-sm text-destructive" data-testid="text-entries-error">Failed to load time entries</p>
        ) : timeEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-entries">No time logged yet</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {timeEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
                data-testid={`time-entry-${entry.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {formatDuration(entry.durationMinutes)}
                    </Badge>
                    <Badge variant={entry.entryType === "timer" ? "default" : "secondary"} className="text-xs">
                      {entry.entryType === "timer" ? "Timer" : "Manual"}
                    </Badge>
                  </div>
                  {entry.description && (
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {entry.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(entry.createdAt), "dd MMM yyyy, HH:mm")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(entry.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-time-${entry.id}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
