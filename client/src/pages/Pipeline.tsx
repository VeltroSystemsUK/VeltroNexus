import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import PipelineStats from "@/components/PipelineStats";
import PipelineColumn from "@/components/PipelineColumn";
import ProspectCard, {
  type ProspectCardData,
  type UnderwritingStatus,
} from "@/components/ProspectCard";
import SafeProspectCard from "@/components/SafeProspectCard";
import EmptyPipeline from "@/components/EmptyPipeline";
import ActivityCalendar from "@/components/ActivityCalendar";
import ToDoList from "@/components/ToDoList";
import TaskReminders from "@/components/TaskReminders";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, LayoutDashboard, Users, Send, Download, Building2, Plus, Menu } from "lucide-react"; // Added Menu
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // AddedDropdownMenu
import type { ProspectWithCompany } from "@shared/schema";
import ProspectLimitModal from "@/components/ProspectLimitModal";
import { OnboardingChecklist, OnboardingTooltip, useOnboarding } from "@/components/onboarding";

import { DEFAULT_STAGES, type PipelineStage } from "./Settings";

type Stage = string;

import { usePageTitle, usePageActions } from "@/context/LayoutContext";
import { FlightDeck } from "@/components/dashboard/FlightDeck";

// ... existing imports

export default function Pipeline() {
  const [, navigate] = useLocation();

  const actions = useMemo(() => (
    <Button
      className="hidden md:flex bg-primary hover:bg-primary/90 text-primary-foreground"
      onClick={() => navigate("/search")}
      data-testid="button-add-prospect"
    >
      <Plus className="mr-2 h-4 w-4" />
      Add Prospect
    </Button>
  ), [navigate]);

  usePageTitle("PIPELINE DASHBOARD", "Manage your commercial lending pipeline");
  usePageActions(actions);
  const { user, isAuthenticated, isLoading: isAuthLoading, logoutMutation } = useAuth();
  const {
    currentWalkthrough,
    walkthroughStep,
    nextWalkthroughStep,
    skipWalkthrough
  } = useOnboarding();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const tabOptions = [
    { id: "dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, color: "bg-primary" },
    { id: "prospect-pipeline", label: "Prospect Pipeline", shortLabel: "Prospects", icon: Users, color: "bg-primary" },
    { id: "process-pipeline", label: "Process Pipeline", shortLabel: "Process", icon: Send, color: "bg-primary" },
  ];

  // Compute dynamic stages from user settings
  const { allStages, prospectStages, processStages, finalStages } = useMemo(() => {
    let stages: { id: string; label: string; color?: string }[] = DEFAULT_STAGES;

    if (user?.pipelineStageNames) {
      if (Array.isArray(user.pipelineStageNames)) {
        stages = user.pipelineStageNames;
      } else {
        // Legacy object support
        stages = DEFAULT_STAGES.map(s => ({
          ...s,
          label: user.pipelineStageNames[s.id] || s.label
        }));
      }
    }

    const prospectIds = ["lead", "contacted", "qualified"];
    const finalIds = ["approved", "declined", "withdrawn"];

    return {
      allStages: stages.map(s => ({ value: s.id, label: s.label })),
      prospectStages: stages
        .filter(s => prospectIds.includes(s.id))
        .map(s => ({ value: s.id, label: s.label })),
      processStages: stages
        .filter(s => !prospectIds.includes(s.id) && !finalIds.includes(s.id))
        .map(s => ({ value: s.id, label: s.label })),
      finalStages: stages
        .filter(s => finalIds.includes(s.id))
        .map(s => ({ value: s.id, label: s.label }))
    };
  }, [user]);

  useEffect(() => {
    const pendingTier = sessionStorage.getItem("subscription_tier");
    if (pendingTier && isAuthenticated) {
      navigate("/pricing");
    }
  }, [isAuthenticated, navigate]);

  const {
    data: prospects = [],
    isLoading,
    error,
  } = useQuery<ProspectWithCompany[]>({
    queryKey: ["/api/prospects"],
    queryFn: () => api.prospects.list(),
    enabled: isAuthenticated,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Filter out any invalid prospects to prevent crashes
  const safeProspects = useMemo(() => {
    if (!Array.isArray(prospects)) return [];
    return prospects.filter(p => p && p.id && (p.company || (p as any).companyName));
  }, [prospects]);

  const prospectLimit = (user as any)?.prospectLimit || 10;
  const subscriptionTier = (user as any)?.subscriptionTier || "free";

  const sortedProspectIds = useMemo(() => {
    return prospects
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      .map((p) => p.id);
  }, [prospects]);

  const isProspectOverLimit = (prospectId: number) => {
    const index = sortedProspectIds.indexOf(prospectId);
    return index >= prospectLimit;
  };

  // Fetch underwriting statuses for all prospects
  const { data: underwritingStatuses = {} } = useQuery<Record<number, UnderwritingStatus>>({
    queryKey: ["/api/underwriting/status"],
    enabled: isAuthenticated,
  });

  // Fetch due diligence status summaries for pipeline cards
  const { data: dueDiligenceStatuses = {} } = useQuery<Record<number, 'complete' | 'partial' | 'pending'>>({
    queryKey: ["/api/due-diligence/summaries"],
    enabled: isAuthenticated,
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ prospectId, stage }: { prospectId: number; stage: string }) =>
      api.prospects.updateStage(prospectId, stage),
    onSuccess: (_, { stage }) => {
      let message = "Stage updated successfully";

      // Contextual message for tab transitions
      if (["lead", "contacted", "qualified"].includes(stage)) {
        message = "Moved to Prospect Pipeline tab";
      } else if (["approved", "declined", "withdrawn"].includes(stage)) {
        message = "Moved to Final Outcomes";
      } else {
        message = "Moved to Process Pipeline tab";
      }

      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update stage: ${error.message}`);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ stage, orderedIds }: { stage: string; orderedIds: number[] }) =>
      apiRequest("/api/prospects/reorder", "POST", { stage, orderedIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder: ${error.message}`);
    },
  });

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    const prospectId = parseInt(draggableId.replace("prospect-", ""));
    const sourceStage = source.droppableId as Stage;
    const destStage = destination.droppableId as Stage;

    if (sourceStage === destStage) {
      const stageProspects = getProspectsByStage(sourceStage);
      const newOrder = [...stageProspects];
      const [removed] = newOrder.splice(source.index, 1);
      newOrder.splice(destination.index, 0, removed);

      const orderedIds = newOrder.map((p) => p.id!);
      reorderMutation.mutate({ stage: sourceStage, orderedIds });
      return;
    }

    updateStageMutation.mutate({ prospectId, stage: destStage });
  };

  const handleStageChange = (prospectId: number, newStage: Stage) => {
    updateStageMutation.mutate({ prospectId, stage: newStage });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const getProspectsByStage = (stage: Stage) => {
    return safeProspects
      .filter((p) => p.stage === stage)
      .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0));
  };

  const getTotalValueByStage = (stage: Stage) => {
    const stageProspects = getProspectsByStage(stage);
    const total = stageProspects.reduce((sum, p) => sum + (p.loanAmount || 0), 0);
    return total > 0 ? formatCurrency(total) : undefined;
  };

  const totalValue = prospects.reduce((sum, p) => sum + (p.loanAmount || 0), 0);
  const activeProspects = prospects.filter(
    (p) => !["approved", "declined", "withdrawn"].includes(p.stage)
  ).length;
  const approvedCount = prospects.filter((p) => p.stage === "approved").length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isIndexError = errorMessage.includes('FAILED_PRECONDITION') || errorMessage.includes('requires an index');

    if (isIndexError) {
      // Show a friendly message for index creation
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <div className="animate-pulse mb-4">
              <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
            <p className="text-lg font-semibold mb-2">Setting up your database...</p>
            <p className="text-muted-foreground text-sm mb-4">
              We're creating the necessary database indexes. This usually takes 1-2 minutes.
            </p>
            <p className="text-xs text-muted-foreground">
              Please refresh the page in a moment.
            </p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    // For other errors, show a generic error
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <p className="text-destructive font-semibold mb-2">Unable to load pipeline</p>
          <p className="text-muted-foreground text-sm mb-4">
            There was an issue loading your data. Please try refreshing the page.
          </p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-24 md:pb-28">
      <main className="w-full px-4 md:px-6 py-6 md:py-10 space-y-6">

        {prospects.length === 0 ? (
          <EmptyPipeline onAddProspect={() => navigate("/search")} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-testid="tabs-main">

            {/* Mobile View: Hamburger Menu */}
            <div className="md:hidden flex items-center justify-between bg-muted/50 p-2 rounded-lg mb-4">
              <div className="flex items-center gap-2 pl-2">
                {(() => {
                  const current = tabOptions.find(t => t.id === activeTab);
                  const Icon = current?.icon || LayoutDashboard;
                  return (
                    <>
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{current?.label}</span>
                    </>
                  );
                })()}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  {tabOptions.map((tab) => (
                    <DropdownMenuItem key={tab.id} onClick={() => setActiveTab(tab.id)}>
                      <tab.icon className="mr-2 h-4 w-4" />
                      {tab.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <TabsList
              className="hidden md:grid w-full grid-cols-3 mb-6 md:mb-10 h-12 md:h-14 bg-muted/50 p-1 gap-1"
              data-testid="tabs-list"
            >
              {tabOptions.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`text-xs md:text-base py-2 md:py-3 gap-1 md:gap-2.5 data-[state=active]:${tab.color} data-[state=active]:text-white ${tab.id === 'dashboard' ? 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground' : ''}`}
                  data-testid={`tab-${tab.id}`}
                >
                  <tab.icon className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" data-testid="content-dashboard">
              <FlightDeck
                userName={user?.firstName || undefined}
                stats={{
                  totalProspects: prospects.length,
                  activeProspects,
                  totalValue: formatCurrency(totalValue),
                  approvedCount,
                }}
                stages={allStages
                  .filter((s) => !["approved", "declined", "withdrawn"].includes(s.value))
                  .map((s) => ({
                    label: s.label,
                    count: getProspectsByStage(s.value).length,
                    value: getTotalValueByStage(s.value),
                  }))}
              />
            </TabsContent>

            {/* Prospect Pipeline Tab */}
            <TabsContent value="prospect-pipeline" data-testid="content-prospect-pipeline">
              <div className="space-y-4 md:space-y-8">
                <div>
                  <h3 className="text-lg md:text-2xl font-semibold mb-1 md:mb-2 tracking-tight">
                    Early Stage Pipeline
                  </h3>
                  <p className="text-muted-foreground text-sm md:text-base">
                    Track prospects from lead to qualification
                  </p>
                </div>
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 md:grid md:grid-cols-3 md:gap-4 md:pb-0 md:mx-0 md:px-0 scrollbar-hide">
                    {prospectStages.map((stage) => {
                      const stageProspects = getProspectsByStage(stage.value);
                      const totalValue = getTotalValueByStage(stage.value);

                      return (
                        <Droppable key={stage.value} droppableId={stage.value}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="min-w-[85vw] md:min-w-0 snap-center">
                              <PipelineColumn
                                title={stage.label}
                                count={stageProspects.length}
                                totalValue={totalValue}
                                isDraggingOver={snapshot.isDraggingOver}
                              >
                                {(stageProspects || []).filter(Boolean).map((prospect, index) => {
                                  return (
                                    <Draggable
                                      key={prospect.id!}
                                      draggableId={`prospect-${prospect.id!}`}
                                      index={index}
                                    >
                                      {(provided, snapshot) => (
                                        <div ref={provided.innerRef} {...provided.draggableProps}>
                                          <SafeProspectCard
                                            prospect={prospect}
                                            dragHandleProps={provided.dragHandleProps}
                                            isDragging={snapshot.isDragging}
                                            currentStage={stage.value}
                                            availableStages={allStages}
                                            onClick={() => navigate(`/prospect/${prospect.id!}`)}
                                            onMove={(newStage: Stage) =>
                                              handleStageChange(prospect.id!, newStage as Stage)
                                            }
                                            underwritingStatus={underwritingStatuses[prospect.id!]}
                                            dueDiligenceStatus={dueDiligenceStatuses[prospect.id!]}
                                            isOverLimit={isProspectOverLimit(prospect.id!)}
                                            onLimitClick={() => setShowLimitModal(true)}
                                            queuePosition={index + 1}
                                          />
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {provided.placeholder}
                              </PipelineColumn>
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>
                </DragDropContext>
              </div>
            </TabsContent>

            {/* Process Pipeline Tab */}
            <TabsContent value="process-pipeline" data-testid="content-process-pipeline">
              <div className="space-y-4 md:space-y-8">
                <div>
                  <h3 className="text-lg md:text-2xl font-semibold mb-1 md:mb-2 tracking-tight">
                    Application Processing
                  </h3>
                  <p className="text-muted-foreground text-sm md:text-base">
                    Manage applications from proposal to submission
                  </p>
                </div>
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="space-y-4 md:space-y-8">
                    {/* Active Process Stages */}
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 md:grid md:grid-cols-3 md:gap-4 md:pb-0 md:mx-0 md:px-0 scrollbar-hide">
                      {processStages.map((stage) => {
                        const stageProspects = getProspectsByStage(stage.value);
                        const totalValue = getTotalValueByStage(stage.value);

                        return (
                          <Droppable key={stage.value} droppableId={stage.value}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.droppableProps} className="min-w-[85vw] md:min-w-0 snap-center">
                                <PipelineColumn
                                  title={stage.label}
                                  count={stageProspects.length}
                                  totalValue={totalValue}
                                  isDraggingOver={snapshot.isDraggingOver}
                                >
                                  {stageProspects.map((prospect, index) => {
                                    return (
                                      <Draggable
                                        key={prospect.id}
                                        draggableId={`prospect-${prospect.id}`}
                                        index={index}
                                      >
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps}>
                                            <SafeProspectCard
                                              prospect={prospect}
                                              dragHandleProps={provided.dragHandleProps}
                                              isDragging={snapshot.isDragging}
                                              currentStage={stage.value}
                                              availableStages={allStages}
                                              onClick={() => navigate(`/prospect/${prospect.id!}`)}
                                              onMove={(newStage: Stage) =>
                                                handleStageChange(prospect.id!, newStage as Stage)
                                              }
                                              underwritingStatus={underwritingStatuses[prospect.id!]}
                                              dueDiligenceStatus={dueDiligenceStatuses[prospect.id!]}
                                              isOverLimit={isProspectOverLimit(prospect.id!)}
                                              onLimitClick={() => setShowLimitModal(true)}
                                              queuePosition={index + 1}
                                            />
                                          </div>
                                        )}
                                      </Draggable>
                                    );
                                  })}
                                  {provided.placeholder}
                                </PipelineColumn>
                              </div>
                            )}
                          </Droppable>
                        );
                      })}
                    </div>

                    {/* Final Outcomes */}
                    <div>
                      <h3 className="text-lg md:text-2xl font-semibold mb-4 md:mb-6 tracking-tight">
                        Final Outcomes
                      </h3>
                      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 md:grid md:grid-cols-3 md:gap-5 md:pb-0 md:mx-0 md:px-0 scrollbar-hide">
                        {finalStages.map((stage) => {
                          const stageProspects = getProspectsByStage(stage.value);
                          const totalValue = getTotalValueByStage(stage.value);

                          return (
                            <Droppable key={stage.value} droppableId={stage.value}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className="min-w-[85vw] md:min-w-0 snap-center">
                                  <PipelineColumn
                                    title={stage.label}
                                    count={stageProspects.length}
                                    totalValue={totalValue}
                                    isDraggingOver={snapshot.isDraggingOver}
                                  >
                                    {stageProspects.map((prospect, index) => {
                                      return (
                                        <Draggable
                                          key={prospect.id}
                                          draggableId={`prospect-${prospect.id}`}
                                          index={index}
                                        >
                                          {(provided, snapshot) => (
                                            <div
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                            >
                                              <SafeProspectCard
                                                prospect={prospect}
                                                dragHandleProps={provided.dragHandleProps}
                                                isDragging={snapshot.isDragging}
                                                currentStage={stage.value}
                                                availableStages={allStages}
                                                onClick={() => navigate(`/prospect/${prospect.id!}`)}
                                                onMove={(newStage: Stage) =>
                                                  handleStageChange(prospect.id!, newStage as Stage)
                                                }
                                                underwritingStatus={
                                                  underwritingStatuses[prospect.id!]
                                                }
                                                dueDiligenceStatus={dueDiligenceStatuses[prospect.id!]}
                                                isOverLimit={isProspectOverLimit(prospect.id!)}
                                                onLimitClick={() => setShowLimitModal(true)}
                                                queuePosition={index + 1}
                                              />
                                            </div>
                                          )}
                                        </Draggable>
                                      );
                                    })}
                                    {provided.placeholder}
                                  </PipelineColumn>
                                </div>
                              )}
                            </Droppable>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </DragDropContext>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>

      <ProspectLimitModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        currentCount={prospects.length}
        limit={prospectLimit}
        subscriptionTier={subscriptionTier}
      />
    </div>
  );
}
