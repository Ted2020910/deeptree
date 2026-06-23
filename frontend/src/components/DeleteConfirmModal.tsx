import { useEffect } from 'react'
import { AlertTriangle, ArrowRight, GitBranch, Trash2, X } from 'lucide-react'

export interface EdgeDeleteTarget {
  kind: 'edge'
  source: string
  target: string
  type?: 'from' | 'to'
}

export interface NodeDeleteTarget {
  kind: 'node'
  id: string
}

export type DeleteTarget = EdgeDeleteTarget | NodeDeleteTarget

interface DeleteConfirmModalProps {
  target: DeleteTarget
  sourceLabel?: string
  targetLabel?: string
  nodeTitle?: string
  nodeMeta?: string
  busy?: boolean
  error?: string
  onClose: () => void
  onConfirm: () => void
}

function NodeBadge({ id, label, tone }: { id: string; label?: string; tone: 'source' | 'target' }) {
  return (
    <div className={`delete-confirm__node delete-confirm__node--${tone}`}>
      <span className="delete-confirm__node-kicker">{tone === 'source' ? 'FROM' : 'TO'}</span>
      <strong>#{id}</strong>
      {label && <span title={label}>{label}</span>}
    </div>
  )
}

export function DeleteConfirmModal({
  target,
  sourceLabel,
  targetLabel,
  nodeTitle,
  nodeMeta,
  busy = false,
  error,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const isEdge = target.kind === 'edge'
  const edgeLeft = isEdge && target.type === 'from'
    ? { id: target.target, label: targetLabel, tone: 'source' as const }
    : isEdge
      ? { id: target.source, label: sourceLabel, tone: 'source' as const }
      : null
  const edgeRight = isEdge && target.type === 'from'
    ? { id: target.source, label: sourceLabel, tone: 'target' as const }
    : isEdge
      ? { id: target.target, label: targetLabel, tone: 'target' as const }
      : null

  return (
    <div
      className="action-modal__backdrop delete-confirm__backdrop"
      onMouseDown={() => { if (!busy) onClose() }}
    >
      <section
        className="action-modal action-modal--compact delete-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="action-modal__header delete-confirm__header">
          <div className="action-modal__title delete-confirm__title" id="delete-confirm-title">
            <span className="delete-confirm__icon" aria-hidden="true">
              <AlertTriangle size={16} />
            </span>
            <span>{isEdge ? '删除连接' : '删除节点'}</span>
          </div>
          <button className="action-modal__close" onClick={onClose} disabled={busy} aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="action-modal__body delete-confirm__body">
          <p className="delete-confirm__copy">
            {isEdge ? '确认删除这条连接？删除后会同步清理两端关系。' : '确认删除这个节点？相关连接会一并清理。'}
          </p>

          {isEdge && edgeLeft && edgeRight ? (
            <div className="delete-confirm__relation">
              <NodeBadge {...edgeLeft} />
              <span className="delete-confirm__arrow" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
              <NodeBadge {...edgeRight} />
            </div>
          ) : (
            <div className="delete-confirm__single">
              <GitBranch size={18} />
              <div>
                <strong>#{target.kind === 'node' ? target.id : ''}</strong>
                <span title={nodeTitle}>{nodeTitle || '未命名节点'}</span>
                {nodeMeta && <small>{nodeMeta}</small>}
              </div>
            </div>
          )}

          {error && (
            <div className="action-modal__error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="action-modal__footer delete-confirm__footer">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn-primary btn-primary--danger" onClick={onConfirm} disabled={busy}>
            <Trash2 size={14} />
            {busy ? '删除中...' : isEdge ? '删除连接' : '删除节点'}
          </button>
        </div>
      </section>
    </div>
  )
}
