import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/context/LayoutContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, FileText, Send, Eye, Clock, ExternalLink, ArrowUpDown, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportTask {
  id: number;
  title: string;
  notes: string | null;
  timeSlot: string | null;
  dueDate: string | null;
  status: "todo" | "doing" | "done";
  completedAt: string | null;
}

interface ReportSettings {
  recipientName: string;
  recipientEmail: string;
  preparedByName: string;
  projectCode: string;
  executiveSummary: string;
  weekAnchorDate: string;
  weekAnchorNumber: number;
  monthlyFee: string;
  weeklyPayment: string;
  weeklyHours: string;
  autoSendWorksheet: boolean;
  autoSendProgress: boolean;
  skipNextWorksheet: boolean;
  skipNextProgress: boolean;
}

interface ReportLog {
  id: number;
  type: "worksheet" | "progress";
  weekLabel: string;
  recipient: string;
  taskCount: number;
  status: "sent" | "failed" | "skipped";
  sentAt: string | null;
  pdfFile: string | null;
}

type LogSort = "date-desc" | "date-asc" | "type" | "status";

const DEFAULT_SETTINGS: ReportSettings = {
  recipientName: "David Griffiths",
  recipientEmail: "",
  preparedByName: "Shaun Tuhey",
  projectCode: "STRATA-NEXUS-INT-001",
  executiveSummary: "",
  weekAnchorDate: "",
  weekAnchorNumber: 1,
  monthlyFee: "£2,500.00",
  weeklyPayment: "£625.00",
  weeklyHours: "30 hours (6 hours/day, 5 days/week)",
  autoSendWorksheet: true,
  autoSendProgress: true,
  skipNextWorksheet: false,
  skipNextProgress: false,
};

export default function Reporting() {
  usePageTitle("Reporting");
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<ReportTask[]>({
    queryKey: ["/api/reporting/tasks"],
  });

  const { data: settingsData } = useQuery<ReportSettings | null>({
    queryKey: ["/api/reporting/settings"],
  });
  const settings = { ...DEFAULT_SETTINGS, ...(settingsData || {}) };
  const [form, setForm] = useState<ReportSettings | null>(null);
  const active = form || settings;

  const { data: logs = [] } = useQuery<ReportLog[]>({
    queryKey: ["/api/reporting/logs"],
  });
  const [logSort, setLogSort] = useState<LogSort>("date-desc");
  const sortedLogs = [...logs].sort((a, b) => {
    switch (logSort) {
      case "date-asc": return new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime();
      case "type": return a.type.localeCompare(b.type) || new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime();
      case "status": return a.status.localeCompare(b.status) || new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime();
      default: return new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime();
    }
  });

  const createTask = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/reporting/tasks", "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reporting/tasks"] });
      setAddOpen(false);
      setTitle(""); setNotes(""); setTimeSlot(""); setDueDate("");
      toast({ title: "Task added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest(`/api/reporting/tasks/${id}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reporting/tasks"] }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/reporting/tasks/${id}`, "DELETE");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reporting/tasks"] }),
  });

  const runTodoAgent = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/reporting/todo-agent/run", "POST");
      return res.json() as Promise<{ created: ReportTask[] }>;
    },
    onSuccess: ({ created }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reporting/tasks"] });
      toast({
        title: created.length ? `Added ${created.length} task${created.length === 1 ? "" : "s"}` : "Nothing new found",
        description: created.length ? created.map((t) => t.title).join(", ") : "The board already covers what's in the state of play.",
      });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveSettings = useMutation({
    mutationFn: async (data: Partial<ReportSettings>) => {
      const res = await apiRequest("/api/reporting/settings", "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reporting/settings"] });
      setForm(null);
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendNow = useMutation({
    mutationFn: async (type: "worksheet" | "progress") => {
      await apiRequest(`/api/reporting/send-now/${type}`, "POST");
    },
    onSuccess: (_, type) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reporting/logs"] });
      toast({ title: `${type === "worksheet" ? "Worksheet" : "Progress report"} sent` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const grouped = {
    todo: tasks.filter((t) => t.status === "todo"),
    doing: tasks.filter((t) => t.status === "doing"),
    done: tasks.filter((t) => t.status === "done").sort((a, b) =>
      new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
    ),
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reporting</h1>
          <p className="text-sm text-muted-foreground">
            Manage the task board — the Weekly Worksheet (Mon, before 10am) and Weekly Progress Report (Fri, 3pm) generate and send themselves from it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/api/reporting/preview/worksheet", "_blank")}>
            <Eye className="h-4 w-4 mr-1.5" /> Preview worksheet
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("/api/reporting/preview/progress", "_blank")}>
            <Eye className="h-4 w-4 mr-1.5" /> Preview progress
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Task Board</TabsTrigger>
          <TabsTrigger value="settings">Report Settings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* --- Task Board --- */}
        <TabsContent value="tasks" className="space-y-4 mt-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => runTodoAgent.mutate()} disabled={runTodoAgent.isPending}>
              {runTodoAgent.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              Run to-do agent
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add task
            </Button>
          </div>

          {tasksLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {(["todo", "doing", "done"] as const).map((status) => (
                <Card key={status}>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {status === "todo" ? "To do" : status === "doing" ? "In progress" : "Done"} ({grouped[status].length})
                    </p>
                    {grouped[status].length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Nothing here.</p>
                    )}
                    {grouped[status].map((t) => (
                      <div key={t.id} className="flex items-start gap-2 rounded-md border p-2">
                        <Checkbox
                          checked={t.status === "done"}
                          onCheckedChange={(checked) =>
                            updateTask.mutate({ id: t.id, data: { status: checked ? "done" : "todo" } })
                          }
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                          {t.notes && <p className="text-xs text-muted-foreground truncate">{t.notes}</p>}
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {t.dueDate && (
                              <Badge variant="secondary" className="text-[10px]">
                                Due {new Date(t.dueDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                              </Badge>
                            )}
                            {t.timeSlot && (
                              <Badge variant="outline" className="text-[10px]"><Clock className="h-2.5 w-2.5 mr-1" />{t.timeSlot}</Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTask.mutate(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* --- Settings --- */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Recipient name</Label>
                  <Input value={active.recipientName} onChange={(e) => setForm({ ...active, recipientName: e.target.value })} />
                </div>
                <div>
                  <Label>Recipient email</Label>
                  <Input type="email" placeholder="required to enable sending" value={active.recipientEmail} onChange={(e) => setForm({ ...active, recipientEmail: e.target.value })} />
                </div>
                <div>
                  <Label>Prepared by</Label>
                  <Input value={active.preparedByName} onChange={(e) => setForm({ ...active, preparedByName: e.target.value })} />
                </div>
                <div>
                  <Label>Project code</Label>
                  <Input value={active.projectCode} onChange={(e) => setForm({ ...active, projectCode: e.target.value })} />
                </div>
                <div>
                  <Label>Monthly fee</Label>
                  <Input value={active.monthlyFee} onChange={(e) => setForm({ ...active, monthlyFee: e.target.value })} />
                </div>
                <div>
                  <Label>Weekly payment</Label>
                  <Input value={active.weeklyPayment} onChange={(e) => setForm({ ...active, weeklyPayment: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Weekly hours</Label>
                  <Input value={active.weeklyHours} onChange={(e) => setForm({ ...active, weeklyHours: e.target.value })} />
                </div>
                <div>
                  <Label>Week anchor date</Label>
                  <Input type="date" value={active.weekAnchorDate} onChange={(e) => setForm({ ...active, weekAnchorDate: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Any date in a known week, e.g. 31/08/2026.</p>
                </div>
                <div>
                  <Label>Is week number</Label>
                  <Input type="number" min={1} value={active.weekAnchorNumber} onChange={(e) => setForm({ ...active, weekAnchorNumber: parseInt(e.target.value) || 1 })} />
                  <p className="text-xs text-muted-foreground mt-1">Every report's week number is calculated from this automatically.</p>
                </div>
                <div className="md:col-span-2">
                  <Label>Executive summary (worksheet — leave blank to auto-generate)</Label>
                  <Textarea rows={4} value={active.executiveSummary} onChange={(e) => setForm({ ...active, executiveSummary: e.target.value })} />
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-send worksheet — Monday 09:45</p>
                    <p className="text-xs text-muted-foreground">Sends automatically unless "skip next" is on below.</p>
                  </div>
                  <Switch checked={active.autoSendWorksheet} onCheckedChange={(v) => setForm({ ...active, autoSendWorksheet: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Skip next Monday send</p>
                  </div>
                  <Switch checked={active.skipNextWorksheet} onCheckedChange={(v) => setForm({ ...active, skipNextWorksheet: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-send progress report — Friday 15:00</p>
                    <p className="text-xs text-muted-foreground">Sends automatically unless "skip next" is on below.</p>
                  </div>
                  <Switch checked={active.autoSendProgress} onCheckedChange={(v) => setForm({ ...active, autoSendProgress: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Skip next Friday send</p>
                  </div>
                  <Switch checked={active.skipNextProgress} onCheckedChange={(v) => setForm({ ...active, skipNextProgress: v })} />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => sendNow.mutate("worksheet")} disabled={!active.recipientEmail || sendNow.isPending}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Send worksheet now
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => sendNow.mutate("progress")} disabled={!active.recipientEmail || sendNow.isPending}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Send progress report now
                  </Button>
                </div>
                <Button size="sm" onClick={() => saveSettings.mutate(active)} disabled={!form || saveSettings.isPending}>
                  {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- History --- */}
        <TabsContent value="history" className="mt-4 space-y-3">
          <div className="flex justify-end items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={logSort} onValueChange={(v) => setLogSort(v as LogSort)}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest first</SelectItem>
                <SelectItem value="date-asc">Oldest first</SelectItem>
                <SelectItem value="type">Type</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-4 space-y-2">
              {sortedLogs.length === 0 && <p className="text-sm text-muted-foreground italic">No reports sent yet.</p>}
              {sortedLogs.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-md border p-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">{l.type === "worksheet" ? "Operational Worksheet" : "Progress Report"} — {l.weekLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.recipient} · {l.taskCount} task{l.taskCount === 1 ? "" : "s"} · {l.sentAt ? new Date(l.sentAt).toLocaleString("en-GB") : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.pdfFile && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Open document" onClick={() => window.open(`/api/reporting/logs/${l.id}/pdf`, "_blank")}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Badge variant={l.status === "sent" ? "default" : l.status === "skipped" ? "secondary" : "destructive"}>
                      {l.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- Add task dialog --- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Configure API webhooks to Nexus" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label>Time slot (optional)</Label>
                <Input value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} placeholder="09:00 - 11:00" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={!title.trim() || createTask.isPending}
              onClick={() => createTask.mutate({
                title: title.trim(),
                notes: notes.trim() || null,
                timeSlot: timeSlot.trim() || null,
                dueDate: dueDate || null,
                status: "todo",
              })}
            >
              {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
