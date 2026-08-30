import { PageHeader } from "@/components/PageHeader";
import {
  DigitalAssociate,
  AgentWorkflow,
  AgentChatMessage,
  AssociateStatus,
} from "@shared/agents";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Brain,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  BarChart3,
  MessageSquare,
  Activity,
  ArrowUpRight,
  Monitor,
  Loader2,
  SendHorizontal,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  FileText,
  ListChecks,
  Plus,
  ClipboardList,
  History,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentJobProgress } from "@/components/AgentJobProgress";
import { DealFilesPanel } from "@/components/agentic/DealFilesPanel";
import { DeskOpsPanel } from "@/components/agentic/DeskOpsPanel";
import { DelegateDialog } from "@/components/agentic/DelegateDialog";
import { FactoryCanvas } from "@/components/agentic/FactoryCanvas";
import { DeskFunctionsPanel } from "@/components/agentic/DeskFunctionsPanel";
import { ProcessCanvas } from "@/components/process-canvas";
import { graphToWorkflow, workflowToGraph } from "@shared/processGraph";

export default function Workforce() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateAgentId, setDelegateAgentId] = useState<string | undefined>();
  const [workforceTab, setWorkforceTab] = useState("deals");
  const [chatHistory, setChatHistory] = useState<
    { role: "user" | "agent"; content: string; timestamp?: Date }[]
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Create New Agent Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({
    name: "",
    role: "",
    department: "Sales & Growth",
    description: "",
    expertise: "" as string | string[],
    tools: "",
  });

  // Load chat history when agent is selected
  const { data: chatHistoryData, isLoading: isLoadingChats } = useQuery<AgentChatMessage[]>({
    queryKey: ["/api/workforce", selectedAgentId, "chats"],
    enabled: !!selectedAgentId,
    queryFn: async () => {
      if (!selectedAgentId) return [];
      const res = await apiRequest(`/api/workforce/${selectedAgentId}/chats`, "GET");
      return res.json();
    },
  });

  // Update chat history when data loads
  useEffect(() => {
    if (chatHistoryData && selectedAgentId) {
      setChatHistory(
        chatHistoryData.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
        }))
      );
    }
  }, [chatHistoryData, selectedAgentId]);

  // Edit / Delete state
  const [editingAgent, setEditingAgent] = useState<DigitalAssociate | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<DigitalAssociate | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", department: "", description: "" });

  const editMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DigitalAssociate> }) => {
      const res = await apiRequest(`/api/workforce/${id}`, "PUT", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce"] });
      setEditingAgent(null);
      toast({ title: "Agent Updated", description: "Agent configuration saved." });
    },
    onError: (error: any) => {
      const isRateLimit =
        error.message?.includes("429") ||
        error.message?.includes("RESOURCE_EXHAUSTED") ||
        error.message?.includes("AI service temporarily unavailable");

      if (isRateLimit) {
        // Show error in chat history
        setChatHistory((prev) => [
          ...prev,
          {
            role: "agent",
            content:
              "⚠️ AI service temporarily unavailable due to high demand. Please wait a few minutes and try again.",
          },
        ]);
        toast({
          title: "AI Service Unavailable",
          description:
            "The AI service is currently at capacity. Please wait a few minutes and try again.",
          variant: "destructive",
          duration: 8000,
        });
      } else {
        setChatHistory((prev) => [
          ...prev,
          {
            role: "agent",
            content: `❌ Error: ${error.message || "The agent encountered an error."}`,
          },
        ]);
        toast({
          title: "Execution Failed",
          description: error.message || "The agent encountered an error.",
          variant: "destructive",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/workforce/${id}`, "DELETE");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce"] });
      setDeletingAgent(null);
      toast({ title: "Agent Deleted", description: "Agent has been removed from the roster." });
    },
    onError: (error: any) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleEditOpen = (agent: DigitalAssociate) => {
    setEditingAgent(agent);
    setEditForm({
      name: agent.name,
      role: typeof agent.role === "string" ? agent.role : "",
      department: agent.department,
      description: typeof agent.description === "string" ? agent.description : "",
    });
  };

  const handleEditSave = () => {
    if (!editingAgent) return;
    editMutation.mutate({
      id: editingAgent.id,
      updates: {
        name: editForm.name,
        role: editForm.role,
        department: editForm.department,
        description: editForm.description,
      },
    });
  };

  // Workflow editor state
  const [workflowAgentId, setWorkflowAgentId] = useState<string | null>(null);
  const [workflowDraft, setWorkflowDraft] = useState<AgentWorkflow>({
    jobDescription: "",
    responsibilities: [],
    tasks: [],
  });
  const [newResponsibility, setNewResponsibility] = useState("");

  const openWorkflowEditor = (agent: DigitalAssociate) => {
    setWorkflowAgentId(agent.id);
    setWorkflowDraft(
      agent.workflow ?? {
        jobDescription: "",
        responsibilities: [],
        tasks: [],
      }
    );
  };

  const workflowMutation = useMutation({
    mutationFn: async ({ id, workflow }: { id: string; workflow: AgentWorkflow }) => {
      const res = await apiRequest(`/api/workforce/${id}`, "PUT", { workflow });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce"] });
      setWorkflowAgentId(null);
      toast({ title: "Workflow Saved", description: "Agent workflow has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    },
  });

  const addResponsibility = () => {
    if (!newResponsibility.trim()) return;
    setWorkflowDraft((prev) => ({
      ...prev,
      responsibilities: [...prev.responsibilities, newResponsibility.trim()],
    }));
    setNewResponsibility("");
  };

  const removeResponsibility = (index: number) => {
    setWorkflowDraft((prev) => ({
      ...prev,
      responsibilities: prev.responsibilities.filter((_, i) => i !== index),
    }));
  };

  const { data: roster, isLoading } = useQuery<DigitalAssociate[]>({
    queryKey: ["/api/workforce"],
  });

  const selectedAgent = roster?.find((a) => a.id === selectedAgentId);
  const workflowAgent = roster?.find((a) => a.id === workflowAgentId);

  const runMutation = useMutation({
    mutationFn: async ({ agentId, instruction }: { agentId: string; instruction: string }) => {
      const res = await apiRequest(`/api/workforce/${agentId}/run`, "POST", { instruction });
      return res.json();
    },
    onSuccess: (data) => {
      setChatHistory((prev) => [
        ...prev,
        { role: "agent", content: data.response, timestamp: new Date() },
      ]);
      queryClient.invalidateQueries({ queryKey: ["/api/workforce", selectedAgentId, "chats"] });
    },
    onError: (error: any) => {
      const isRateLimit =
        error.message?.includes("429") ||
        error.message?.includes("RESOURCE_EXHAUSTED") ||
        error.message?.includes("AI service temporarily unavailable");

      if (isRateLimit) {
        // Show error in chat history
        setChatHistory((prev) => [
          ...prev,
          {
            role: "agent",
            content:
              "⚠️ AI service temporarily unavailable due to high demand. Please wait a few minutes and try again.",
            timestamp: new Date(),
          },
        ]);
        toast({
          title: "AI Service Unavailable",
          description:
            "The AI service is currently at capacity. Please wait a few minutes and try again.",
          variant: "destructive",
          duration: 8000,
        });
      } else {
        setChatHistory((prev) => [
          ...prev,
          {
            role: "agent",
            content: `❌ Error: ${error.message || "The agent encountered an error."}`,
            timestamp: new Date(),
          },
        ]);
        toast({
          title: "Execution Failed",
          description: error.message || "The agent encountered an error.",
          variant: "destructive",
        });
      }
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest(`/api/workforce/${agentId}/chats`, "DELETE");
      return res.json();
    },
    onSuccess: () => {
      setChatHistory([]);
      queryClient.invalidateQueries({ queryKey: ["/api/workforce", selectedAgentId, "chats"] });
      toast({ title: "Chat Cleared", description: "Conversation history has been cleared." });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Clear Chat",
        description: error.message || "Could not clear chat history.",
        variant: "destructive",
      });
    },
  });

  // Create New Agent Mutation
  const createAgentMutation = useMutation({
    mutationFn: async (agentData: Partial<DigitalAssociate>) => {
      const res = await apiRequest("/api/workforce", "POST", agentData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce"] });
      setIsCreateModalOpen(false);
      setNewAgentForm({
        name: "",
        role: "",
        department: "Sales & Growth",
        description: "",
        expertise: "",
        tools: "",
      });
      toast({ title: "Agent Created", description: "New agent has been added to the workforce." });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Agent",
        description: error.message || "Could not create new agent.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSend = () => {
    if (!instruction.trim() || !selectedAgentId || runMutation.isPending) return;

    const currentInstruction = instruction;
    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: currentInstruction, timestamp: new Date() },
    ]);
    setInstruction("");
    runMutation.mutate({ agentId: selectedAgentId, instruction: currentInstruction });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-white/5 rounded-lg w-1/3"></div>
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-5 h-48 bg-white/5 rounded-xl">
                <div className="w-48 h-full bg-white/5 rounded-l-xl" />
                <div className="flex-1 p-5 space-y-3">
                  <div className="h-5 bg-white/5 rounded w-1/4" />
                  <div className="h-3 bg-white/5 rounded w-1/6" />
                  <div className="h-4 bg-white/5 rounded w-3/4 mt-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-[#020617] text-white",
        workforceTab === "strategy" ? "h-[calc(100dvh-4rem)] overflow-hidden" : "h-full"
      )}
    >
      <PageHeader
        title="AI Workforce"
        description="Deal files is the factory. Desks show open files, mail that actually left the box, and work waiting on you."
      >
        <Button
          onClick={() => {
            setDelegateAgentId(undefined);
            setDelegateOpen(true);
          }}
        >
          Delegate
        </Button>
      </PageHeader>
      <DelegateDialog
        open={delegateOpen}
        onOpenChange={setDelegateOpen}
        initialAgentId={delegateAgentId}
      />

      <main
        className={cn(
          "flex-1 p-6",
          workforceTab === "strategy" ? "min-h-0 flex flex-col overflow-hidden" : "overflow-y-auto"
        )}
      >
        <Tabs
          value={workforceTab}
          onValueChange={setWorkforceTab}
          className={cn(workforceTab === "strategy" ? "flex-1 min-h-0 flex flex-col gap-4" : "space-y-6")}
        >
          <div className="flex items-center justify-between">
            <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto">
              <TabsTrigger value="deals" className="data-[state=active]:bg-primary">
                Deal files
              </TabsTrigger>
              <TabsTrigger value="roster" className="data-[state=active]:bg-primary">
                Desks
              </TabsTrigger>
              <TabsTrigger value="functions" className="data-[state=active]:bg-primary">
                Functions
              </TabsTrigger>
              <TabsTrigger value="strategy" className="data-[state=active]:bg-primary">
                Strategy
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-primary">
                Jobs
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="deals">
            <DealFilesPanel />
          </TabsContent>

          <TabsContent value="roster" className="space-y-4">
            <DeskOpsPanel
              onDelegate={(agentId) => {
                setDelegateAgentId(agentId);
                setDelegateOpen(true);
              }}
            />
            <div className="hidden">
            <div className="flex flex-col gap-4">
              {roster?.map((agent) => (
                <Card
                  key={agent.id}
                  className="bg-slate-900 border-slate-800 overflow-hidden hover:border-primary/50 transition-all duration-300 group"
                >
                  <div className="flex flex-col md:flex-row items-stretch">
                    {/* Profile Picture Section */}
                    <div className="relative flex-shrink-0 w-full md:w-48 h-48 md:h-auto bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center overflow-hidden">
                      <div className="relative">
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/60 to-primary/20 blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                        <Avatar className="relative h-28 w-28 border-2 border-primary/30 shadow-2xl shadow-primary/10 group-hover:border-primary/60 transition-all duration-300">
                          <AvatarImage src={agent.avatar} className="object-cover" />
                          <AvatarFallback className="text-3xl font-bold bg-slate-800 text-primary">
                            {agent.name[0]}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      {/* Status indicator */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 md:bottom-4">
                        <div className="flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-slate-700/50">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                          <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                            String(agent.status).toLowerCase().includes("hibernat")
                              ? "text-slate-400"
                              : "text-emerald-400"
                          }`}>
                            {String(agent.status).toLowerCase().includes("hibernat") ? "Hibernated" : "Desk"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 flex flex-col md:flex-row p-5 gap-5">
                      {/* Info Column */}
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              {agent.name}
                              {agent.aresCertification?.status === "certified" && (
                                <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
                              )}
                            </h3>
                            <p className="text-sm text-slate-400">{agent.role as string}</p>
                            {typeof agent.email === "string" && agent.email && (
                              <p className="text-xs text-primary mt-1">{agent.email}</p>
                            )}
                          </div>
                          <Badge className="flex-shrink-0 bg-slate-800/80 border-slate-700 text-[10px] uppercase font-bold tracking-widest text-slate-300">
                            {agent.department}
                          </Badge>
                        </div>

                        <p className="text-sm text-slate-300/80 leading-relaxed">
                          {agent.description as string}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {(Array.isArray(agent.expertise)
                            ? (agent.expertise as string[])
                            : []
                          ).map((skill) => (
                            <Badge
                              key={skill}
                              variant="secondary"
                              className="bg-slate-800/60 text-slate-400 border border-slate-700/50 text-xs hover:bg-slate-700/60 hover:text-slate-300 transition-colors"
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Scores & Action Column */}
                      <div className="flex flex-col gap-3 md:w-56 flex-shrink-0">
                        <div className="space-y-2.5 bg-slate-950/40 rounded-xl p-3.5 border border-slate-800/50">
                          {agent.scores.map((score) => (
                            <div key={score.subject} className="space-y-1">
                              <div className="flex justify-between text-[10px] uppercase font-semibold">
                                <span className="text-slate-500">{score.subject}</span>
                                <span className="text-primary/80">{score.A}%</span>
                              </div>
                              <Progress value={score.A} className="h-1 bg-slate-800" />
                            </div>
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          className="w-full border-slate-700 hover:bg-primary/10 hover:border-primary/50 hover:text-white text-slate-300 transition-all duration-200"
                          disabled={String(agent.status).toLowerCase().includes("hibernat")}
                          onClick={() => {
                            setSelectedAgentId(agent.id);
                            setChatHistory([]);
                          }}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          {String(agent.status).toLowerCase().includes("hibernat") ? "Hibernated" : "Chat (not the factory)"}
                          <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-50" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-slate-700 hover:bg-emerald-950/30 hover:border-emerald-800/50 text-slate-400 hover:text-emerald-400 transition-all"
                          onClick={() => openWorkflowEditor(agent)}
                        >
                          <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                          Workflow
                          {agent.workflow && agent.workflow.tasks.length > 0 && (
                            <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-0 text-[9px] px-1.5">
                              {agent.workflow.tasks.length}
                            </Badge>
                          )}
                        </Button>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                            onClick={() => handleEditOpen(agent)}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-slate-700 hover:bg-red-950/50 hover:border-red-800 text-slate-400 hover:text-red-400 transition-all"
                            onClick={() => setDeletingAgent(agent)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            </div>
          </TabsContent>

          {/* Interaction Overlay */}
          {selectedAgent && (
            <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col rounded-xl overflow-hidden animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-800">
                      <AvatarImage src={selectedAgent.avatar} />
                      <AvatarFallback>{selectedAgent.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-sm">{selectedAgent.name}</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Active Session • {selectedAgent.role as string}
                        {chatHistory.length > 0 && (
                          <span className="ml-2 text-emerald-400">
                            • {chatHistory.length} messages
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {chatHistory.length > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-slate-400 hover:text-red-400"
                        onClick={() => {
                          if (confirm("Clear this conversation history?")) {
                            clearChatMutation.mutate(selectedAgent.id);
                          }
                        }}
                        disabled={clearChatMutation.isPending}
                        title="Clear chat history"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setSelectedAgentId(null)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-6">
                  <div ref={scrollRef} className="space-y-6">
                    {isLoadingChats && (
                      <div className="flex items-center justify-center py-8 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span className="text-sm">Loading conversation history...</span>
                      </div>
                    )}
                    {chatHistory.length === 0 && !isLoadingChats && (
                      <div className="text-center py-12 px-6">
                        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Brain className="h-8 w-8 text-primary" />
                        </div>
                        <h4 className="font-bold mb-2">Direct Interaction Mode</h4>
                        <p className="text-sm text-slate-400 max-w-xs mx-auto">
                          You are now securely connected to {selectedAgent.name}. Issue instructions
                          or requests for analysis.
                        </p>
                        <p className="text-xs text-slate-500 mt-4">
                          Previous conversations will appear here
                        </p>
                      </div>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex flex-col max-w-[85%]",
                          msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-tr-none shadow-lg shadow-primary/10"
                              : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-xl shadow-black/20"
                          )}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold px-1 flex items-center gap-2">
                          {msg.role === "user" ? "Direct Command" : selectedAgent.name}
                          {msg.timestamp && (
                            <span className="text-slate-600 font-normal">
                              {new Date(msg.timestamp).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    {runMutation.isPending && (
                      <div className="flex items-start gap-2 text-slate-500 animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-medium">
                          Processing Agent Intelligence...
                        </span>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-4 bg-slate-950/50 border-t border-slate-800">
                  <div className="relative flex items-center">
                    <textarea
                      id="agent-instruction"
                      name="agentInstruction"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={`Instruct ${selectedAgent.name}...`}
                      autoComplete="off"
                      className="w-full bg-slate-900 border-slate-800 rounded-xl px-4 py-3 pr-12 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none min-h-[50px] max-h-[150px]"
                    />
                    <Button
                      size="icon"
                      disabled={!instruction.trim() || runMutation.isPending}
                      onClick={handleSend}
                      className="absolute right-2 h-8 w-8 rounded-lg"
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-2 text-center">
                    Direct commands are audited for logic drift and mission integrity.
                  </p>
                </div>
              </div>
            </div>
          )}

          <TabsContent value="functions" className="space-y-4">
            <DeskFunctionsPanel />
          </TabsContent>

          <TabsContent value="strategy" className="mt-0 flex-1 min-h-0">
            {workforceTab === "strategy" && <FactoryCanvas />}
          </TabsContent>

          <TabsContent value="activity">
            <AgentJobProgress refreshInterval={2000} />
          </TabsContent>
        </Tabs>

        {/* Edit Agent Modal */}
        {editingAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditingAgent(null)}
            />
            <div className="relative bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Edit Agent</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => setEditingAgent(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="edit-name"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Name
                  </label>
                  <input
                    id="edit-name"
                    name="editName"
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-role"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Role
                  </label>
                  <input
                    id="edit-role"
                    name="editRole"
                    type="text"
                    value={editForm.role}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-department"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Department
                  </label>
                  <input
                    id="edit-department"
                    name="editDepartment"
                    type="text"
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, department: e.target.value }))
                    }
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-description"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    name="editDescription"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-800 text-slate-300"
                  onClick={() => setEditingAgent(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={handleEditSave}
                  disabled={editMutation.isPending}
                >
                  {editMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setDeletingAgent(null)}
            />
            <div className="relative bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Delete Agent</h2>
              <p className="text-sm text-slate-400 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-bold text-white">{deletingAgent.name}</span>? This action
                cannot be undone.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-800 text-slate-300"
                  onClick={() => setDeletingAgent(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => deleteMutation.mutate(deletingAgent.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Delete Agent
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Editor Modal */}
        {workflowAgentId && workflowAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setWorkflowAgentId(null)}
            />
            <div className="relative bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-6xl h-[min(900px,90vh)] flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Workflow Editor</h2>
                    <p className="text-xs text-slate-500">
                      {workflowAgent.name} &mdash; {workflowAgent.role as string}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => setWorkflowAgentId(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4 p-4 border-b border-slate-800 shrink-0 max-h-[240px] overflow-y-auto">
                <div>
                  <label
                    htmlFor="workflow-job-desc"
                    className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2"
                  >
                    <FileText className="h-3.5 w-3.5" /> Job Description
                  </label>
                  <textarea
                    id="workflow-job-desc"
                    name="workflowJobDesc"
                    value={workflowDraft.jobDescription}
                    onChange={(e) =>
                      setWorkflowDraft((prev) => ({ ...prev, jobDescription: e.target.value }))
                    }
                    rows={3}
                    placeholder="Describe the agent's overall purpose and scope of work..."
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none resize-none"
                  />
                </div>

                {/* Responsibilities */}
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    <ListChecks className="h-3.5 w-3.5" /> Responsibilities (
                    {workflowDraft.responsibilities.length})
                  </label>
                  <div className="space-y-2 mb-3">
                    {workflowDraft.responsibilities.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 group">
                        <span className="text-[10px] font-mono text-slate-600 w-5 text-right">
                          {i + 1}.
                        </span>
                        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300">
                          {r}
                        </div>
                        <button
                          onClick={() => removeResponsibility(i)}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      id="new-responsibility"
                      name="newResponsibility"
                      type="text"
                      value={newResponsibility}
                      onChange={(e) => setNewResponsibility(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addResponsibility();
                        }
                      }}
                      placeholder="Add a responsibility..."
                      autoComplete="off"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/50 outline-none"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-800"
                      onClick={addResponsibility}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                </div>

              </div>
              <div className="flex-1 min-h-0 p-4 pt-3">
                <ProcessCanvas
                  key={workflowAgentId}
                  variant="workflow"
                  initialNodes={workflowToGraph(workflowDraft).nodes}
                  initialEdges={workflowToGraph(workflowDraft).edges}
                  onPersist={({ nodes, edges }) =>
                    setWorkflowDraft((prev) => graphToWorkflow(prev, nodes, edges))
                  }
                />
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-800 flex gap-3 flex-shrink-0">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-800 text-slate-300"
                  onClick={() => setWorkflowAgentId(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() =>
                    workflowMutation.mutate({ id: workflowAgentId, workflow: workflowDraft })
                  }
                  disabled={workflowMutation.isPending}
                >
                  {workflowMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Workflow
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Create New Agent Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsCreateModalOpen(false)}
            />
            <div className="relative bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Train New Agent</h2>
                    <p className="text-xs text-slate-500">Create a new digital employee</p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="agent-name"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Agent Name
                  </label>
                  <input
                    id="agent-name"
                    name="agentName"
                    type="text"
                    value={newAgentForm.name}
                    onChange={(e) => setNewAgentForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Maya, Oscar, Leo"
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="agent-role"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Role
                  </label>
                  <input
                    id="agent-role"
                    name="agentRole"
                    type="text"
                    value={newAgentForm.role}
                    onChange={(e) => setNewAgentForm((prev) => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g. Sales Agent, Credit Analyst"
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="agent-department"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Department
                  </label>
                  <select
                    id="agent-department"
                    name="agentDepartment"
                    value={newAgentForm.department}
                    onChange={(e) =>
                      setNewAgentForm((prev) => ({ ...prev, department: e.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  >
                    <option value="Sales & Growth">Sales & Growth</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Legal & Compliance">Legal & Compliance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Technology">Technology</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="agent-description"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Description
                  </label>
                  <textarea
                    id="agent-description"
                    name="agentDescription"
                    value={newAgentForm.description}
                    onChange={(e) =>
                      setNewAgentForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="What does this agent do?"
                    rows={3}
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="agent-expertise"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Expertise (comma-separated)
                  </label>
                  <input
                    id="agent-expertise"
                    name="agentExpertise"
                    type="text"
                    value={newAgentForm.expertise}
                    onChange={(e) =>
                      setNewAgentForm((prev) => ({ ...prev, expertise: e.target.value }))
                    }
                    placeholder="e.g. Lead Generation, Credit Analysis, Financial Modeling"
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="agent-tools"
                    className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                  >
                    Tools (comma-separated)
                  </label>
                  <input
                    id="agent-tools"
                    name="agentTools"
                    type="text"
                    value={newAgentForm.tools}
                    onChange={(e) =>
                      setNewAgentForm((prev) => ({ ...prev, tools: e.target.value }))
                    }
                    placeholder="e.g. Email Client, CRM, Excel, Slack"
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">
                    <strong className="text-white">Quick Start:</strong> The agent will be created
                    with default settings. You can customize its workflow and tasks after creation.
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Default hourly rate: £0 (internal use) • Status: Available
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-800 text-slate-300"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createAgentMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => {
                    const expertiseArray = newAgentForm.expertise
                      ? String(newAgentForm.expertise)
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                      : [];
                    const toolsArray = newAgentForm.tools
                      ? newAgentForm.tools
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                      : [];

                    createAgentMutation.mutate({
                      name: newAgentForm.name,
                      role: newAgentForm.role,
                      department: newAgentForm.department,
                      description: newAgentForm.description,
                      expertise: expertiseArray,
                      tools: toolsArray,
                      hourlyRate: 0,
                      status: AssociateStatus.AVAILABLE,
                      avatar: `https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=400`,
                      scores: [
                        { subject: "Accuracy", A: 85, fullMark: 100 },
                        { subject: "Speed", A: 80, fullMark: 100 },
                      ],
                      voiceEnabled: false,
                    });
                  }}
                  disabled={
                    createAgentMutation.isPending ||
                    !newAgentForm.name.trim() ||
                    !newAgentForm.role.trim()
                  }
                >
                  {createAgentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create Agent
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
