import { useState } from 'react'
import { useTree } from './hooks/useTree'
import { DtCanvas } from './components/DtCanvas'
import { DetailPanel } from './components/DetailPanel'

export default function App() {
  const { data, loading, error, updateFrontmatter, updateContent } = useTree()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nodes = data?.nodes ?? []
  const selectedNode = nodes.find(n => n.id === selectedId) ?? null

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, letterSpacing: '0.06em', color: 'var(--text-disabled)' }}>
          [LOADING...]
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, letterSpacing: '0.06em', color: 'var(--accent)' }}>
          [ERROR: {error}]
        </span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text-disabled)' }}>
          MAKE SURE dt serve IS RUNNING
        </span>
      </div>
    )
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <span className="app-header__logo">dt</span>
          <span className="app-header__project">{data?.config.project ?? '—'}</span>
        </div>
        <div className="app-header__right">
          <span>{nodes.length} NODES</span>
        </div>
      </header>

      <div className="app-body">
        <DtCanvas
          dtNodes={nodes}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {selectedNode && (
          <DetailPanel
            node={selectedNode}
            allNodes={nodes}
            saveFns={{ updateFrontmatter, updateContent }}
          />
        )}
      </div>
    </>
  )
}
