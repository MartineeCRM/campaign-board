import { useBoardStore } from '../store'
import StageColumn from './StageColumn'
import NodeColumn from './NodeColumn'
import AddStageButton from './AddStageButton'

export default function FunnelBoard() {
  const edit = useBoardStore((s) => s.edit)
  const client = useBoardStore((s) => s.currentClient())

  return (
    <div style={{ overflowX: 'auto', padding: '28px 48px 72px', flex: 1 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'minmax(150px,auto) 100px minmax(150px,auto)',
          gridAutoFlow: 'column',
          gridAutoColumns: 'max-content',
          width: 'max-content',
          minWidth: '100%',
        }}
      >
        {client.stages.flatMap((stage) => [
          <StageColumn key={stage.id} stage={stage} />,
          ...stage.nodes.map((node) => <NodeColumn key={node.id} stage={stage} node={node} />),
        ])}
        {edit && <AddStageButton />}
      </div>
    </div>
  )
}
