import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'

export type DtFlowEdgeData = { edgeType: 'parent' | 'related'; summary: string }
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

  const isRelated = data?.edgeType === 'related'

  const edgeColor = getCssVar('--edge-color', '#444444')
  const edgeColorDim = getCssVar('--edge-color-dim', '#333333')

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={isRelated ? undefined : markerEnd}
        className={isRelated ? '' : 'edge-flow'}
        style={{
          stroke: isRelated ? edgeColorDim : edgeColor,
          strokeWidth: isRelated ? 1.5 : 2,
          strokeDasharray: isRelated ? '1 8' : '2 6',
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
