import PipelineStats from '../PipelineStats'

export default function PipelineStatsExample() {
  return (
    <PipelineStats 
      totalProspects={42}
      activeProspects={28}
      totalValue="£2,450,000"
      approvedCount={8}
    />
  )
}
