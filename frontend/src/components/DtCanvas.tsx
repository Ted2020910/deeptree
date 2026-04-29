import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react'
import Dagre from '@dagrejs/dagre'
import type { DtNode } from '../types'
import { NodeCard, type DtFlowNode } from './NodeCard'
import { CustomEdge, type DtFlowEdge } from './CustomEdge'
import { DotWaveBackground } from './DotWaveBackground'

const nodeTypes = { dtNode: NodeCard }
const edgeTypes = { dtEdge: CustomEdge }

const NODE_W = 280
const NODE_H = 88

function getEdgeColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--edge-color').trim() || '#888888'
}

/**
 * 用 Dagre 计算全局布局，返回每个节点的位置 map。
 * 通过 edges type=to 建图（父→子），保证层级结构正确。
 */
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

function buildEdges(dtNodes: DtNode[]): DtFlowEdge[] {
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
            data: { edgeType: 'parent', summary: e.summary },
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
  onSelect: (id: string | null) => void
  /** 外部触发"一键整理"布局（每次值变化就重新布局） */
  layoutTrigger?: number
}

export function DtCanvas({ dtNodes, selectedId, onSelect, layoutTrigger }: DtCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<DtFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<DtFlowEdge>([])

  /**
   * 位置存储策略（两层）：
   * - layoutPositions：Dagre 计算的布局位置（首次加载或新节点时更新）
   * - userPositions：用户拖拽后的位置（drag 结束时记录，优先级最高）
   *
   * 内容更新（WS 推送 status/summary 变化）时不重算布局，
   * 直接复用已有位置，避免画布重置。
   */
  const layoutPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const userPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const prevNodeIds = useRef<Set<string>>(new Set())

  // 只在 drag 结束时记录位置，不拦截 ReactFlow 内部的 position 事件
  const onNodeDragStop: OnNodeDrag<DtFlowNode> = useCallback((_event, node) => {
    userPositions.current.set(node.id, node.position)
  }, [])

  // 一键整理：清空 userPositions，强制重算 Dagre 布局
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

  // 数据变化时更新节点
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

    // 首次加载或有新节点时重算布局
    if (isFirstLoad || hasNewNodes) {
      const posMap = computeLayout(dtNodes)
      posMap.forEach((pos, id) => {
        // 已有节点保留旧布局位置，只给新节点赋值
        if (isFirstLoad || !prevNodeIds.current.has(id)) {
          layoutPositions.current.set(id, pos)
        }
      })
    }

    // 清理已删除节点的缓存
    if (hasRemovedNodes) {
      prevNodeIds.current.forEach(id => {
        if (!currentIds.has(id)) {
          layoutPositions.current.delete(id)
          userPositions.current.delete(id)
        }
      })
    }

    // 位置优先级：用户拖拽 > Dagre 布局
    const rfNodes: DtFlowNode[] = dtNodes.map(n => ({
      id: n.id,
      type: 'dtNode' as const,
      position: userPositions.current.get(n.id)
        ?? layoutPositions.current.get(n.id)
        ?? { x: 0, y: 0 },
      data: n,
    }))

    prevNodeIds.current = currentIds
    setNodes(rfNodes)
    setEdges(buildEdges(dtNodes))
  }, [dtNodes, setNodes, setEdges])

  const onNodeClick: NodeMouseHandler<DtFlowNode> = useCallback(
    (_, node) => onSelect(node.id),
    [onSelect],
  )

  const onPaneClick = useCallback(() => onSelect(null), [onSelect])

  return (
    <div className="canvas-wrap">
      <DotWaveBackground />
      <ReactFlow
        nodes={nodes.map(n => ({ ...n, selected: n.id === selectedId }))}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable
        elementsSelectable
      >
        <Controls showInteractive={false} />
      </ReactFlow>

      {dtNodes.length === 0 && (
        <div className="canvas-empty">
          <span className="canvas-empty__logo">dt<span className="accent-dot">·</span></span>
          <span className="canvas-empty__title">AWAITING INPUT</span>
          <span className="canvas-empty__cmd"><span>&gt;</span> dt add goal "..." --root</span>
        </div>
      )}
    </div>
  )
}
