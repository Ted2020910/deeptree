import { useState, useEffect, useCallback } from 'react'
import { marked } from 'marked'
import type { DtNode, SaveFns } from '../types'

marked.setOptions({ breaks: true })

const STATUS_COLORS: Record<string, string> = {
  pending:     '#D4A843',
  in_progress: '#007AFF',
  decided:     '#4A9E5C',
  completed:   '#4A9E5C',
  rejected:    '#D71921',
}

const DIRECTION_ARROW: Record<string, string> = {
  to:      '→',
  from:    '←',
  related: '↔',
}

interface DetailPanelProps {
  node: DtNode
  allNodes: DtNode[]
  saveFns: SaveFns
}

export function DetailPanel({ node, allNodes, saveFns }: DetailPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [summary, setSummary] = useState(node.summary)
  const [content, setContent] = useState(node.content)
  const [editingContent, setEditingContent] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [dirty, setDirty] = useState(false)

  // Sync when node changes
  useEffect(() => {
    setTitle(node.title)
    setSummary(node.summary)
    setContent(node.content)
    setEditingContent(false)
    setDirty(false)
    setSaveStatus('')
  }, [node.id, node.title, node.summary, node.content])

  const markDirty = () => { setDirty(true); setSaveStatus('') }

  const handleSave = useCallback(async () => {
    setSaveStatus('[SAVING...]')
    try {
      await saveFns.updateFrontmatter(node.id, { title, summary })
      await saveFns.updateContent(node.id, content)
      setSaveStatus('[SAVED]')
      setDirty(false)
    } catch {
      setSaveStatus('[ERROR: SAVE FAILED]')
    }
  }, [node.id, title, summary, content, saveFns])

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && dirty) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dirty, handleSave])

  const renderedMd = marked.parse(content) as string

  const nodeById = (id: string) => allNodes.find(n => n.id === id)

  return (
    <div className="detail-panel">
      {/* Header */}
      <div className="detail-panel__header">
        <div className="detail-panel__meta">
          <span>#{node.id}</span>
          <span className="detail-panel__tag">{node.type.toUpperCase()}</span>
          <span
            className="detail-panel__tag detail-panel__tag--status"
            style={{ color: STATUS_COLORS[node.status] ?? '#999', borderColor: STATUS_COLORS[node.status] ?? '#ccc' }}
          >
            {node.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <input
          className="detail-panel__title-input"
          value={title}
          onChange={e => { setTitle(e.target.value); markDirty() }}
          placeholder="节点标题"
        />

        <textarea
          className="detail-panel__summary-input"
          value={summary}
          onChange={e => { setSummary(e.target.value); markDirty() }}
          placeholder="一句话摘要（用于 dt tree 快速扫描）"
          rows={2}
        />
      </div>

      {/* Body */}
      <div className="detail-panel__body">
        {/* Edges */}
        {node.edges.length > 0 && (
          <div className="detail-panel__edges">
            <div className="detail-panel__section-label">EDGES</div>
            {node.edges.map((e, i) => {
              const target = nodeById(e.target)
              return (
                <div key={i} className="edge-item">
                  <span className="edge-item__arrow">{DIRECTION_ARROW[e.direction] ?? '—'}</span>
                  <span className="edge-item__target">{e.target}</span>
                  <span className="edge-item__summary">
                    {target ? `${target.title}${e.summary ? ` · ${e.summary}` : ''}` : e.summary}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Content */}
        <div className="detail-panel__content-area">
          <div className="detail-panel__content-header">
            <span className="detail-panel__section-label">CONTENT</span>
            <button
              className="btn-ghost"
              onClick={() => { setEditingContent(v => !v) }}
            >
              {editingContent ? '[PREVIEW]' : '[EDIT]'}
            </button>
          </div>

          {editingContent ? (
            <textarea
              className="content-textarea"
              value={content}
              onChange={e => { setContent(e.target.value); markDirty() }}
              spellCheck={false}
            />
          ) : (
            <div
              className="md-content"
              dangerouslySetInnerHTML={{ __html: renderedMd }}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="detail-panel__footer">
        <span className="save-status">{saveStatus}</span>
        {dirty && (
          <button className="btn-save" onClick={handleSave}>
            [SAVE]
          </button>
        )}
      </div>
    </div>
  )
}
