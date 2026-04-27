import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'

export type DtFlowEdgeData = { edgeType: 'parent' | 'related'; summary: string }
export type DtFlowEdge = Edge<DtFlowEdgeData, 'dtEdge'>

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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: '#CCCCCC',
          strokeWidth: 1.5,
          strokeDasharray: isRelated ? '5 4' : undefined,
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
