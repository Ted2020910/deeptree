import { useState, useEffect, useCallback } from 'react'
import { useTree } from './hooks/useTree'
import { useProjects } from './hooks/useProjects'
import { DtCanvas } from './components/DtCanvas'
import { DetailPanel } from './components/DetailPanel'
import { StatusBar } from './components/StatusBar'
import { ProjectSelector } from './components/ProjectSelector'

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
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

function getInitialProjectId(projects: { id: string; reachable: boolean }[]): string {
  // 优先读 URL query param
  const params = new URLSearchParams(location.search)
  const fromUrl = params.get('project')
  if (fromUrl && projects.find(p => p.id === fromUrl)) return fromUrl
  // 否则取第一个可达项目
  return projects.find(p => p.reachable)?.id ?? projects[0]?.id ?? ''
}

export default function App() {
  const { projects, loading: projectsLoading, error: projectsError } = useProjects()
  const [currentProjectId, setCurrentProjectId] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [layoutTrigger, setLayoutTrigger] = useState(0)
  const { theme, toggle } = useTheme()
  const triggerLayout = useCallback(() => setLayoutTrigger(n => n + 1), [])

  // 项目列表加载完后，确定初始项目
  useEffect(() => {
    if (projects.length > 0 && !currentProjectId) {
      setCurrentProjectId(getInitialProjectId(projects))
    }
  }, [projects, currentProjectId])

  const { data, loading: treeLoading, error: treeError, updateFrontmatter, updateContent } = useTree(currentProjectId)

  const loading = projectsLoading || (!!currentProjectId && treeLoading)
  const error = projectsError ?? (currentProjectId ? treeError : null)

  const nodes = data?.nodes ?? []
  const selectedNode = nodes.find(n => n.id === selectedId) ?? null

  const handleProjectChange = (id: string) => {
    setCurrentProjectId(id)
    setSelectedId(null)
    history.replaceState(null, '', `?project=${id}`)
  }

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="state-screen">
        <span className="state-screen__logo">dt<span className="accent-dot">·</span></span>
        <div className="scan-bar"><div className="scan-bar__fill" /></div>
        <span className="state-screen__text blink">[INITIALIZING...]</span>
      </div>
    )
  }

  /* ─── Error ─── */
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
          <StatusBar nodes={nodes} />
          <div className="app-header__count-wrap">
            <span className="app-header__count">{nodes.length}</span>
            <span className="app-header__count-label">NODES</span>
          </div>
          <button
            className="btn-theme-toggle"
            onClick={triggerLayout}
            title="重新整理布局"
          >
            ⊞
          </button>
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
          layoutTrigger={layoutTrigger}
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
