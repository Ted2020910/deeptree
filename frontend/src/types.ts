export interface DtEdge {
  target: string
  type: 'from' | 'to'
  summary: string
  depth?: number
}

export interface DtNode extends Record<string, unknown> {
  id: string
  root: boolean
  title: string
  summary: string
  type: string
  status: 'pending' | 'in_progress' | 'decided' | 'completed' | 'rejected'
  edges: DtEdge[]
  created: string
  content: string
}

export interface TreeApiResponse {
  config: { project: string; created: string }
  nodes: DtNode[]
}

export interface SaveFns {
  updateFrontmatter: (id: string, updates: Partial<Pick<DtNode, 'title' | 'summary' | 'status' | 'type'>>) => Promise<void>
  updateContent: (id: string, content: string) => Promise<void>
  createNode: (input: { type: string; title: string; summary?: string; froms?: string[]; root?: boolean }) => Promise<string>
  deleteNode: (id: string) => Promise<void>
  createEdge: (input: { source: string; target: string; type: 'from' | 'to'; summary?: string }) => Promise<void>
  deleteEdge: (input: { source: string; target: string; type?: 'from' | 'to' }) => Promise<void>
  updateEdge: (input: { source: string; target: string; type?: 'from' | 'to'; summary: string }) => Promise<void>
}

export interface ProjectInfo {
  id: string
  name: string
  path: string
  reachable: boolean
}

export interface ProjectsApiResponse {
  projects: ProjectInfo[]
}
