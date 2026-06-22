import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  GitBranchPlus,
  Plus,
} from 'lucide-react'
import type { FileTreeEntry } from '../types'

interface ProjectExplorerProps {
  root?: FileTreeEntry
  loading?: boolean
  error?: string | null
  selectedNodeId?: string | null
  selectedPath?: string
  onSelectNode: (id: string) => void
  onSelectPath: (path: string) => void
  onCreateNode: (directory: string) => void
  onCreateFolder: (directory: string) => void
  onRefresh?: () => void
}

function parentDirectory(path: string): string {
  if (!path || path === '.') return '.'
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return parts.length === 0 ? '.' : parts.join('/')
}

function directoryFor(entry: FileTreeEntry): string {
  return entry.type === 'directory' ? entry.path : parentDirectory(entry.path)
}

function flattenDirectories(root?: FileTreeEntry): string[] {
  if (!root) return ['.']
  const dirs: string[] = []
  function walk(entry: FileTreeEntry) {
    if (entry.type === 'directory') {
      dirs.push(entry.path)
      ;(entry.children ?? []).forEach(walk)
    }
  }
  walk(root)
  return dirs
}

function EntryRow({
  entry,
  depth,
  expanded,
  selectedNodeId,
  selectedPath,
  onToggle,
  onSelectNode,
  onSelectPath,
  onCreateNode,
  onCreateFolder,
}: {
  entry: FileTreeEntry
  depth: number
  expanded: Set<string>
  selectedNodeId?: string | null
  selectedPath?: string
  onToggle: (path: string) => void
  onSelectNode: (id: string) => void
  onSelectPath: (path: string) => void
  onCreateNode: (directory: string) => void
  onCreateFolder: (directory: string) => void
}) {
  const isDir = entry.type === 'directory'
  const isOpen = expanded.has(entry.path)
  const isSelected =
    (entry.dtNode && entry.dtNode.id === selectedNodeId) ||
    (!entry.dtNode && selectedPath === entry.path)
  const children = entry.children ?? []
  const hasChildren = children.length > 0

  function handleClick() {
    if (isDir) {
      onSelectPath(entry.path)
      if (hasChildren) onToggle(entry.path)
      return
    }
    onSelectPath(entry.path)
    if (entry.dtNode) onSelectNode(entry.dtNode.id)
  }

  return (
    <>
      <div
        className={`project-explorer__row ${isSelected ? 'project-explorer__row--selected' : ''} ${entry.dtNode ? 'project-explorer__row--dt' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={handleClick}
        title={entry.path}
      >
        <button
          className="project-explorer__twisty"
          onClick={(e) => { e.stopPropagation(); if (isDir && hasChildren) onToggle(entry.path) }}
          disabled={!isDir || !hasChildren}
          aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
        >
          {isDir && hasChildren ? (isOpen ? <ChevronDown /> : <ChevronRight />) : <span />}
        </button>
        <span className="project-explorer__icon">
          {isDir ? (isOpen ? <FolderOpen /> : <Folder />) : <FileText />}
        </span>
        <span className="project-explorer__name">{entry.name}</span>
        {entry.dtNode && <span className="project-explorer__badge">#{entry.dtNode.id}</span>}
        {isDir && (
          <span className="project-explorer__actions">
            <button
              title="在此新建 DT 节点"
              onClick={(e) => { e.stopPropagation(); onCreateNode(entry.path) }}
            >
              <GitBranchPlus />
            </button>
            <button
              title="新建文件夹"
              onClick={(e) => { e.stopPropagation(); onCreateFolder(entry.path) }}
            >
              <Plus />
            </button>
          </span>
        )}
      </div>
      {isDir && isOpen && children.map(child => (
        <EntryRow
          key={child.path}
          entry={child}
          depth={depth + 1}
          expanded={expanded}
          selectedNodeId={selectedNodeId}
          selectedPath={selectedPath}
          onToggle={onToggle}
          onSelectNode={onSelectNode}
          onSelectPath={onSelectPath}
          onCreateNode={onCreateNode}
          onCreateFolder={onCreateFolder}
        />
      ))}
    </>
  )
}

export function ProjectExplorer({
  root,
  loading,
  error,
  selectedNodeId,
  selectedPath,
  onSelectNode,
  onSelectPath,
  onCreateNode,
  onCreateFolder,
  onRefresh,
}: ProjectExplorerProps) {
  const directories = useMemo(() => flattenDirectories(root), [root])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['.']))

  const selectedDirectory = useMemo(() => {
    if (!selectedPath) return '.'
    const dir = root && selectedPath
      ? selectedPath.endsWith('.md') ? parentDirectory(selectedPath) : selectedPath
      : '.'
    return directories.includes(dir) ? dir : '.'
  }, [directories, root, selectedPath])

  function toggle(path: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function ensureDirectoryVisible(path: string) {
    const parts = path.split('/').filter(Boolean)
    setExpanded(prev => {
      const next = new Set(prev)
      next.add('.')
      let current = ''
      for (const part of parts) {
        current = current ? `${current}/${part}` : part
        next.add(current)
      }
      return next
    })
  }

  function handleCreateNode(directory: string) {
    ensureDirectoryVisible(directory)
    onCreateNode(directory)
  }

  function handleCreateFolder(directory: string) {
    ensureDirectoryVisible(directory)
    onCreateFolder(directory)
  }

  return (
    <aside className="project-explorer">
      <div className="project-explorer__header">
        <span>PROJECT</span>
        <button title="刷新文件树" onClick={onRefresh}>↻</button>
      </div>
      <div className="project-explorer__toolbar">
        <button onClick={() => handleCreateNode(selectedDirectory)}>
          <GitBranchPlus /> 节点
        </button>
        <button onClick={() => handleCreateFolder(selectedDirectory)}>
          <Plus /> 文件夹
        </button>
      </div>
      <div className="project-explorer__body">
        {loading && <div className="project-explorer__state">LOADING...</div>}
        {error && <div className="project-explorer__state project-explorer__state--error">{error}</div>}
        {!loading && !error && root && (
          <EntryRow
            entry={root}
            depth={0}
            expanded={expanded}
            selectedNodeId={selectedNodeId}
            selectedPath={selectedPath}
            onToggle={toggle}
            onSelectNode={(id) => {
              onSelectNode(id)
            }}
            onSelectPath={onSelectPath}
            onCreateNode={handleCreateNode}
            onCreateFolder={handleCreateFolder}
          />
        )}
      </div>
    </aside>
  )
}
