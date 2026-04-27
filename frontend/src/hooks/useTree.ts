import { useState, useEffect, useCallback } from 'react'
import type { TreeApiResponse, DtNode } from '../types'

export function useTree() {
  const [data, setData] = useState<TreeApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch('/api/tree')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as TreeApiResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTree()

    // Live updates via WebSocket
    let ws: WebSocket | null = null
    const connect = () => {
      try {
        ws = new WebSocket(`ws://${location.host}`)
        ws.onmessage = () => fetchTree()
        ws.onclose = () => setTimeout(connect, 3000)
      } catch {
        setTimeout(connect, 3000)
      }
    }
    connect()
    return () => ws?.close()
  }, [fetchTree])

  const updateFrontmatter = useCallback(
    async (id: string, updates: Partial<Pick<DtNode, 'title' | 'summary' | 'status' | 'type'>>) => {
      await fetch(`/api/nodes/${id}/frontmatter`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      await fetchTree()
    },
    [fetchTree],
  )

  const updateContent = useCallback(
    async (id: string, content: string) => {
      await fetch(`/api/nodes/${id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      await fetchTree()
    },
    [fetchTree],
  )

  return { data, loading, error, refresh: fetchTree, updateFrontmatter, updateContent }
}
