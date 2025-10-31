import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, MoreVertical, PoundSterling, ArrowRight, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

type Stage = "lead" | "contacted" | "qualified" | "proposal" | "due-diligence" | "approval" | "approved" | "declined" | "withdrawn";

const STAGES: { value: Stage; label: string; color: string }[] = [
  { value: "lead", label: "Lead", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
  { value: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "qualified", label: "Qualified", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
  { value: "proposal", label: "Proposal", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "due-diligence", label: "Due Diligence", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "approval", label: "Approval", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "approved", label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "declined", label: "Declined", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "withdrawn", label: "Withdrawn", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
];

const ACTIVE_STAGES = STAGES.slice(0, 6); // Lead through Approval
const FINAL_STAGES = STAGES.slice(6); // Approved, Declined, Withdrawn

export default function Pipeline() {
  const [, navigate] = useLocation();
  const { data: prospects = [], isLoading, refetch } = trpc.prospects.list.useQuery();

  const updateStageMutation = trpc.prospects.updateStage.useMutation({
    onSuccess: () => {
      toast.success("Stage updated successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update stage: ${error.message}`);
    },
  });

  const handleStageChange = (prospectId: number, newStage: Stage) => {
    updateStageMutation.mutate({
      prospectId,
      stage: newStage,
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) {
      return;
    }

    // Dropped in the same place
    if (destination.droppableId === result.source.droppableId) {
      return;
    }

    // Update the stage
    const prospectId = parseInt(draggableId.replace("prospect-", ""));
    const newStage = destination.droppableId as Stage;
    handleStageChange(prospectId, newStage);
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return "Not specified";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const getProspectsByStage = (stage: Stage) => {
    return prospects.filter((p) => p.stage === stage);
  };

  const getTotalValueByStage = (stage: Stage) => {
    const stageProspects = getProspectsByStage(stage);
    return stageProspects.reduce((sum, p) => sum + (p.loanAmount || 0), 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Pipeline</h1>
        <p className="text-muted-foreground mt-2">
          Visual overview of your lending pipeline - drag cards to move between stages
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Prospects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prospects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {prospects.filter(p => !["approved", "declined", "withdrawn"].includes(p.stage)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(prospects.reduce((sum, p) => sum + (p.loanAmount || 0), 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {prospects.filter(p => p.stage === "approved").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {prospects.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No prospects in your pipeline yet</p>
            <Button onClick={() => navigate("/")}>
              Search for Companies
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Active Pipeline Kanban */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Active Pipeline</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {ACTIVE_STAGES.map((stage) => {
                const stageProspects = getProspectsByStage(stage.value);
                const totalValue = getTotalValueByStage(stage.value);

                return (
                  <div key={stage.value} className="flex flex-col">
                    <div className="bg-muted rounded-t-lg p-3 border-b">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm">{stage.label}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {stageProspects.length}
                        </Badge>
                      </div>
                      {totalValue > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(totalValue)}
                        </p>
                      )}
                    </div>
                    <Droppable droppableId={stage.value}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 rounded-b-lg p-2 space-y-2 min-h-[200px] transition-colors ${
                            snapshot.isDraggingOver
                              ? "bg-muted/50 border-2 border-dashed border-primary"
                              : "bg-muted/30"
                          }`}
                        >
                          {stageProspects.map((prospect, index) => (
                            <Draggable
                              key={prospect.id}
                              draggableId={`prospect-${prospect.id}`}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                                    snapshot.isDragging ? "shadow-lg rotate-2" : ""
                                  }`}
                                  onClick={() => navigate(`/prospect/${prospect.id}`)}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-start justify-between mb-2">
                                      <div
                                        {...provided.dragHandleProps}
                                        className="flex-shrink-0 mr-2 cursor-grab active:cursor-grabbing"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-sm truncate">
                                          {prospect.company?.companyName}
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                          {prospect.company?.companyNumber}
                                        </p>
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => navigate(`/prospect/${prospect.id}`)}>
                                            View Details
                                          </DropdownMenuItem>
                                          {STAGES.filter(s => s.value !== stage.value).map((s) => (
                                            <DropdownMenuItem
                                              key={s.value}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStageChange(prospect.id, s.value);
                                              }}
                                            >
                                              Move to {s.label}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>

                                    {prospect.loanAmount && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                        <PoundSterling className="h-3 w-3" />
                                        {formatCurrency(prospect.loanAmount)}
                                      </div>
                                    )}

                                    {prospect.priority && (
                                      <Badge
                                        variant="outline"
                                        className={`text-xs ${
                                          prospect.priority === "high"
                                            ? "border-red-500 text-red-700 dark:text-red-400"
                                            : prospect.priority === "medium"
                                            ? "border-amber-500 text-amber-700 dark:text-amber-400"
                                            : "border-blue-500 text-blue-700 dark:text-blue-400"
                                        }`}
                                      >
                                        {prospect.priority}
                                      </Badge>
                                    )}
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Final Stages */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Final Stages</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {FINAL_STAGES.map((stage) => {
                const stageProspects = getProspectsByStage(stage.value);
                const totalValue = getTotalValueByStage(stage.value);

                return (
                  <Card key={stage.value}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{stage.label}</CardTitle>
                        <Badge variant="secondary">{stageProspects.length}</Badge>
                      </div>
                      {totalValue > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(totalValue)}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      {stageProspects.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No prospects in this stage
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {stageProspects.map((prospect) => (
                            <div
                              key={prospect.id}
                              className="p-2 border rounded hover:bg-muted cursor-pointer transition-colors"
                              onClick={() => navigate(`/prospect/${prospect.id}`)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {prospect.company?.companyName}
                                  </p>
                                  {prospect.loanAmount && (
                                    <p className="text-xs text-muted-foreground">
                                      {formatCurrency(prospect.loanAmount)}
                                    </p>
                                  )}
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      )}
    </div>
  );
}

