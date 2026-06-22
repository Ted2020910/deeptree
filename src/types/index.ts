// ============================================================
// dt CLI - Core Type Definitions (v3)
// ============================================================

// ─── Node Types ───────────────────────────────────────────────

/** 节点类型：预设值或自定义字符串 */
export type NodeType = string;

export type NodeStatus =
  | 'pending'
  | 'in_progress'
  | 'decided'
  | 'completed'
  | 'rejected';

/**
 * 边：节点之间的关系
 *
 * target 格式：
 *   - 当前项目节点：'015'
 *   - 跨项目节点：'app-backend::015'（projectId::nodeId）
 *
 * type：
 *   - 'from'：本节点来自目标节点（目标是父节点/前提）
 *   - 'to'：本节点指向目标节点（目标是子节点/推导结果）
 *
 * 双向存储：系统写入时自动补全反向边，用户/AI 只需写一侧。
 */
export interface Edge {
  target: string;
  type: 'from' | 'to';
  summary: string;
  /** 跨项目引用时拉取的节点深度（仅 target 含 '::' 时有效） */
  depth?: number;
}

export interface NodeRef {
  kind: 'file' | 'directory' | 'url' | string;
  path?: string;
  url?: string;
  role?: string;
  title?: string;
}

export interface NodeFrontmatter {
  /** 明确标记该 Markdown 是 dt 节点；旧节点可缺省 */
  dt?: 'node/v1' | string;
  id: string;
  /** 是否为根节点（无父节点，作为树的起点） */
  root: boolean;
  title: string;
  summary: string;
  type: NodeType;
  status: NodeStatus;
  edges: Edge[];
  /** 节点关联的外部文件、目录或资源 */
  refs?: NodeRef[];
  created: string;
}

export interface NodeFile {
  frontmatter: NodeFrontmatter;
  content: string; // Markdown body（自由内容）
  /** 节点 Markdown 文件相对项目根目录的路径 */
  path?: string;
}

// ─── Project file tree ───────────────────────────────────────

export interface FileTreeDtNodeMarker {
  id: string;
  title: string;
  type: NodeType;
  status: NodeStatus;
  root: boolean;
}

export interface FileTreeEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  isMarkdown?: boolean;
  dtNode?: FileTreeDtNodeMarker;
  children?: FileTreeEntry[];
}

export interface FileTreeResponse {
  root: FileTreeEntry;
  updated: string;
}

// ─── Tree Config (tree.yaml) ──────────────────────────────────

export interface TreeConfig {
  project: string;
  created: string;
}

// ─── Node index (.dt/index.yaml) ──────────────────────────────

export interface NodeIndexEntry {
  id: string;
  path: string;
  mtimeMs?: number;
  hash?: string;
  indexedAt?: string;
}

export interface NodeIndex {
  version: 1;
  updated: string;
  nodes: Record<string, NodeIndexEntry>;
}

// ─── Cross-project reference ──────────────────────────────────

/** 解析跨项目引用 "projectId::nodeId" */
export interface CrossRef {
  projectId: string;
  nodeId: string;
}

export function parseCrossRef(target: string): CrossRef | null {
  const idx = target.indexOf('::');
  if (idx === -1) return null;
  return {
    projectId: target.slice(0, idx),
    nodeId: target.slice(idx + 2),
  };
}

export function isCrossRef(target: string): boolean {
  return target.includes('::');
}
