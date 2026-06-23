import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export type DtFlowEdgeData = {
  edgeType: 'parent' | 'cross'
  summary: string
  onCommitSummary?: (next: string) => void
  onRequestDelete?: () => void
  externalEdit?: boolean
  onEditClose?: () => void
}

export type DtFlowEdge = Edge<DtFlowEdgeData, 'dtEdge'>

function getCssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return val || fallback
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<DtFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isCross = data?.edgeType === 'cross'
  const edgeColor = getCssVar('--edge-color', '#888888')
  const edgeColorDim = getCssVar('--edge-color-dim', '#666666')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data?.summary ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(data?.summary ?? '') }, [data?.summary])
  useEffect(() => { if (data?.externalEdit) setEditing(true) }, [data?.externalEdit])
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function commit() {
    const next = draft.trim()
    if (next !== (data?.summary ?? '')) data?.onCommitSummary?.(next)
    setEditing(false)
    data?.onEditClose?.()
  }

  function cancel() {
    setDraft(data?.summary ?? '')
    setEditing(false)
    data?.onEditClose?.()
  }

  const canEdit = !!data?.onCommitSummary
  const showLabel = canEdit || (data?.summary && data.summary.length > 0)

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={isCross ? undefined : markerEnd}
        className={isCross ? '' : 'edge-flow'}
        style={{
          stroke: isCross ? edgeColorDim : edgeColor,
          strokeWidth: isCross ? 2 : 2.5,
          strokeDasharray: isCross ? '2 6' : '4 5',
          strokeLinecap: 'round',
        }}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label ${editing ? 'edge-label--editing' : ''} ${!data?.summary ? 'edge-label--empty' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              position: 'absolute',
              pointerEvents: 'all',
            }}
            onDoubleClick={(event) => {
              event.stopPropagation()
              if (canEdit) setEditing(true)
            }}
            title={canEdit ? '双击编辑摘要' : undefined}
          >
            {editing ? (
              <input
                ref={inputRef}
                className="edge-label__input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
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
                onMouseDown={(event) => event.stopPropagation()}
                placeholder="边摘要"
              />
            ) : (
              <>
                <span>{data?.summary || '+ 摘要'}</span>
                {data?.onRequestDelete && (
                  <button
                    className="edge-label__delete"
                    title="删除连接"
                    aria-label="Delete edge"
                    onClick={(event) => {
                      event.stopPropagation()
                      data.onRequestDelete?.()
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                )}
              </>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
