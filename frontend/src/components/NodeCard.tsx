import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import type { DtNode } from '../types'

export interface NodeCardActions {
  onAddChild?: (id: string) => void
  onAddParent?: (id: string) => void
  onAddSibling?: (id: string, side: 'left' | 'right') => void
  onDelete?: (id: string) => void
  /** Inline rename: 双击节点 / 新建节点回车保存 */
  onRenameCommit?: (id: string, newTitle: string) => void
}

export type DtFlowNodeData = DtNode & {
  __actions?: NodeCardActions
  /** 新建占位节点：直接进入 inline 编辑 */
  __editing?: boolean
}
export type DtFlowNode = Node<DtFlowNodeData, 'dtNode'>

const STATUS_COLORS: Record<string, string> = {
  pending:     '#D4A843',
  in_progress: '#5B9BF6',
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
  const a = data.__actions
  const statusColor = STATUS_COLORS[data.status] ?? '#999999'
  const inCount  = data.edges.filter(e => e.type === 'from').length
  const outCount = data.edges.filter(e => e.type === 'to').length

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
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function commit() {
    const t = draftTitle.trim()
    if (t && t !== data.title) {
      a?.onRenameCommit?.(data.id, t)
    } else {
      // 即使没改也要清掉 __editing 标记
      a?.onRenameCommit?.(data.id, data.title)
    }
    setEditing(false)
  }
  function cancel() {
    setDraftTitle(data.title)
    setEditing(false)
    // 通知 App 退出 editing 态（否则 editingNodeId 仍指向当前节点 → 下次 setNodes 会把 __editing 灌回来）
    a?.onRenameCommit?.(data.id, data.title)
  }

  function stop(e: React.MouseEvent) { e.stopPropagation() }

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
      onDoubleClick={(e) => { stop(e); setEditing(true) }}
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
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            else if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          onMouseDown={stop}
          onClick={stop}
          placeholder="节点标题"
        />
      ) : (
        <div className="node-card__title">{data.title}</div>
      )}

      {data.summary && !editing && (
        <div className="node-card__summary">{data.summary}</div>
      )}

      <Handle type="source" position={Position.Bottom} />

      {/* hover/selected: action buttons. × 在 editing 态也保留，确保占位节点能删除。 */}
      {a?.onDelete && (
        <button
          className="node-card__btn node-card__btn--delete"
          title="删除节点 (Delete)"
          aria-label="Delete node"
          onClick={(e) => { stop(e); a.onDelete!(data.id) }}
          onMouseDown={stop}
        >×</button>
      )}
      {a?.onAddParent && !editing && (
        <button
          className="node-card__btn node-card__btn--add node-card__btn--top"
          title="加 from 父节点 (Shift+Tab)"
          aria-label="Add parent"
          onClick={(e) => { stop(e); a.onAddParent!(data.id) }}
          onMouseDown={stop}
        >＋</button>
      )}
      {a?.onAddChild && !editing && (
        <button
          className="node-card__btn node-card__btn--add node-card__btn--bottom"
          title="加 to 子节点 (Tab)"
          aria-label="Add child"
          onClick={(e) => { stop(e); a.onAddChild!(data.id) }}
          onMouseDown={stop}
        >＋</button>
      )}
      {a?.onAddSibling && !editing && (
        <>
          <button
            className="node-card__btn node-card__btn--add node-card__btn--left"
            title="加同级节点"
            aria-label="Add sibling left"
            onClick={(e) => { stop(e); a.onAddSibling!(data.id, 'left') }}
            onMouseDown={stop}
          >＋</button>
          <button
            className="node-card__btn node-card__btn--add node-card__btn--right"
            title="加同级节点"
            aria-label="Add sibling right"
            onClick={(e) => { stop(e); a.onAddSibling!(data.id, 'right') }}
            onMouseDown={stop}
          >＋</button>
        </>
      )}
    </div>
  )
}
