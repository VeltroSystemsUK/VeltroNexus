import ProspectCard from "../ProspectCard";

export default function ProspectCardExample() {
  const mockProspect = {
    id: 1,
    companyName: "Acme Manufacturing Ltd",
    companyNumber: "12345678",
    loanAmount: 25000000,
    priority: "high" as const,
  };

  const mockStages = [
    { value: "lead", label: "Lead" },
    { value: "contacted", label: "Contacted" },
    { value: "qualified", label: "Qualified" },
  ];

  return (
    <div className="max-w-xs">
      <ProspectCard
        prospect={mockProspect}
        currentStage="lead"
        availableStages={mockStages}
        onClick={() => console.log("Prospect clicked")}
        onMove={(stage) => console.log("Move to:", stage)}
      />
    </div>
  );
}
