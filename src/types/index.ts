// ============================================================
// dt CLI - Core Type Definitions (v2)
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

/** 边：节点之间的关系 */
export interface Edge {
  target: string;
  direction: 'from' | 'to' | 'related';
  summary: string;
  detail?: string; // 可选：链接到详细逻辑文件
}

export interface NodeFrontmatter {
  id: string;
  title: string;
  summary: string;
  type: NodeType;
  status: NodeStatus;
  parent: string | null;
  children: string[];
  edges: Edge[];
  created: string;
}

export interface NodeFile {
  frontmatter: NodeFrontmatter;
  content: string; // Markdown body（自由内容）
}

// ─── Tree Config (tree.yaml) ──────────────────────────────────

export interface TreeConfig {
  project: string;
  created: string;
  root_node: string | null;
}
