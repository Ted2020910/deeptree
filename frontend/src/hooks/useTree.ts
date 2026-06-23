import { useState, useEffect, useCallback } from 'react'
import type { TreeApiResponse, DtNode, CreateNodeInput, PromoteNodeInput } from '../types'

function reverseEdgeType(type: 'from' | 'to'): 'from' | 'to' {
  return type === 'from' ? 'to' : 'from'
}

function removeEdgeFromNodes(
  nodes: DtNode[],
  input: { source: string; target: string; type?: 'from' | 'to' },
): DtNode[] {
  return nodes.map(node => {
    if (node.id === input.source) {
      return {
        ...node,
        edges: node.edges.filter(edge => {
          if (edge.target !== input.target) return true
          if (input.type !== undefined && edge.type !== input.type) return true
          return false
        }),
      }
    }

    if (!input.target.includes('::') && node.id === input.target) {
      const reverseType = input.type ? reverseEdgeType(input.type) : undefined
      return {
        ...node,
        edges: node.edges.filter(edge => {
          if (edge.target !== input.source) return true
          if (reverseType !== undefined && edge.type !== reverseType) return true
          return false
        }),
      }
    }

    return node
  })
}

export function useTree(projectId: string) {
  const [data, setData] = useState<TreeApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTree = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await fetch(`/api/projects/${projectId}/tree?t=${Date.now()}`, { cache: 'no-store' })
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

  async function jsonFetch(url: string, init: RequestInit) {
    const res = await fetch(url, init)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`${res.status}: ${text || res.statusText}`)
    }
    return res.status === 204 ? null : res.json()
  }

  const createNode = useCallback(
    async (input: CreateNodeInput): Promise<string> => {
      const data = await jsonFetch(`/api/projects/${projectId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }) as { id: string }
      await fetchTree()
      return data.id
    },
    [projectId, fetchTree],
  )

  const promoteNode = useCallback(
    async (input: PromoteNodeInput): Promise<string> => {
      const data = await jsonFetch(`/api/projects/${projectId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }) as { id: string }
      await fetchTree()
      return data.id
    },
    [projectId, fetchTree],
  )

  const deleteNode = useCallback(
    async (id: string) => {
      const previous = data
      setData(prev => prev
        ? {
          ...prev,
          nodes: prev.nodes
            .filter(node => node.id !== id)
            .map(node => ({
              ...node,
              edges: node.edges.filter(edge => edge.target !== id),
            })),
        }
        : prev)
      try {
      await jsonFetch(`/api/projects/${projectId}/nodes/${id}`, { method: 'DELETE' })
      await fetchTree()
      } catch (error) {
        setData(previous)
        throw error
      }
    },
    [projectId, fetchTree, data],
  )

  const createEdge = useCallback(
    async (input: { source: string; target: string; type: 'from' | 'to'; summary?: string }) => {
      await jsonFetch(`/api/projects/${projectId}/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      await fetchTree()
    },
    [projectId, fetchTree],
  )

  const deleteEdge = useCallback(
    async (input: { source: string; target: string; type?: 'from' | 'to' }) => {
      const previous = data
      setData(prev => prev ? { ...prev, nodes: removeEdgeFromNodes(prev.nodes, input) } : prev)
      try {
      const qs = new URLSearchParams({ source: input.source, target: input.target })
      if (input.type) qs.set('type', input.type)
      await jsonFetch(`/api/projects/${projectId}/edges?${qs.toString()}`, { method: 'DELETE' })
      await fetchTree()
      } catch (error) {
        setData(previous)
        throw error
      }
    },
    [projectId, fetchTree, data],
  )

  const updateEdge = useCallback(
    async (input: { source: string; target: string; type?: 'from' | 'to'; summary: string }) => {
      await jsonFetch(`/api/projects/${projectId}/edges`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      await fetchTree()
    },
    [projectId, fetchTree],
  )

  return { data, loading, error, refresh: fetchTree, updateFrontmatter, updateContent, createNode, promoteNode, deleteNode, createEdge, deleteEdge, updateEdge }
}
