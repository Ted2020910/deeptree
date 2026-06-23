import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnNodeDrag,
  type OnConnect,
} from '@xyflow/react'
import Dagre from '@dagrejs/dagre'
import type { DtNode } from '../types'
import { NodeCard, type DtFlowNode, type DtFlowNodeData, type NodeCardActions } from './NodeCard'
import { CustomEdge, type DtFlowEdge } from './CustomEdge'
import { DotWaveBackground } from './DotWaveBackground'

const nodeTypes = { dtNode: NodeCard }
const edgeTypes = { dtEdge: CustomEdge }

const NODE_W = 280
const NODE_H = 96

function getEdgeColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--edge-color').trim() || '#94A3B8'
}

function computeLayout(dtNodes: DtNode[]): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 48, marginx: 64, marginy: 64 })

  dtNodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))

  const edgeSet = new Set<string>()
  dtNodes.forEach(n => {
    n.edges.forEach(e => {
      if (e.type === 'to' && !e.target.includes('::')) {
        const key = `${n.id}→${e.target}`
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          g.setEdge(n.id, e.target)
        }
      }
    })
  })

  Dagre.layout(g)

  const posMap = new Map<string, { x: number; y: number }>()
  dtNodes.forEach(n => {
    const pos = g.node(n.id)
    if (pos) {
      posMap.set(n.id, { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 })
    }
  })
  return posMap
}

function buildEdges(
  dtNodes: DtNode[],
  onCommitSummary?: (source: string, target: string, summary: string) => void,
  onRequestDelete?: (source: string, target: string, type?: 'from' | 'to') => void,
  editingEdgeKey?: string | null,
  onEditClose?: () => void,
): DtFlowEdge[] {
  const rfEdges: DtFlowEdge[] = []
  const edgeSet = new Set<string>()
  const markerColor = getEdgeColor()
  const nodeIds = new Set(dtNodes.map(n => n.id))

  dtNodes.forEach(n => {
    n.edges.forEach(e => {
      if (e.type === 'to' && !e.target.includes('::') && nodeIds.has(e.target)) {
        const key = `${n.id}→${e.target}`
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          rfEdges.push({
            id: key,
            source: n.id,
            target: e.target,
            type: 'dtEdge',
            data: {
              edgeType: 'parent',
              summary: e.summary,
              onCommitSummary: onCommitSummary
                ? (next: string) => onCommitSummary(n.id, e.target, next)
                : undefined,
              onRequestDelete: onRequestDelete
                ? () => onRequestDelete(n.id, e.target, e.type)
                : undefined,
              externalEdit: editingEdgeKey === key,
              onEditClose,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: markerColor,
              width: 10,
              height: 10,
            },
          })
        }
      }
    })
  })

  return rfEdges
}

interface DtCanvasProps {
  dtNodes: DtNode[]
  selectedId: string | null
  multiSelected?: Set<string>
  onSelect: (id: string | null, additive: boolean) => void
  layoutTrigger?: number
  onConnect?: (source: string, target: string) => void
  onDeleteEdge?: (source: string, target: string, type?: 'from' | 'to') => void
  onCommitEdgeSummary?: (source: string, target: string, summary: string) => void
  onAddRoot?: () => void
  onAddNode?: () => void
  nodeActions?: NodeCardActions
  editingNodeId?: string | null
}

export function DtCanvas({
  dtNodes, selectedId, multiSelected, onSelect, layoutTrigger,
  onConnect, onDeleteEdge, onCommitEdgeSummary, onAddRoot, onAddNode, nodeActions, editingNodeId,
}: DtCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<DtFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<DtFlowEdge>([])
  const [editingEdgeKey, setEditingEdgeKey] = useState<string | null>(null)

  const layoutPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const userPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const prevNodeIds = useRef<Set<string>>(new Set())

  const onNodeDragStop: OnNodeDrag<DtFlowNode> = useCallback((_event, node) => {
    userPositions.current.set(node.id, node.position)
  }, [])

  useEffect(() => {
    if (layoutTrigger === undefined || prevNodeIds.current.size === 0) return
    userPositions.current.clear()
    const posMap = computeLayout(dtNodes)
    posMap.forEach((pos, id) => layoutPositions.current.set(id, pos))
    setNodes(prev => prev.map(n => ({
      ...n,
      position: layoutPositions.current.get(n.id) ?? n.position,
    })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutTrigger])

  const handleEdgeEditClose = useCallback(() => setEditingEdgeKey(null), [])

  useEffect(() => {
    if (dtNodes.length === 0) {
      setNodes([])
      setEdges([])
      prevNodeIds.current.clear()
      layoutPositions.current.clear()
      userPositions.current.clear()
      return
    }

    const currentIds = new Set(dtNodes.map(n => n.id))
    const isFirstLoad = prevNodeIds.current.size === 0
    const hasNewNodes = dtNodes.some(n => !prevNodeIds.current.has(n.id))
    const hasRemovedNodes = [...prevNodeIds.current].some(id => !currentIds.has(id))

    if (isFirstLoad || hasNewNodes) {
      const posMap = computeLayout(dtNodes)
      posMap.forEach((pos, id) => {
        if (isFirstLoad || !prevNodeIds.current.has(id)) {
          layoutPositions.current.set(id, pos)
        }
      })
    }

    if (hasRemovedNodes) {
      prevNodeIds.current.forEach(id => {
        if (!currentIds.has(id)) {
          layoutPositions.current.delete(id)
          userPositions.current.delete(id)
        }
      })
    }

    const rfNodes: DtFlowNode[] = dtNodes.map(n => ({
      id: n.id,
      type: 'dtNode' as const,
      position: userPositions.current.get(n.id)
        ?? layoutPositions.current.get(n.id)
        ?? { x: 0, y: 0 },
      data: { ...n, __actions: nodeActions, __editing: editingNodeId === n.id } as DtFlowNodeData,
    }))

    prevNodeIds.current = currentIds
    setNodes(rfNodes)
    setEdges(buildEdges(dtNodes, onCommitEdgeSummary, onDeleteEdge, editingEdgeKey, handleEdgeEditClose))
  }, [dtNodes, setNodes, setEdges, onCommitEdgeSummary, onDeleteEdge, editingEdgeKey, handleEdgeEditClose])

  // Re-inject actions / editing flags without rebuilding layout
  useEffect(() => {
    setNodes(prev => prev.map(n => ({
      ...n,
      data: { ...n.data, __actions: nodeActions, __editing: editingNodeId === n.id } as DtFlowNodeData,
    })))
  }, [nodeActions, editingNodeId, setNodes])

  // Re-inject edge editing state without rebuilding layout
  useEffect(() => {
    setEdges(prev => prev.map(e => ({
      ...e,
      data: e.data ? {
        ...e.data,
        externalEdit: editingEdgeKey === e.id,
        onEditClose: handleEdgeEditClose,
      } : e.data,
    })))
  }, [editingEdgeKey, handleEdgeEditClose, setEdges])

  const onNodeClick: NodeMouseHandler<DtFlowNode> = useCallback(
    (event, node) => onSelect(node.id, event.ctrlKey || event.metaKey || event.shiftKey),
    [onSelect],
  )

  const onPaneClick = useCallback(() => onSelect(null, false), [onSelect])

  const handleConnect: OnConnect = useCallback((c) => {
    if (!onConnect || !c.source || !c.target || c.source === c.target) return
    onConnect(c.source, c.target)
  }, [onConnect])

  // 双击连线 → 进入摘要编辑（不再删除）
  const onEdgeDoubleClick: EdgeMouseHandler = useCallback((_e, edge) => {
    setEditingEdgeKey(edge.id)
  }, [])

  return (
    <div className="canvas-wrap">
      <DotWaveBackground />
      <ReactFlow
        nodes={nodes.map(n => ({
          ...n,
          selected: n.id === selectedId,
          className: multiSelected?.has(n.id) ? 'dt-multi-selected' : undefined,
        }))}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onConnect={handleConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable
        elementsSelectable
        connectionRadius={32}
      >
        <Controls showInteractive={false} />
      </ReactFlow>

      {dtNodes.length === 0 && (
        <div className="canvas-empty">
          <span className="canvas-empty__logo">dt<span className="accent-dot">·</span></span>
          <span className="canvas-empty__title">AWAITING INPUT</span>
          {onAddRoot ? (
            <button className="btn-technical" onClick={onAddRoot}>
              <span className="btn-technical__icon">＋</span> 创建根节点
            </button>
          ) : (
            <span className="canvas-empty__cmd"><span>&gt;</span> dt add goal "..." --root</span>
          )}
        </div>
      )}

      {dtNodes.length > 0 && (onAddRoot || onAddNode) && (
        <div className="canvas-add-actions">
          {onAddNode && (
            <button
              className="btn-technical"
              onClick={onAddNode}
              title="新增未挂接节点"
            >
              <span className="btn-technical__icon">＋</span> 节点
            </button>
          )}
          {onAddRoot && (
            <button
              className="btn-technical"
              onClick={onAddRoot}
              title="新增根节点"
            >
              <span className="btn-technical__icon">＋</span> 根节点
            </button>
          )}
        </div>
      )}
    </div>
  )
}
