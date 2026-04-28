import { useState, useEffect, useCallback } from 'react'
import type { TreeApiResponse, DtNode } from '../types'

export function useTree(projectId: string) {
  const [data, setData] = useState<TreeApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTree = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await fetch(`/api/projects/${projectId}/tree`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as TreeApiResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetchTree()

    let ws: WebSocket | null = null
    const connect = () => {
      try {
        ws = new WebSocket(`ws://${location.host}`)
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data) as { project?: string }
            // 只在匹配当前项目或广播时刷新
            if (!msg.project || msg.project === projectId || msg.project === '_default') {
              fetchTree()
            }
          } catch {
            fetchTree()
          }
        }
        ws.onclose = () => setTimeout(connect, 3000)
      } catch {
        setTimeout(connect, 3000)
      }
    }
    connect()
    return () => ws?.close()
  }, [fetchTree, projectId])

  const updateFrontmatter = useCallback(
    async (id: string, updates: Partial<Pick<DtNode, 'title' | 'summary' | 'status' | 'type'>>) => {
      await fetch(`/api/projects/${projectId}/nodes/${id}/frontmatter`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      await fetchTree()
    },
    [projectId, fetchTree],
  )

  const updateContent = useCallback(
    async (id: string, content: string) => {
      await fetch(`/api/projects/${projectId}/nodes/${id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      await fetchTree()
    },
    [projectId, fetchTree],
  )

  return { data, loading, error, refresh: fetchTree, updateFrontmatter, updateContent }
}
