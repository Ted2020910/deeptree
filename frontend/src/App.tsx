import { useState, useEffect } from 'react'
import { useTree } from './hooks/useTree'
import { DtCanvas } from './components/DtCanvas'
import { DetailPanel } from './components/DetailPanel'
import { StatusBar } from './components/StatusBar'

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    // Read from DOM (set by index.html inline script)
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.dataset.theme = 'light'
    } else {
      delete document.documentElement.dataset.theme
    }
    localStorage.setItem('dt-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggle }
}

export default function App() {
  const { data, loading, error, updateFrontmatter, updateContent } = useTree()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { theme, toggle } = useTheme()

  const nodes = data?.nodes ?? []
  const selectedNode = nodes.find(n => n.id === selectedId) ?? null

  /* ─── Loading: scan animation ─── */
  if (loading) {
    return (
      <div className="state-screen">
        <span className="state-screen__logo">dt<span className="accent-dot">·</span></span>
        <div className="scan-bar">
          <div className="scan-bar__fill" />
        </div>
        <span className="state-screen__text blink">[INITIALIZING...]</span>
      </div>
    )
  }

  /* ─── Error: red alert ─── */
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
          <span className="app-header__project">{data?.config.project ?? '—'}</span>
        </div>
        <div className="app-header__right">
          <StatusBar nodes={nodes} />
          <div className="app-header__count-wrap">
            <span className="app-header__count">{nodes.length}</span>
            <span className="app-header__count-label">NODES</span>
          </div>
          <button
            className="btn-theme-toggle"
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? 'LT' : 'DK'}
          </button>
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
