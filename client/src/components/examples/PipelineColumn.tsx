import PipelineColumn from '../PipelineColumn'
import ProspectCard from '../ProspectCard'

export default function PipelineColumnExample() {
  const mockProspects = [
    {
      id: 1,
      companyName: "Tech Solutions Ltd",
      companyNumber: "12345678",
      loanAmount: 15000000,
      priority: "high" as const,
    },
    {
      id: 2,
      companyName: "Global Industries",
      companyNumber: "87654321",
      loanAmount: 30000000,
    },
  ];

  return (
    <div className="max-w-xs">
      <PipelineColumn
        title="Qualified"
        count={2}
        totalValue="£450,000"
      >
        {mockProspects.map((prospect) => (
          <ProspectCard
            key={prospect.id}
            prospect={prospect}
            onClick={() => console.log('Clicked:', prospect.companyName)}
          />
        ))}
      </PipelineColumn>
    </div>
  )
}
