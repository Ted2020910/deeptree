import type { DtNode } from '../types'

const STATUS_ORDER = ['decided', 'completed', 'in_progress', 'pending', 'rejected'] as const

const STATUS_COLORS: Record<string, string> = {
  decided:     '#4A9E5C',
  completed:   '#4A9E5C',
  in_progress: '#5B9BF6',
  pending:     '#D4A843',
  rejected:    '#D71921',
}

const STATUS_LABELS: Record<string, string> = {
  decided:     'DECIDED',
  completed:   'DONE',
  in_progress: 'ACTIVE',
  pending:     'PENDING',
  rejected:    'REJECTED',
}

interface StatusBarProps {
  nodes: DtNode[]
}

export function StatusBar({ nodes }: StatusBarProps) {
  const total = nodes.length
  if (total === 0) return null

  // Count per status
  const counts: Record<string, number> = {}
  nodes.forEach(n => {
    counts[n.status] = (counts[n.status] ?? 0) + 1
  })

  // Build segments
  const segments = STATUS_ORDER
    .filter(s => (counts[s] ?? 0) > 0)
    .map(status => ({
      status,
      count: counts[status]!,
      color: STATUS_COLORS[status] ?? '#666',
      label: STATUS_LABELS[status] ?? status.toUpperCase(),
      pct: (counts[status]! / total) * 100,
    }))

  // Stats text
  const statsText = segments
    .map(s => `${s.count} ${s.label}`)
    .join(' · ')

  return (
    <div className="status-bar-wrap">
      <div className="status-bar">
        {segments.map(s => (
          <div
            key={s.status}
            className="status-bar__segment"
            style={{ width: `${s.pct}%`, backgroundColor: s.color }}
          />
        ))}
      </div>
      <div className="status-stats">{statsText}</div>
    </div>
  )
}
