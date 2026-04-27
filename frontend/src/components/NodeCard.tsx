import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { DtNode } from '../types'

export type DtFlowNode = Node<DtNode, 'dtNode'>

const STATUS_COLORS: Record<string, string> = {
  pending:     '#D4A843',
  in_progress: '#007AFF',
  decided:     '#4A9E5C',
  completed:   '#4A9E5C',
  rejected:    '#D71921',
}

const STATUS_LABELS: Record<string, string> = {
  pending:     'PENDING',
  in_progress: 'IN PROGRESS',
  decided:     'DECIDED',
  completed:   'COMPLETED',
  rejected:    'REJECTED',
}

export function NodeCard({ data, selected }: NodeProps<DtFlowNode>) {
  const statusColor = STATUS_COLORS[data.status] ?? '#999999'

  return (
    <div
      className={`node-card ${selected ? 'node-card--selected' : ''}`}
      style={{ borderLeftColor: statusColor }}
    >
      <Handle type="target" position={Position.Top} />

      <div className="node-card__meta">
        <span>{data.type.toUpperCase()}</span>
        <span className="node-card__meta-dot">·</span>
        <span className="node-card__status" style={{ color: statusColor }}>
          {STATUS_LABELS[data.status] ?? data.status.toUpperCase()}
        </span>
      </div>

      <div className="node-card__title">{data.title}</div>

      {data.summary && (
        <div className="node-card__summary">{data.summary}</div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
