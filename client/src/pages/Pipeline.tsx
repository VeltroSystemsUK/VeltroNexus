import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import PipelineStats from "@/components/PipelineStats";
import PipelineColumn from "@/components/PipelineColumn";
import ProspectCard, { type ProspectCardData } from "@/components/ProspectCard";
import EmptyPipeline from "@/components/EmptyPipeline";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";

type Stage = "lead" | "contacted" | "qualified" | "proposal" | "due-diligence" | "approval" | "approved" | "declined" | "withdrawn";

const STAGES: { value: Stage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "due-diligence", label: "Due Diligence" },
  { value: "approval", label: "Approval" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
];

const ACTIVE_STAGES = STAGES.slice(0, 6);
const FINAL_STAGES = STAGES.slice(6);

interface Prospect extends ProspectCardData {
  stage: Stage;
}

export default function Pipeline() {
  const [prospects, setProspects] = useState<Prospect[]>([
    {
      id: 1,
      companyName: "Tech Innovations Ltd",
      companyNumber: "12345678",
      loanAmount: 25000000,
      priority: "high",
      stage: "lead",
    },
    {
      id: 2,
      companyName: "Global Manufacturing Co",
      companyNumber: "87654321",
      loanAmount: 50000000,
      priority: "medium",
      stage: "contacted",
    },
    {
      id: 3,
      companyName: "Digital Solutions Group",
      companyNumber: "11223344",
      loanAmount: 15000000,
      stage: "qualified",
    },
    {
      id: 4,
      companyName: "Sustainable Energy Ltd",
      companyNumber: "99887766",
      loanAmount: 75000000,
      priority: "high",
      stage: "proposal",
    },
    {
      id: 5,
      companyName: "Healthcare Systems Inc",
      companyNumber: "55667788",
      loanAmount: 30000000,
      stage: "due-diligence",
    },
    {
      id: 6,
      companyName: "Retail Ventures PLC",
      companyNumber: "44332211",
      loanAmount: 20000000,
      priority: "low",
      stage: "approval",
    },
    {
      id: 7,
      companyName: "Construction Group Ltd",
      companyNumber: "66778899",
      loanAmount: 40000000,
      stage: "approved",
    },
    {
      id: 8,
      companyName: "Finance Partners Ltd",
      companyNumber: "33445566",
      loanAmount: 10000000,
      stage: "declined",
    },
  ]);

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;

    if (!destination) {
      return;
    }

    if (destination.droppableId === result.source.droppableId) {
      return;
    }

    const prospectId = parseInt(draggableId.replace("prospect-", ""));
    const newStage = destination.droppableId as Stage;

    setProspects((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, stage: newStage } : p))
    );

    toast.success("Stage updated successfully");
  };

  const handleStageChange = (prospectId: number, newStage: Stage) => {
    setProspects((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, stage: newStage } : p))
    );
    toast.success("Stage updated successfully");
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
    return prospects.filter((p) => p.stage === stage);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">LP</span>
            </div>
            <h1 className="text-xl font-bold" data-testid="text-app-title">Lending Pipeline</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2" data-testid="text-page-title">Pipeline</h2>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Visual overview of your lending pipeline - drag cards to move between stages
          </p>
        </div>

        <div className="mb-8">
          <PipelineStats
            totalProspects={prospects.length}
            activeProspects={activeProspects}
            totalValue={formatCurrency(totalValue)}
            approvedCount={approvedCount}
          />
        </div>

        {prospects.length === 0 ? (
          <EmptyPipeline onAddProspect={() => toast.info("Company search coming soon")} />
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4" data-testid="text-active-pipeline">
                Active Pipeline
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {ACTIVE_STAGES.map((stage) => {
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
                            {stageProspects.map((prospect, index) => (
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
                                      prospect={prospect}
                                      dragHandleProps={provided.dragHandleProps}
                                      isDragging={snapshot.isDragging}
                                      currentStage={stage.value}
                                      availableStages={STAGES}
                                      onClick={() => toast.info(`Viewing ${prospect.companyName}`)}
                                      onMove={(newStage) =>
                                        handleStageChange(prospect.id, newStage as Stage)
                                      }
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </PipelineColumn>
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4" data-testid="text-final-outcomes">
                Final Outcomes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            {stageProspects.map((prospect, index) => (
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
                                      prospect={prospect}
                                      dragHandleProps={provided.dragHandleProps}
                                      isDragging={snapshot.isDragging}
                                      currentStage={stage.value}
                                      availableStages={STAGES}
                                      onClick={() => toast.info(`Viewing ${prospect.companyName}`)}
                                      onMove={(newStage) =>
                                        handleStageChange(prospect.id, newStage as Stage)
                                      }
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </PipelineColumn>
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </div>
          </DragDropContext>
        )}
      </main>
    </div>
  );
}
