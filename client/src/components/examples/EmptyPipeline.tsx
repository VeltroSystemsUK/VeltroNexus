import EmptyPipeline from '../EmptyPipeline'

export default function EmptyPipelineExample() {
  return (
    <EmptyPipeline 
      onAddProspect={() => console.log('Add prospect clicked')}
    />
  )
}
