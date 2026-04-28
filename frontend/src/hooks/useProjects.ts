import { useState, useEffect } from 'react'
import type { ProjectInfo, ProjectsApiResponse } from '../types'

export function useProjects() {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<ProjectsApiResponse>
      })
      .then(data => {
        setProjects(data.projects)
        setError(null)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return { projects, loading, error }
}
