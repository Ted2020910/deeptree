import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTree } from './hooks/useTree'
import { useProjects } from './hooks/useProjects'
import { DtCanvas } from './components/DtCanvas'
import { DetailPanel } from './components/DetailPanel'
import { StatusBar } from './components/StatusBar'
import { ProjectSelector } from './components/ProjectSelector'
import { CommandPalette } from './components/CommandPalette'
import type { DtNode } from './types'

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('dt-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    if (theme === 'light') document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
    localStorage.setItem('dt-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}

function getInitialProjectId(projects: { id: string; reachable: boolean }[]): string {
  const params = new URLSearchParams(location.search)
  const fromUrl = params.get('project')
  if (fromUrl && projects.find(p => p.id === fromUrl)) return fromUrl
  return projects.find(p => p.reachable)?.id ?? projects[0]?.id ?? ''
}

/* SVG icons (no emoji) */
const Icon = {
  layout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" /><path d="m6 11 6 6 6-6" /><path d="M5 21h14" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21V9" /><path d="m6 13 6-6 6 6" /><path d="M5 3h14" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
}

export default function App() {
  const { projects, loading: projectsLoading, error: projectsError } = useProjects()
  const [currentProjectId, setCurrentProjectId] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const [layoutTrigger, setLayoutTrigger] = useState(0)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('dt-panel-width')
    return saved ? Math.max(280, Math.min(900, Number(saved))) : 400
  })
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { theme, toggle } = useTheme()
  const triggerLayout = useCallback(() => setLayoutTrigger(n => n + 1), [])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const panel = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null
    if (!panel) return
    const startW = panel.getBoundingClientRect().width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    panel.style.transition = 'none'
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(280, Math.min(900, startW + (startX - ev.clientX)))
      panel.style.width = `${next}px`
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      panel.style.transition = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const finalW = Math.round(panel.getBoundingClientRect().width)
      setPanelWidth(finalW)
      localStorage.setItem('dt-panel-width', String(finalW))
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  useEffect(() => {
    if (projects.length > 0 && !currentProjectId) {
      setCurrentProjectId(getInitialProjectId(projects))
    }
  }, [projects, currentProjectId])

  const {
    data, loading: treeLoading, error: treeError,
    updateFrontmatter, updateContent, createNode, deleteNode, createEdge, deleteEdge, updateEdge,
  } = useTree(currentProjectId)

  const loading = projectsLoading || (!!currentProjectId && treeLoading)
  const error = projectsError ?? (currentProjectId ? treeError : null)

  const nodes = data?.nodes ?? []
  const selectedNode = nodes.find(n => n.id === selectedId) ?? null

  /* ─── Selection ─────────────────────────── */
  const handleProjectChange = (id: string) => {
    setCurrentProjectId(id)
    setSelectedId(null)
    setMultiSelected(new Set())
    setEditingNodeId(null)
    history.replaceState(null, '', `?project=${id}`)
  }

  const handleSelect = useCallback((id: string | null, additive: boolean) => {
    if (!id) {
      setSelectedId(null)
      if (!additive) setMultiSelected(new Set())
      return
    }
    setSelectedId(id)
    if (additive) {
      setMultiSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
      })
    } else {
      setMultiSelected(new Set([id]))
    }
  }, [])

  /* ─── Inline create helpers ─────────────────────────── */

  function getParentIdsOf(node: DtNode): string[] {
    return node.edges
      .filter(e => e.type === 'from' && !e.target.includes('::'))
      .map(e => e.target)
  }

  /** Create a node on the server with empty title, then put it in inline-edit mode. */
  async function createInlineNode(opts: {
    type: string
    froms?: string[]
    root?: boolean
  }): Promise<string | null> {
    try {
      const newId = await createNode({
        type: opts.type,
        title: '未命名',
        summary: '',
        froms: opts.froms,
        root: opts.root,
      })
      setSelectedId(newId)
      setEditingNodeId(newId)
      return newId
    } catch (e) {
      alert(`创建失败: ${String(e)}`)
      return null
    }
  }

  /* ─── Node-card actions (no more prompts) ─────────────────────────── */

  const nodeActions = useMemo(() => ({
    onAddChild: async (id: string) => {
      const me = nodes.find(n => n.id === id)
      await createInlineNode({ type: me?.type ?? 'explore', froms: [id] })
    },
    onAddParent: async (id: string) => {
      const me = nodes.find(n => n.id === id)
      try {
        const newId = await createNode({ type: me?.type ?? 'explore', title: '未命名', root: true })
        await createEdge({ source: id, target: newId, type: 'from', summary: '' })
        setSelectedId(newId)
        setEditingNodeId(newId)
      } catch (e) {
        alert(`创建失败: ${String(e)}`)
      }
    },
    onAddSibling: async (id: string) => {
      const me = nodes.find(n => n.id === id)
      if (!me) return
      const parents = getParentIdsOf(me)
      if (parents.length === 0) {
        await createInlineNode({ type: me.type, root: true })
      } else {
        await createInlineNode({ type: me.type, froms: parents })
      }
    },
    onDelete: async (id: string) => {
      const me = nodes.find(n => n.id === id)
      if (!confirm(`删除节点 #${id}「${me?.title ?? ''}」？`)) return
      try {
        await deleteNode(id)
        if (selectedId === id) setSelectedId(null)
        if (editingNodeId === id) setEditingNodeId(null)
        setMultiSelected(prev => {
          if (!prev.has(id)) return prev
          const next = new Set(prev); next.delete(id); return next
        })
      } catch (e) { alert(`删除失败: ${String(e)}`) }
    },
    onRenameCommit: async (id: string, newTitle: string) => {
      try {
        await updateFrontmatter(id, { title: newTitle })
      } catch (e) {
        alert(`重命名失败: ${String(e)}`)
      } finally {
        setEditingNodeId(prev => (prev === id ? null : prev))
      }
    },
  }), [nodes, createNode, createEdge, deleteNode, updateFrontmatter, selectedId, editingNodeId])

  /* ─── Add root (canvas button) ─────────────────────────── */

  const handleAddRoot = useCallback(async () => {
    await createInlineNode({ type: 'goal', root: true })
  }, [createNode]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Connect / disconnect edges ─────────────────────────── */

  const handleEdgeConnect = useCallback(async (source: string, target: string) => {
    try { await createEdge({ source, target, type: 'to', summary: '' }) }
    catch (e) { alert(`连边失败: ${String(e)}`) }
  }, [createEdge])

  const handleEdgeDelete = useCallback(async (source: string, target: string) => {
    if (!confirm(`删除连线 ${source} → ${target}？`)) return
    try { await deleteEdge({ source, target }) }
    catch (e) { alert(`删除失败: ${String(e)}`) }
  }, [deleteEdge])

  const handleEdgeCommitSummary = useCallback(async (source: string, target: string, summary: string) => {
    try { await updateEdge({ source, target, type: 'to', summary }) }
    catch (e) { alert(`保存失败: ${String(e)}`) }
  }, [updateEdge])

  /* ─── Export / import ─────────────────────────── */

  const handleExport = async () => {
    const ids = Array.from(multiSelected)
    if (ids.length === 0) {
      alert('请先选择要导出的节点（按住 Ctrl/⌘ 点击节点）')
      return
    }
    try {
      const res = await fetch(`/api/projects/${currentProjectId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds: ids }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const bundle = await res.json()
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      a.href = url
      a.download = `dt-bundle-${currentProjectId}-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`导出失败: ${String(e)}`)
    }
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const bundle = JSON.parse(text)
      const res = await fetch(`/api/projects/${currentProjectId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`${res.status}: ${t}`)
      }
      const result = await res.json() as { imported: number; idMapping: { from: string; to: string }[] }
      alert(`导入完成：${result.imported} 个节点`)
    } catch (e) {
      alert(`导入失败: ${String(e)}`)
    }
  }

  /* ─── Keyboard ───────────────────────────
     Ctrl+K: command palette
     Tab: add child of selected
     Shift+Tab: add parent of selected
     Enter: edit title of selected
     Delete/Backspace: delete selected
     Esc: clear selection / exit editing
  */
  useEffect(() => {
    function isTextField(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
    }
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdkOpen(true)
        return
      }

      if (isTextField(e.target)) return

      if (e.key === 'Tab' && selectedId) {
        e.preventDefault()
        if (e.shiftKey) nodeActions.onAddParent(selectedId)
        else nodeActions.onAddChild(selectedId)
        return
      }
      if (e.key === 'Enter' && selectedId && !editingNodeId) {
        e.preventDefault()
        setEditingNodeId(selectedId)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        nodeActions.onDelete(selectedId)
        return
      }
      if (e.key === 'Escape') {
        if (editingNodeId) setEditingNodeId(null)
        else if (cmdkOpen) setCmdkOpen(false)
        else handleSelect(null, false)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, editingNodeId, cmdkOpen, nodeActions, handleSelect])

  /* ─── Loading / error ─────────────────────────── */

  if (loading) {
    return (
      <div className="state-screen">
        <span className="state-screen__logo">dt<span className="accent-dot">·</span></span>
        <div className="scan-bar"><div className="scan-bar__fill" /></div>
        <span className="state-screen__text blink">[INITIALIZING...]</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="state-screen">
        <div className="state-screen__alert">
          <span className="led led--red" />
          <span className="state-screen__error-title">[LINK FAILURE]</span>
        </div>
        <span className="state-screen__error-detail">{error}</span>
        <span className="state-screen__error-hint">MAKE SURE dt serve IS RUNNING</span>
        <button className="btn-technical" onClick={() => location.reload()}>
          <span className="btn-technical__icon">■</span> RETRY
        </button>
      </div>
    )
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <span className="app-header__logo">dt<span className="accent-dot">·</span></span>
          {projects.length > 1 ? (
            <ProjectSelector
              projects={projects}
              currentId={currentProjectId}
              onChange={handleProjectChange}
            />
          ) : (
            <span className="app-header__project">{data?.config.project ?? '—'}</span>
          )}
        </div>
        <div className="app-header__right">
          <button
            className="app-header__kbd"
            onClick={() => setCmdkOpen(true)}
            title="命令面板 (Ctrl+K)"
          >
            {Icon.search} <span className="kbd-label">SEARCH</span> <kbd>Ctrl</kbd><kbd>K</kbd>
          </button>
          <StatusBar nodes={nodes} />
          <div className="app-header__count-wrap">
            <span className="app-header__count">{nodes.length}</span>
            <span className="app-header__count-label">NODES</span>
          </div>
          {multiSelected.size > 0 && (
            <span className="app-header__multi" title="多选中">◆ {multiSelected.size}</span>
          )}
          <button
            className="btn-theme-toggle"
            onClick={handleExport}
            title="导出已选节点"
          >
            ⤓
          </button>
          <button
            className="btn-theme-toggle"
            onClick={handleImportClick}
            title="导入 bundle"
          >
            ⤒
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            className="btn-theme-toggle"
            onClick={triggerLayout}
            title="重新布局"
          >
            ⊞
          </button>
          <button
            className="btn-theme-toggle"
            onClick={toggle}
            title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
          >
            {theme === 'dark' ? 'LT' : 'DK'}
          </button>
        </div>
      </header>

      <div className="app-body">
        <DtCanvas
          dtNodes={nodes}
          selectedId={selectedId}
          multiSelected={multiSelected}
          onSelect={handleSelect}
          layoutTrigger={layoutTrigger}
          nodeActions={nodeActions}
          editingNodeId={editingNodeId}
          onConnect={handleEdgeConnect}
          onDeleteEdge={handleEdgeDelete}
          onCommitEdgeSummary={handleEdgeCommitSummary}
          onAddRoot={handleAddRoot}
        />
        {selectedNode && (
          <>
            <div className="resize-handle" onMouseDown={handleResizeStart} />
            <DetailPanel
              node={selectedNode}
              allNodes={nodes}
              collapsed={panelCollapsed}
              onToggleCollapse={() => setPanelCollapsed(c => !c)}
              saveFns={{ updateFrontmatter, updateContent, createNode, deleteNode, createEdge, deleteEdge, updateEdge }}
              onSelectNode={(id) => handleSelect(id, false)}
              width={panelWidth}
            />
          </>
        )}
      </div>

      {cmdkOpen && (
        <CommandPalette
          nodes={nodes}
          onClose={() => setCmdkOpen(false)}
          onSelectNode={(id) => { handleSelect(id, false); setCmdkOpen(false) }}
          actions={[
            { id: 'add-root',  label: '＋ 新增根节点',          run: () => { setCmdkOpen(false); handleAddRoot() } },
            { id: 'relayout',  label: '⟲ 重新布局',             run: () => { setCmdkOpen(false); triggerLayout() } },
            { id: 'export',    label: '⤓ 导出已选节点',         run: () => { setCmdkOpen(false); handleExport() } },
            { id: 'import',    label: '⤒ 导入 bundle',           run: () => { setCmdkOpen(false); handleImportClick() } },
            { id: 'theme',     label: '☼ 切换主题',              run: () => { setCmdkOpen(false); toggle() } },
          ]}
        />
      )}
    </>
  )
}
