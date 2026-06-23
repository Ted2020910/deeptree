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
  path?: string
}

export interface TreeApiResponse {
  config: { project: string; created: string }
  nodes: DtNode[]
}

export interface FileTreeDtNodeMarker {
  id: string
  title: string
  type: string
  status: DtNode['status']
  root: boolean
}

export interface FileTreeEntry {
  name: string
  path: string
  type: 'directory' | 'file'
  isMarkdown?: boolean
  dtNode?: FileTreeDtNodeMarker
  children?: FileTreeEntry[]
}

export interface FileTreeResponse {
  root: FileTreeEntry
  updated: string
}

export interface CreateNodeInput {
  type: string
  title: string
  summary?: string
  froms?: string[]
  root?: boolean
  path?: string
  directory?: string
  filename?: string
}

export interface PromoteNodeInput {
  path: string
  type?: string
  title?: string
  summary?: string
  froms?: string[]
  root?: boolean
}

export interface SaveFns {
  updateFrontmatter: (id: string, updates: Partial<Pick<DtNode, 'title' | 'summary' | 'status' | 'type'>>) => Promise<void>
  updateContent: (id: string, content: string) => Promise<void>
  createNode: (input: CreateNodeInput) => Promise<string>
  promoteNode?: (input: PromoteNodeInput) => Promise<string>
  deleteNode: (id: string) => Promise<void>
  createEdge: (input: { source: string; target: string; type: 'from' | 'to'; summary?: string }) => Promise<void>
  deleteEdge: (input: { source: string; target: string; type?: 'from' | 'to' }) => Promise<void>
  requestDeleteEdge?: (input: { source: string; target: string; type?: 'from' | 'to' }) => Promise<void>
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

