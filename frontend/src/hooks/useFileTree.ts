import { useCallback, useEffect, useState } from 'react'
import type { FileTreeResponse } from '../types'

async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${text || res.statusText}`)
  }
  return res.status === 204 ? null : res.json()
}

export function useFileTree(projectId: string) {
  const [data, setData] = useState<FileTreeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    if (!projectId) return
    try {
      const json = await jsonFetch(`/api/projects/${projectId}/files`) as FileTreeResponse
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
    fetchFiles()

    let ws: WebSocket | null = null
    const connect = () => {
      try {
        ws = new WebSocket(`ws://${location.host}`)
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data) as { project?: string }
            if (!msg.project || msg.project === projectId || msg.project === '_default') {
              fetchFiles()
            }
          } catch {
            fetchFiles()
          }
        }
        ws.onclose = () => setTimeout(connect, 3000)
      } catch {
        setTimeout(connect, 3000)
      }
    }
    connect()
    return () => ws?.close()
  }, [fetchFiles, projectId])

  const createFolder = useCallback(async (path: string): Promise<string> => {
    const result = await jsonFetch(`/api/projects/${projectId}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }) as { path: string }
    await fetchFiles()
    return result.path
  }, [projectId, fetchFiles])

  return { data, loading, error, refresh: fetchFiles, createFolder }
}
