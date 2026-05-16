import { useEffect, useMemo, useRef, useState } from 'react'
import type { DtNode } from '../types'

interface PaletteAction {
  id: string
  label: string
  run: () => void
}

interface Props {
  nodes: DtNode[]
  actions: PaletteAction[]
  onClose: () => void
  onSelectNode: (id: string) => void
}

type Item =
  | { kind: 'node'; node: DtNode }
  | { kind: 'action'; action: PaletteAction }

export function CommandPalette({ nodes, actions, onClose, onSelectNode }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const items: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matchedActions = q
      ? actions.filter(a => a.label.toLowerCase().includes(q))
      : actions
    const matchedNodes = q
      ? nodes.filter(n =>
          n.id.toLowerCase().includes(q) ||
          (n.title || '').toLowerCase().includes(q) ||
          (n.summary || '').toLowerCase().includes(q),
        ).slice(0, 30)
      : nodes.slice(0, 12)
    return [
      ...matchedActions.map(a => ({ kind: 'action' as const, action: a })),
      ...matchedNodes.map(n => ({ kind: 'node' as const, node: n })),
    ]
  }, [query, nodes, actions])

  useEffect(() => { setActive(0) }, [query])

  function pick(item: Item) {
    if (item.kind === 'action') item.action.run()
    else { onSelectNode(item.node.id) }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) pick(items[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk__input"
          placeholder="搜节点 / 命令…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="cmdk__list">
          {items.length === 0 && <div className="cmdk__empty">没有匹配项</div>}

          {items.length > 0 && items[0].kind === 'action' && (
            <div className="cmdk__group-label">动作</div>
          )}
          {items.map((item, i) => {
            const isAction = item.kind === 'action'
            const showNodeHeader =
              !isAction &&
              (i === 0 || items[i - 1].kind === 'action')
            return (
              <div key={isAction ? `a-${item.action.id}` : `n-${item.node.id}`}>
                {showNodeHeader && <div className="cmdk__group-label">节点</div>}
                <div
                  className={`cmdk__item ${i === active ? 'cmdk__item--active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(item)}
                >
                  {isAction ? (
                    <span>{item.action.label}</span>
                  ) : (
                    <>
                      <span className="cmdk__item-id">#{item.node.id}</span>
                      <span className="cmdk__item-title">{item.node.title || '未命名'}</span>
                      <span className="cmdk__item-meta">{item.node.type}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="cmdk__hint">
          <span><kbd>↑</kbd> <kbd>↓</kbd> 选择</span>
          <span><kbd>↵</kbd> 确认</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  )
}
