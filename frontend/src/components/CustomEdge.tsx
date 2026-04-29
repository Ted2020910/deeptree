import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'

export type DtFlowEdgeData = { edgeType: 'parent' | 'cross'; summary: string }
export type DtFlowEdge = Edge<DtFlowEdgeData, 'dtEdge'>

function getCssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return val || fallback
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<DtFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isCross = data?.edgeType === 'cross'

  const edgeColor = getCssVar('--edge-color', '#888888')
  const edgeColorDim = getCssVar('--edge-color-dim', '#666666')

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={isCross ? undefined : markerEnd}
        className={isCross ? '' : 'edge-flow'}
        style={{
          stroke: isCross ? edgeColorDim : edgeColor,
          strokeWidth: isCross ? 2 : 2.5,
          strokeDasharray: isCross ? '2 6' : '4 5',
          strokeLinecap: 'round',
        }}
      />
      {data?.summary && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              position: 'absolute',
            }}
          >
            {data.summary}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
