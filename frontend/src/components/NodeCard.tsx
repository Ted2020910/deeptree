import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DtNode } from '../types'

export interface NodeCardActions {
  onAddChild?: (id: string) => void
  onAddParent?: (id: string) => void
  onAddSibling?: (id: string, side: 'left' | 'right') => void
  onDelete?: (id: string) => void
  onRenameCommit?: (id: string, newTitle: string) => void
}

export type DtFlowNodeData = DtNode & {
  __actions?: NodeCardActions
  __editing?: boolean
}

export type DtFlowNode = Node<DtFlowNodeData, 'dtNode'>

const STATUS_COLORS: Record<string, string> = {
  pending: '#D4A843',
  in_progress: '#5B9BF6',
  decided: '#4A9E5C',
  completed: '#4A9E5C',
  rejected: '#D71921',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'PENDING',
  in_progress: 'IN PROGRESS',
  decided: 'DECIDED',
  completed: 'COMPLETED',
  rejected: 'REJECTED',
}

export function NodeCard({ data, selected }: NodeProps<DtFlowNode>) {
  const actions = data.__actions
  const statusColor = STATUS_COLORS[data.status] ?? '#999999'
  const inCount = data.edges.filter(edge => edge.type === 'from').length
  const outCount = data.edges.filter(edge => edge.type === 'to').length
  const pathLabel = data.path ? data.path.split('/').slice(-2).join('/') : ''
  const [editing, setEditing] = useState<boolean>(!!data.__editing)
  const [draftTitle, setDraftTitle] = useState(data.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (data.__editing) {
      setEditing(true)
      setDraftTitle(data.title)
    }
  }, [data.__editing, data.title])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function commit() {
    const nextTitle = draftTitle.trim()
    actions?.onRenameCommit?.(data.id, nextTitle || data.title)
    setEditing(false)
  }

  function cancel() {
    setDraftTitle(data.title)
    setEditing(false)
    actions?.onRenameCommit?.(data.id, data.title)
  }

  function stop(event: React.MouseEvent) {
    event.stopPropagation()
  }

  return (
    <div
      className={`node-card ${selected ? 'node-card--selected' : ''} node-card--has-actions`}
      style={{
        borderTopColor: statusColor,
        color: statusColor,
        boxShadow: selected
          ? `0 0 16px var(--glow-color), 0 -1px 10px ${statusColor}40`
          : `0 -1px 8px ${statusColor}30`,
      }}
      onDoubleClick={(event) => {
        stop(event)
        setEditing(true)
      }}
    >
      <Handle type="target" position={Position.Top} />

      <div className="node-card__id" style={{ color: statusColor }}>#{data.id}</div>

      <div className="node-card__meta">
        <span>{data.type.toUpperCase()}</span>
        <span className="node-card__meta-dot">·</span>
        <span className="node-card__status" style={{ color: statusColor }}>
          {STATUS_LABELS[data.status] ?? data.status.toUpperCase()}
        </span>
        <span className="node-card__meta-dot" style={{ marginLeft: 'auto' }}>·</span>
        <span className="node-card__edge-count" title="入边 / 出边">
          ↓{inCount} ↑{outCount}
        </span>
      </div>

      {editing ? (
        <input
          ref={inputRef}
          className="node-card__title-input"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              cancel()
            }
          }}
          onMouseDown={stop}
          onClick={stop}
          placeholder="节点标题"
        />
      ) : (
        <div className="node-card__title">{data.title}</div>
      )}

      {data.summary && !editing && <div className="node-card__summary">{data.summary}</div>}
      {pathLabel && !editing && (
        <div className="node-card__summary" title={data.path} style={{ opacity: 0.65 }}>
          @{pathLabel}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />

      {actions?.onDelete && (
        <button
          className="node-card__btn node-card__btn--delete"
          title="删除节点"
          aria-label="Delete node"
          onClick={(event) => {
            stop(event)
            actions.onDelete?.(data.id)
          }}
          onMouseDown={stop}
        >
          <X size={13} />
        </button>
      )}
      {actions?.onAddParent && !editing && (
        <button
          className="node-card__btn node-card__btn--add node-card__btn--top"
          title="添加父节点"
          aria-label="Add parent"
          onClick={(event) => {
            stop(event)
            actions.onAddParent?.(data.id)
          }}
          onMouseDown={stop}
        >
          <Plus size={13} />
        </button>
      )}
      {actions?.onAddChild && !editing && (
        <button
          className="node-card__btn node-card__btn--add node-card__btn--bottom"
          title="添加子节点"
          aria-label="Add child"
          onClick={(event) => {
            stop(event)
            actions.onAddChild?.(data.id)
          }}
          onMouseDown={stop}
        >
          <Plus size={13} />
        </button>
      )}
      {actions?.onAddSibling && !editing && (
        <>
          <button
            className="node-card__btn node-card__btn--add node-card__btn--left"
            title="添加同级节点"
            aria-label="Add sibling left"
            onClick={(event) => {
              stop(event)
              actions.onAddSibling?.(data.id, 'left')
            }}
            onMouseDown={stop}
          >
            <Plus size={13} />
          </button>
          <button
            className="node-card__btn node-card__btn--add node-card__btn--right"
            title="添加同级节点"
            aria-label="Add sibling right"
            onClick={(event) => {
              stop(event)
              actions.onAddSibling?.(data.id, 'right')
            }}
            onMouseDown={stop}
          >
            <Plus size={13} />
          </button>
        </>
      )}
    </div>
  )
}
