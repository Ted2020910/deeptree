import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
} from '@xyflow/react'
import Dagre from '@dagrejs/dagre'
import type { DtNode } from '../types'
import { NodeCard, type DtFlowNode } from './NodeCard'
import { CustomEdge, type DtFlowEdge } from './CustomEdge'

const nodeTypes = { dtNode: NodeCard }
const edgeTypes = { dtEdge: CustomEdge }

const NODE_W = 280
const NODE_H = 88

function buildLayout(dtNodes: DtNode[]): { nodes: DtFlowNode[]; edges: DtFlowEdge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 72, nodesep: 40, marginx: 48, marginy: 48 })

  const rfNodes: DtFlowNode[] = dtNodes.map(n => ({
    id: n.id,
    type: 'dtNode' as const,
    position: { x: 0, y: 0 },
    data: n,
  }))

  const rfEdges: DtFlowEdge[] = []
  const edgeSet = new Set<string>()

  dtNodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))

  dtNodes.forEach(n => {
    // Parent-child edge
    if (n.parent) {
      const key = `${n.parent}→${n.id}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        g.setEdge(n.parent, n.id)
        rfEdges.push({
          id: key,
          source: n.parent,
          target: n.id,
          type: 'dtEdge',
          data: { edgeType: 'parent', summary: '' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#CCCCCC', width: 12, height: 12 },
        })
      }
    }

    // Cross-branch edges
    n.edges.forEach(e => {
      if (e.direction !== 'from') {
        const key = [n.id, e.target].sort().join('↔')
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          rfEdges.push({
            id: `${n.id}--${e.target}`,
            source: n.id,
            target: e.target,
            type: 'dtEdge',
            data: { edgeType: 'related', summary: e.summary },
          })
        }
      }
    })
  })

  Dagre.layout(g)

  const layoutedNodes = rfNodes.map(node => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } }
  })

  return { nodes: layoutedNodes, edges: rfEdges }
}

interface DtCanvasProps {
  dtNodes: DtNode[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function DtCanvas({ dtNodes, selectedId, onSelect }: DtCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<DtFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<DtFlowEdge>([])

  useEffect(() => {
    if (dtNodes.length === 0) return
    const { nodes: ln, edges: le } = buildLayout(dtNodes)
    setNodes(ln)
    setEdges(le)
  }, [dtNodes, setNodes, setEdges])

  const onNodeClick: NodeMouseHandler<DtFlowNode> = useCallback(
    (_, node) => onSelect(node.id),
    [onSelect],
  )

  const onPaneClick = useCallback(() => onSelect(null), [onSelect])

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={nodes.map(n => ({ ...n, selected: n.id === selectedId }))}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable
        elementsSelectable
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#CCCCCC"
        />
        <Controls showInteractive={false} />
      </ReactFlow>

      {dtNodes.length === 0 && (
        <div className="canvas-empty">
          <span className="canvas-empty__title">NO NODES — RUN dt add TO BEGIN</span>
        </div>
      )}
    </div>
  )
}
