import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import logoChrome from "@assets/logo-chrome.png";
import PipelineStats from "@/components/PipelineStats";
import PipelineColumn from "@/components/PipelineColumn";
import ProspectCard, {
  type ProspectCardData,
  type UnderwritingStatus,
} from "@/components/ProspectCard";
import SafeProspectCard from "@/components/SafeProspectCard";
import EmptyPipeline from "@/components/EmptyPipeline";
import ThemeToggle from "@/components/ThemeToggle";
import ActivityCalendar from "@/components/ActivityCalendar";
import ToDoList from "@/components/ToDoList";
import TaskReminders from "@/components/TaskReminders";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TrendingUp, LayoutDashboard, Users, Send, Download, Building2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import type { ProspectWithCompany } from "@shared/schema";
import ProspectLimitModal from "@/components/ProspectLimitModal";
import { OnboardingChecklist, OnboardingTooltip, useOnboarding } from "@/components/onboarding";

import { DEFAULT_STAGES, type PipelineStage } from "./Settings";

type Stage = string;

export default function Pipeline() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: isAuthLoading, logoutMutation } = useAuth();
  const {
    currentWalkthrough,
    walkthroughStep,
    nextWalkthroughStep,
    skipWalkthrough
  } = useOnboarding();
  const [showLimitModal, setShowLimitModal] = useState(false);

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
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="border-b border-[#1e293b] bg-[#0f172a] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-5 flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4">
            {user?.brandingLogoUrl ? (
              <div className="flex flex-col items-start">
                <img
                  src={user.brandingLogoUrl}
                  alt="Company logo"
                  className="max-h-10 md:max-h-12 max-w-32 md:max-w-48 object-contain"
                  data-testid="img-custom-logo"
                />
                <p className="text-[10px] text-gray-400">Powered by Veltro</p>
              </div>
            ) : (
              <img
                src={logoChrome}
                alt="Veltro"
                className="h-8 md:h-10 object-contain"
                data-testid="img-logo-nav"
              />
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              size="icon"
              className="md:hidden h-9 w-9 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => navigate("/search")}
              data-testid="button-add-prospect-mobile"
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
            <OnboardingTooltip
              isActive={currentWalkthrough === "lead" && walkthroughStep === 0}
              title="Start Here"
              message="Click here to create your first prospect and see Veltro's AI in action."
              step={1}
              totalSteps={4}
              onSkip={skipWalkthrough}
              position="bottom"
            >
              <Button
                size="lg"
                className="hidden md:flex bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => navigate("/search")}
                data-testid="button-add-prospect"
              >
                Add Prospect
              </Button>
            </OnboardingTooltip>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-gray-300 hover:text-white hover:bg-white/10"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={user?.profileImageUrl || undefined}
                      alt={user?.firstName || "User"}
                      style={{ objectFit: "cover" }}
                    />
                    <AvatarFallback className="text-base font-medium">
                      {user?.firstName?.[0] || user?.email?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-3">
                  <p className="font-semibold text-base">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-muted-foreground text-sm">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <div className="px-3 py-3">
                  <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide font-medium">
                    Subscription
                  </p>
                  <p className="font-semibold text-base capitalize">
                    {user?.subscriptionTier || "Free"} Plan
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {prospects.length} / {user?.prospectLimit || 10} prospects used
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate("/profile")}
                  className="py-2.5 text-base"
                  data-testid="menu-item-profile"
                >
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/settings")}
                  className="py-2.5 text-base"
                  data-testid="menu-item-settings"
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/lenders")}
                  className="py-2.5 text-base"
                  data-testid="menu-item-lenders"
                >
                  Lender Database
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/submissions")}
                  className="py-2.5 text-base"
                  data-testid="menu-item-submissions"
                >
                  Submissions
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logoutMutation.mutate()}
                  className="py-2.5 text-base"
                  data-testid="menu-item-logout"
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="mb-6 md:mb-10">
          <h2
            className="md:text-4xl font-bold mb-2 md:mb-3 tracking-tight text-[32px]"
            data-testid="text-page-title"
          >
            Pipeline Dashboard
          </h2>
          <p
            className="text-sm md:text-lg text-muted-foreground"
            data-testid="text-page-description"
          >
            Manage your commercial lending pipeline
          </p>
        </div>

        {prospects.length === 0 ? (
          <EmptyPipeline onAddProspect={() => navigate("/search")} />
        ) : (
          <Tabs defaultValue="dashboard" className="w-full" data-testid="tabs-main">
            <TabsList
              className="grid w-full grid-cols-3 mb-6 md:mb-10 h-12 md:h-14"
              data-testid="tabs-list"
            >
              <TabsTrigger
                value="dashboard"
                className="text-xs md:text-base py-2 md:py-3 gap-1 md:gap-2.5"
                data-testid="tab-dashboard"
              >
                <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5" />
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Home</span>
              </TabsTrigger>
              <TabsTrigger
                value="prospect-pipeline"
                className="text-xs md:text-base py-2 md:py-3 gap-1 md:gap-2.5"
                data-testid="tab-prospect-pipeline"
              >
                <Users className="h-4 w-4 md:h-5 md:w-5" />
                <span className="hidden sm:inline">Prospect Pipeline</span>
                <span className="sm:hidden">Prospects</span>
              </TabsTrigger>
              <TabsTrigger
                value="process-pipeline"
                className="text-xs md:text-base py-2 md:py-3 gap-1 md:gap-2.5"
                data-testid="tab-process-pipeline"
              >
                <Send className="h-4 w-4 md:h-5 md:w-5" />
                <span className="hidden sm:inline">Process Pipeline</span>
                <span className="sm:hidden">Process</span>
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" data-testid="content-dashboard">
              <div className="space-y-6 md:space-y-10">
                {/* Onboarding Checklist - Only appears if onboarding incomplete */}
                <OnboardingChecklist className="mb-2" />

                {/* Headline Metrics */}
                <div>
                  <h3 className="text-lg md:text-2xl font-semibold mb-4 md:mb-6 tracking-tight">
                    Overview
                  </h3>
                  <PipelineStats
                    totalProspects={prospects.length}
                    activeProspects={activeProspects}
                    totalValue={formatCurrency(totalValue)}
                    approvedCount={approvedCount}
                  />
                </div>

                {/* CRM Features */}
                <div>
                  <h3 className="text-lg md:text-2xl font-semibold mb-4 md:mb-6 tracking-tight">
                    Activity Management
                  </h3>
                  <div className="space-y-4 md:space-y-6">
                    <div className="w-full">
                      <ActivityCalendar />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                      <TaskReminders />
                      <ToDoList />
                    </div>
                  </div>
                </div>

                {/* Quick Stage Summary */}
                <div>
                  <h3 className="text-lg md:text-2xl font-semibold mb-4 md:mb-6 tracking-tight">
                    Stage Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-5">
                    {allStages.filter(
                      (s) => !["approved", "declined", "withdrawn"].includes(s.value)
                    ).map((stage) => {
                      const count = getProspectsByStage(stage.value).length;
                      const totalValue = getTotalValueByStage(stage.value);
                      return (
                        <Card key={stage.value} className="hover-elevate">
                          <CardHeader className="pb-1 md:pb-2 pt-3 md:pt-5 px-3 md:px-5">
                            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              {stage.label}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="px-3 md:px-5 pb-3 md:pb-5">
                            <div className="text-2xl md:text-4xl font-bold tracking-tight">
                              {count}
                            </div>
                            {totalValue && (
                              <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2">
                                {totalValue}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
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
