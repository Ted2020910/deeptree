import { useState, useRef, useEffect } from 'react'
import type { ProjectInfo } from '../types'

interface ProjectSelectorProps {
  projects: ProjectInfo[]
  currentId: string
  onChange: (id: string) => void
}

export function ProjectSelector({ projects, currentId, onChange }: ProjectSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = projects.find(p => p.id === currentId)

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (projects.length === 0) return null

  return (
    <div className="project-selector" ref={ref}>
      <button
        className="project-selector__trigger"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="project-selector__name">
          {current?.name ?? currentId}
        </span>
        <span className="project-selector__arrow">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="project-dropdown" role="listbox">
          {projects.map(p => (
            <button
              key={p.id}
              className={`project-dropdown__item ${p.id === currentId ? 'project-dropdown__item--active' : ''} ${!p.reachable ? 'project-dropdown__item--unreachable' : ''}`}
              onClick={() => {
                if (!p.reachable) return
                onChange(p.id)
                setOpen(false)
              }}
              disabled={!p.reachable}
              role="option"
              aria-selected={p.id === currentId}
            >
              <span className={`led ${p.id === currentId ? 'led--green' : p.reachable ? 'led--dim' : 'led--unreachable'}`} />
              <span className="project-dropdown__name">{p.name}</span>
              <span className="project-dropdown__id">[{p.id}]</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
