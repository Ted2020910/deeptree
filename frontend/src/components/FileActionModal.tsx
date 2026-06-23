import { useEffect, useMemo, useState } from 'react'
import { FilePlus2, FolderPlus, WandSparkles, X } from 'lucide-react'
import type { DtNode } from '../types'

type Mode = 'node' | 'folder' | 'promote'

interface Props {
  open: boolean
  mode: Mode
  projectPath: string
  nodes: DtNode[]
  onClose: () => void
  onCreateNode: (input: { type: string; title: string; summary: string; directory: string; root?: boolean }) => Promise<void>
  onCreateFolder: (path: string) => Promise<void>
  onPromoteMarkdown: (input: { path: string; type: string; title: string; summary: string; root?: boolean }) => Promise<void>
}

const TYPE_OPTIONS = ['goal', 'subproblem', 'task', 'decision', 'document', 'explore']

export function FileActionModal({
  open,
  mode,
  projectPath,
  nodes,
  onClose,
  onCreateNode,
  onCreateFolder,
  onPromoteMarkdown,
}: Props) {
  const [pathValue, setPathValue] = useState(projectPath)
  const [type, setType] = useState('document')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [root, setRoot] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setPathValue(projectPath)
    setTitle('')
    setSummary('')
    setRoot(false)
    setType(mode === 'promote' ? 'document' : 'explore')
    setBusy(false)
    setError('')
  }, [open, mode, projectPath])

  useEffect(() => {
    if (!open || mode !== 'promote') return
    const inferred = nodes.find(n => n.path === projectPath)
    if (inferred?.title) setTitle(inferred.title)
  }, [open, mode, projectPath, nodes])

  const heading = useMemo(() => {
    switch (mode) {
      case 'folder': return { icon: <FolderPlus size={16} />, title: '新建文件夹' }
      case 'promote': return { icon: <WandSparkles size={16} />, title: '转为 DT 节点' }
      default: return { icon: <FilePlus2 size={16} />, title: '新建 DT 节点' }
    }
  }, [mode])

  if (!open) return null

  async function submit() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'folder') {
        await onCreateFolder(pathValue.trim())
      } else if (mode === 'promote') {
        const normalized = pathValue.trim().replace(/\\/g, '/')
        const target = nodes.find(n => n.path === normalized)
        const resolvedTitle = title.trim() || target?.title || pathValue.split('/').pop() || 'Untitled'
        await onPromoteMarkdown({
          path: normalized,
          type,
          title: resolvedTitle,
          summary,
          root,
        })
      } else {
        await onCreateNode({
          type,
          title: title.trim() || '未命名',
          summary,
          directory: pathValue.trim(),
          root,
        })
      }
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="action-modal__backdrop" onClick={() => { if (!busy) onClose() }}>
      <div className="action-modal" onClick={event => event.stopPropagation()}>
        <div className="action-modal__header">
          <div className="action-modal__title">
            {heading.icon}
            <span>{heading.title}</span>
          </div>
          <button className="action-modal__close" onClick={onClose} disabled={busy} aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="action-modal__body">
          <label className="action-modal__field">
            <span>位置</span>
            <input value={pathValue} onChange={event => setPathValue(event.target.value)} placeholder="目录或 Markdown 路径" />
          </label>

          {mode !== 'folder' && (
            <>
              <label className="action-modal__field">
                <span>类型</span>
                <select value={type} onChange={event => setType(event.target.value)}>
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label className="action-modal__field">
                <span>标题</span>
                <input value={title} onChange={event => setTitle(event.target.value)} placeholder="留空则自动生成" />
              </label>

              <label className="action-modal__field">
                <span>摘要</span>
                <textarea value={summary} onChange={event => setSummary(event.target.value)} rows={3} placeholder="可选" />
              </label>

              <label className="action-modal__switch">
                <input type="checkbox" checked={root} onChange={event => setRoot(event.target.checked)} />
                <span>设为根节点</span>
              </label>
            </>
          )}

          {error && <div className="action-modal__error">{error}</div>}
        </div>

        <div className="action-modal__footer">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? '处理中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
