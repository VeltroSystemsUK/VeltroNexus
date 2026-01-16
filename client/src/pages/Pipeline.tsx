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

type Stage =
  | "lead"
  | "contacted"
  | "qualified"
  | "proposal"
  | "due-diligence"
  | "submission"
  | "approved"
  | "declined"
  | "withdrawn";

const PROSPECT_STAGES: { value: Stage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
];

const PROCESS_STAGES: { value: Stage; label: string }[] = [
  { value: "proposal", label: "Proposal" },
  { value: "due-diligence", label: "Due Diligence" },
  { value: "submission", label: "Submission" },
];

const FINAL_STAGES: { value: Stage; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
];

const ALL_STAGES = [...PROSPECT_STAGES, ...PROCESS_STAGES, ...FINAL_STAGES];

export default function Pipeline() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [showLimitModal, setShowLimitModal] = useState(false);

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
    onSuccess: () => {
      toast.success("Stage updated successfully");
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

      const orderedIds = newOrder.map((p) => p.id);
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
    return prospects
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-destructive font-semibold mb-2">Failed to load pipeline</p>
          <p className="text-muted-foreground text-sm mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
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
                <p className="text-[10px] text-muted-foreground">Powered by Veltro</p>
              </div>
            ) : (
              <>
                <div className="h-9 w-9 md:h-11 md:w-11 bg-primary rounded-xl flex items-center justify-center shadow-sm">
                  <Building2 className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1
                    className="text-lg md:text-2xl font-bold italic tracking-tight"
                    data-testid="text-app-title"
                  >
                    VELTRO
                  </h1>
                  <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                    Commercial Lending Platform
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => navigate("/search")}
              data-testid="button-add-prospect-mobile"
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              className="hidden md:flex"
              onClick={() => navigate("/search")}
              data-testid="button-add-prospect"
            >
              Add Prospect
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
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
                  onClick={() => (window.location.href = "/api/logout")}
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
                    {ALL_STAGES.filter(
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    {PROSPECT_STAGES.map((stage) => {
                      const stageProspects = getProspectsByStage(stage.value);
                      const totalValue = getTotalValueByStage(stage.value);

                      return (
                        <Droppable key={stage.value} droppableId={stage.value}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps}>
                              <PipelineColumn
                                title={stage.label}
                                count={stageProspects.length}
                                totalValue={totalValue}
                                isDraggingOver={snapshot.isDraggingOver}
                              >
                                {stageProspects.map((prospect, index) => {
                                  const cardData: ProspectCardData = {
                                    id: prospect.id,
                                    companyName: prospect.company.companyName,
                                    companyNumber: prospect.company.companyNumber,
                                    loanAmount: prospect.loanAmount ?? undefined,
                                    priority: prospect.priority as any,
                                  };

                                  return (
                                    <Draggable
                                      key={prospect.id}
                                      draggableId={`prospect-${prospect.id}`}
                                      index={index}
                                    >
                                      {(provided, snapshot) => (
                                        <div ref={provided.innerRef} {...provided.draggableProps}>
                                          <ProspectCard
                                            prospect={cardData}
                                            dragHandleProps={provided.dragHandleProps}
                                            isDragging={snapshot.isDragging}
                                            currentStage={stage.value}
                                            availableStages={ALL_STAGES}
                                            onClick={() => navigate(`/prospect/${prospect.id}`)}
                                            onMove={(newStage) =>
                                              handleStageChange(prospect.id, newStage as Stage)
                                            }
                                            underwritingStatus={underwritingStatuses[prospect.id]}
                                            dueDiligenceStatus={dueDiligenceStatuses[prospect.id]}
                                            isOverLimit={isProspectOverLimit(prospect.id)}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                      {PROCESS_STAGES.map((stage) => {
                        const stageProspects = getProspectsByStage(stage.value);
                        const totalValue = getTotalValueByStage(stage.value);

                        return (
                          <Droppable key={stage.value} droppableId={stage.value}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.droppableProps}>
                                <PipelineColumn
                                  title={stage.label}
                                  count={stageProspects.length}
                                  totalValue={totalValue}
                                  isDraggingOver={snapshot.isDraggingOver}
                                >
                                  {stageProspects.map((prospect, index) => {
                                    const cardData: ProspectCardData = {
                                      id: prospect.id,
                                      companyName: prospect.company.companyName,
                                      companyNumber: prospect.company.companyNumber,
                                      loanAmount: prospect.loanAmount ?? undefined,
                                      priority: prospect.priority as any,
                                    };

                                    return (
                                      <Draggable
                                        key={prospect.id}
                                        draggableId={`prospect-${prospect.id}`}
                                        index={index}
                                      >
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps}>
                                            <ProspectCard
                                              prospect={cardData}
                                              dragHandleProps={provided.dragHandleProps}
                                              isDragging={snapshot.isDragging}
                                              currentStage={stage.value}
                                              availableStages={ALL_STAGES}
                                              onClick={() => navigate(`/prospect/${prospect.id}`)}
                                              onMove={(newStage) =>
                                                handleStageChange(prospect.id, newStage as Stage)
                                              }
                                              underwritingStatus={underwritingStatuses[prospect.id]}
                                              dueDiligenceStatus={dueDiligenceStatuses[prospect.id]}
                                              isOverLimit={isProspectOverLimit(prospect.id)}
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
                        {FINAL_STAGES.map((stage) => {
                          const stageProspects = getProspectsByStage(stage.value);
                          const totalValue = getTotalValueByStage(stage.value);

                          return (
                            <Droppable key={stage.value} droppableId={stage.value}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                  <PipelineColumn
                                    title={stage.label}
                                    count={stageProspects.length}
                                    totalValue={totalValue}
                                    isDraggingOver={snapshot.isDraggingOver}
                                  >
                                    {stageProspects.map((prospect, index) => {
                                      const cardData: ProspectCardData = {
                                        id: prospect.id,
                                        companyName: prospect.company.companyName,
                                        companyNumber: prospect.company.companyNumber,
                                        loanAmount: prospect.loanAmount ?? undefined,
                                        priority: prospect.priority as any,
                                      };

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
                                              <ProspectCard
                                                prospect={cardData}
                                                dragHandleProps={provided.dragHandleProps}
                                                isDragging={snapshot.isDragging}
                                                currentStage={stage.value}
                                                availableStages={ALL_STAGES}
                                                onClick={() => navigate(`/prospect/${prospect.id}`)}
                                                onMove={(newStage) =>
                                                  handleStageChange(prospect.id, newStage as Stage)
                                                }
                                                underwritingStatus={
                                                  underwritingStatuses[prospect.id]
                                                }
                                                dueDiligenceStatus={dueDiligenceStatuses[prospect.id]}
                                                isOverLimit={isProspectOverLimit(prospect.id)}
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
