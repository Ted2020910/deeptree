import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { marked } from 'marked'
import type { DtNode, SaveFns } from '../types'

marked.setOptions({ breaks: true })

const STATUS_OPTIONS: DtNode['status'][] = ['pending', 'in_progress', 'decided', 'completed', 'rejected']
const STATUS_COLORS: Record<string, string> = {
  pending:     'var(--status-pending)',
  in_progress: 'var(--status-progress)',
  decided:     'var(--status-decided)',
  completed:   'var(--status-completed)',
  rejected:    'var(--status-rejected)',
}

const EDGE_ARROW: Record<string, string> = { to: '→', from: '←' }

interface DetailPanelProps {
  node: DtNode
  allNodes: DtNode[]
  saveFns: SaveFns
  collapsed?: boolean
  onToggleCollapse?: () => void
  onSelectNode?: (id: string) => void
  width?: number
}

export function DetailPanel({ node, allNodes, saveFns, collapsed, onToggleCollapse, onSelectNode, width }: DetailPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [summary, setSummary] = useState(node.summary)
  const [content, setContent] = useState(node.content)
  const [type, setType] = useState(node.type)
  const [status, setStatus] = useState<DtNode['status']>(node.status)
  const [editingContent, setEditingContent] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [dirty, setDirty] = useState(false)
  const [adding, setAdding] = useState(false)
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const suppressRef = useRef(0) // suppress sync until this timestamp
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const prevNodeIdRef = useRef(node.id)

  // When switching to a different node: unconditionally reset
  useEffect(() => {
    setTitle(node.title)
    setSummary(node.summary)
    setContent(node.content)
    setType(node.type)
    setStatus(node.status)
    setEditingContent(false)
    setDirty(false)
    setSaveStatus('')
    suppressRef.current = 0
    clearTimeout(debounceRef.current)
    prevNodeIdRef.current = node.id
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // External changes sync (e.g. another user or CLI edit on same node)
  // Only applies when we have no local dirty edits and outside the suppress window
  useEffect(() => {
    if (prevNodeIdRef.current !== node.id) return // handled by node.id effect
    if (Date.now() < suppressRef.current) return
    if (dirty) return
    setTitle(node.title)
    setSummary(node.summary)
    setContent(node.content)
    setType(node.type)
    setStatus(node.status)
  }, [node.title, node.summary, node.content, node.type, node.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-save with debounce ───

  const handleSave = useCallback(async () => {
    setSaveStatus('保存中…')
    suppressRef.current = Date.now() + 2000 // suppress sync for 2s after save
    try {
      await saveFns.updateFrontmatter(node.id, { title, summary, type, status })
      await saveFns.updateContent(node.id, content)
      setDirty(false)
      setSaveStatus('已保存')
    } catch {
      setSaveStatus('保存失败')
    }
  }, [node.id, title, summary, type, status, content, saveFns])

  function markDirtyAndScheduleSave() {
    setDirty(true)
    setSaveStatus('')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      // handleSave is stale inside this closure, so we trigger save via a ref trick
      saveNowRef.current?.()
    }, 800)
  }
  // Keep a stable ref to the latest handleSave
  const saveNowRef = useRef(handleSave)
  useEffect(() => { saveNowRef.current = handleSave }, [handleSave])

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // Ctrl+S: immediate save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (dirty) {
          clearTimeout(debounceRef.current)
          handleSave()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, handleSave])

  const renderedMd = marked.parse(content) as string
  const nodeById = (id: string) => allNodes.find(n => n.id === id)

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (editingContent) {
      requestAnimationFrame(() => contentTextareaRef.current?.focus())
    }
  }, [editingContent])

  const handleDeleteEdge = useCallback(async (target: string, type: 'from' | 'to') => {
    if (!confirm(`删除 ${node.id} ${EDGE_ARROW[type]} ${target} ？`)) return
    try { await saveFns.deleteEdge({ source: node.id, target, type }) }
    catch (e) { alert(`删除失败: ${String(e)}`) }
  }, [node.id, saveFns])

  if (collapsed) {
    return (
      <div className="detail-panel detail-panel--collapsed">
        <button className="detail-panel__toggle" onClick={onToggleCollapse} title="展开详情" aria-label="Expand panel">›</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', writingMode: 'vertical-rl', marginTop: 12 }}>
          #{node.id}
        </span>
      </div>
    )
  }

  return (
    <div className="detail-panel" style={{ width: width ?? 400 }}>
      <button className="detail-panel__toggle" onClick={onToggleCollapse} title="折叠详情" aria-label="Collapse panel">‹</button>

      <div className="detail-panel__header">
        <div className="detail-panel__id-row">
          <span className="detail-panel__hero-id">#{node.id}</span>
        </div>

        <input
          className="detail-panel__title-input"
          value={title}
          onChange={e => { setTitle(e.target.value); markDirtyAndScheduleSave() }}
          placeholder="节点标题"
        />

        <textarea
          className="detail-panel__summary-input"
          value={summary}
          onChange={e => { setSummary(e.target.value); markDirtyAndScheduleSave() }}
          placeholder="一句话摘要"
          rows={2}
        />

        <div className="detail-panel__meta">
          <label className="field-chip">
            <input
              value={type}
              onChange={e => { setType(e.target.value); markDirtyAndScheduleSave() }}
              style={{ width: 80 }}
            />
          </label>
          <label className="field-chip" style={{ color: STATUS_COLORS[status], borderColor: 'var(--border-strong)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[status] }} />
            <select
              value={status}
              onChange={e => { setStatus(e.target.value as DtNode['status']); markDirtyAndScheduleSave() }}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="detail-panel__body">
        {/* Edges */}
        <div className="detail-panel__edges">
          <div className="detail-panel__section-label">
            <span className="led led--blue" />
            连接 ({node.edges.length})
          </div>

          {node.edges.length === 0 && (
            <div className="edge-item edge-item--empty">— 暂无连接 —</div>
          )}

          {node.edges.map((e, i) => {
            const target = nodeById(e.target)
            const clickable = !!target && !!onSelectNode
            return (
              <EdgeItem
                key={i}
                arrow={EDGE_ARROW[e.type] ?? '—'}
                targetId={e.target}
                targetTitle={target?.title ?? (e.summary || '（跨项目）')}
                summary={e.summary}
                clickable={clickable}
                onSelectTarget={() => clickable && onSelectNode!(e.target)}
                onDelete={() => handleDeleteEdge(e.target, e.type)}
                onCommitSummary={async (next) => {
                  try { await saveFns.updateEdge({ source: node.id, target: e.target, type: e.type, summary: next }) }
                  catch (err) { alert(`保存失败: ${String(err)}`) }
                }}
              />
            )
          })}

          <div className="detail-panel__action-row">
            {!adding ? (
              <button className="btn-ghost" onClick={() => setAdding(true)}>＋ 添加连接</button>
            ) : (
              <AddEdgeForm
                source={node.id}
                allNodes={allNodes}
                onCreate={async ({ target, type, summary }) => {
                  try {
                    await saveFns.createEdge({ source: node.id, target, type, summary })
                    setAdding(false)
                  } catch (e) { alert(`连边失败: ${String(e)}`) }
                }}
                onCancel={() => setAdding(false)}
              />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="detail-panel__content-area">
          <div className="detail-panel__content-header">
            <span className="detail-panel__section-label">
              <span className={`led ${content.trim() ? 'led--green' : 'led--dim'}`} />
              正文
            </span>
            <button className="btn-ghost" onClick={() => setEditingContent(v => !v)}>
              {editingContent ? '预览' : '编辑'}
            </button>
          </div>

          {editingContent ? (
            <textarea
              ref={contentTextareaRef}
              className="content-textarea"
              value={content}
              onChange={e => { setContent(e.target.value); markDirtyAndScheduleSave() }}
              spellCheck={false}
              rows={16}
            />
          ) : (
            <div
              className="md-content"
              dangerouslySetInnerHTML={{ __html: renderedMd }}
              onDoubleClick={() => setEditingContent(true)}
              title="双击编辑"
            />
          )}
        </div>
      </div>

      <div className="detail-panel__footer">
        <span className="save-status">{dirty ? (saveStatus || '编辑中…') : saveStatus}</span>
        {dirty ? (
          <button className="btn-ghost" onClick={() => { clearTimeout(debounceRef.current); handleSave() }}>
            立即保存
          </button>
        ) : <span />}
      </div>
    </div>
  )
}

/* ─── AddEdgeForm: combobox for picking a target node ─── */

interface AddEdgeFormProps {
  source: string
  allNodes: DtNode[]
  onCreate: (input: { target: string; type: 'from' | 'to'; summary: string }) => Promise<void>
  onCancel: () => void
}

function AddEdgeForm({ source, allNodes, onCreate, onCancel }: AddEdgeFormProps) {
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<'to' | 'from'>('to')
  const [summary, setSummary] = useState('')
  const [active, setActive] = useState(0)
  const [target, setTarget] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allNodes
      .filter(n => n.id !== source)
      .filter(n => !q || n.id.includes(q) || n.title.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, allNodes, source])

  const targetNode = target ? allNodes.find(n => n.id === target) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div className="combobox">
        <input
          ref={inputRef}
          className="combobox__input"
          placeholder={targetNode ? `已选 #${targetNode.id} · ${targetNode.title}` : '输入 ID 或标题搜索目标节点（也可手输跨项目 proj::id）'}
          value={query}
          onChange={e => { setQuery(e.target.value); setTarget(null) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter' && matches[active]) {
              e.preventDefault()
              setTarget(matches[active].id)
              setQuery(matches[active].title)
            }
          }}
        />
        {!target && query && matches.length > 0 && (
          <div className="combobox__list">
            {matches.map((n, i) => (
              <div
                key={n.id}
                className={`combobox__item ${i === active ? 'combobox__item--active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => { setTarget(n.id); setQuery(n.title) }}
              >
                <span className="combobox__item-id">#{n.id}</span>
                <span className="combobox__item-title">{n.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="field-chip" style={{ width: 110 }}>
          <select value={direction} onChange={e => setDirection(e.target.value as 'to' | 'from')}>
            <option value="to">→ 子（to）</option>
            <option value="from">← 父（from）</option>
          </select>
        </label>
        <input
          className="combobox__input"
          style={{ flex: 1 }}
          placeholder="边摘要（可空）"
          value={summary}
          onChange={e => setSummary(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-primary"
          disabled={!target && !(query.includes('::'))}
          onClick={() => {
            const t = target ?? (query.includes('::') ? query.trim() : null)
            if (!t) return
            onCreate({ target: t, type: direction, summary })
          }}
        >确认</button>
        <button className="btn-ghost" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

/* ─── EdgeItem: 一行 edge，target 可点跳转，summary 双击编辑 ─── */

interface EdgeItemProps {
  arrow: string
  targetId: string
  targetTitle: string
  summary: string
  clickable: boolean
  onSelectTarget: () => void
  onDelete: () => void
  onCommitSummary: (next: string) => void | Promise<void>
}

function EdgeItem({ arrow, targetId, targetTitle, summary, clickable, onSelectTarget, onDelete, onCommitSummary }: EdgeItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(summary)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(summary) }, [summary])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    const next = draft.trim()
    if (next !== summary) onCommitSummary(next)
    setEditing(false)
  }
  function cancel() {
    setDraft(summary)
    setEditing(false)
  }

  return (
    <div className="edge-item">
      <span className="edge-item__arrow">{arrow}</span>
      <span
        className="edge-item__target"
        onClick={onSelectTarget}
        title={clickable ? '点击跳转' : undefined}
        style={{ cursor: clickable ? 'pointer' : 'default' }}
      >
        #{targetId}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          className="edge-item__summary-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            else if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          placeholder="边摘要"
        />
      ) : (
        <span
          className="edge-item__summary"
          onDoubleClick={() => setEditing(true)}
          title="双击编辑摘要"
        >
          {summary || <em style={{ opacity: 0.5 }}>{targetTitle}（双击加摘要）</em>}
        </span>
      )}
      <button
        className="btn-ghost btn-ghost--mini btn-ghost--danger"
        onClick={onDelete}
        title="删除该连接"
        aria-label="Delete edge"
      >×</button>
    </div>
  )
}
