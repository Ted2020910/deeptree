/**
 * node.ts — 节点 CRUD 操作 (v2)
 */

import fs from 'node:fs';
import path from 'node:path';
import { readFrontmatterFile, writeFrontmatterFile, updateFrontmatter } from './frontmatter.js';
import { requireDtRoot, getDtPaths, readTreeConfig, updateTreeConfig } from './project.js';
import { generateNextId, idToFilename } from '../utils/id.js';
import type { NodeFrontmatter, NodeFile, NodeStatus, Edge } from '../types/index.js';

/** 解析 dtRoot：有参数用参数，没有就 requireDtRoot() */
function resolveDtRoot(dtRoot?: string): string {
  return dtRoot ?? requireDtRoot();
}

/**
 * 获取节点文件路径
 */
export function getNodePath(nodeId: string, dtRoot?: string): string {
  const root = resolveDtRoot(dtRoot);
  const paths = getDtPaths(root);
  return path.join(paths.nodes, idToFilename(nodeId));
}

/**
 * 检查节点是否存在
 */
export function nodeExists(nodeId: string, dtRoot?: string): boolean {
  try {
    return fs.existsSync(getNodePath(nodeId, dtRoot));
  } catch {
    return false;
  }
}

/**
 * 读取一个节点（自动迁移旧格式）
 */
export function readNode(nodeId: string, dtRoot?: string): NodeFile {
  const filePath = getNodePath(nodeId, dtRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`节点 ${nodeId} 不存在`);
  }
  const { frontmatter, content } = readFrontmatterFile<NodeFrontmatter>(filePath);

  // 自动迁移旧格式
  let needsMigration = false;

  if (!frontmatter.title) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    frontmatter.title = titleMatch ? titleMatch[1] : frontmatter.id;
    needsMigration = true;
  }
  if (frontmatter.summary === undefined || frontmatter.summary === null) {
    frontmatter.summary = '';
    needsMigration = true;
  }
  if (!Array.isArray(frontmatter.edges)) {
    frontmatter.edges = [];
    needsMigration = true;
  }

  // 清除旧字段
  const fm = frontmatter as unknown as Record<string, unknown>;
  for (const key of ['decided_option', 'requires_human', 'depends_on_context', 'score']) {
    if (key in fm) {
      delete fm[key];
      needsMigration = true;
    }
  }

  if (needsMigration) {
    writeFrontmatterFile(filePath, frontmatter, content);
  }

  return { frontmatter, content };
}

/**
 * 创建新节点
 */
export function createNode(opts: {
  type: string;
  title: string;
  summary?: string;
  parent?: string | null;
  content?: string;
  dtRoot?: string;
}): string {
  const root = resolveDtRoot(opts.dtRoot);
  const paths = getDtPaths(root);
  const id = generateNextId(paths.nodes, '');

  const frontmatter: NodeFrontmatter = {
    id,
    title: opts.title,
    summary: opts.summary ?? '',
    type: opts.type,
    status: 'pending',
    parent: opts.parent ?? null,
    children: [],
    edges: [],
    created: new Date().toISOString(),
  };

  const defaultBody =
    `# ${opts.title}\n\n## 已知前提\n\n## 认知起点\n\n## 推导逻辑\n\n## 讨论共识\n`;
  const body = opts.content ? `# ${opts.title}\n\n${opts.content}` : defaultBody;

  const filePath = path.join(paths.nodes, idToFilename(id));
  writeFrontmatterFile(filePath, frontmatter, body);

  // 如果有父节点，更新父节点的 children
  if (opts.parent) {
    addChildToNode(opts.parent, id, root);
  }

  // 如果没有 root_node，设置为 root
  const config = readTreeConfig(root);
  if (!config.root_node) {
    updateTreeConfig(root, { root_node: id });
  }

  return id;
}

/**
 * 给节点添加子节点引用
 */
export function addChildToNode(parentId: string, childId: string, dtRoot?: string): void {
  const filePath = getNodePath(parentId, dtRoot);
  const { frontmatter, content } = readFrontmatterFile<NodeFrontmatter>(filePath);

  if (!frontmatter.children.includes(childId)) {
    frontmatter.children.push(childId);
  }

  writeFrontmatterFile(filePath, frontmatter, content);
}

/**
 * 更新节点状态
 */
export function updateNodeStatus(nodeId: string, status: NodeStatus, dtRoot?: string): void {
  updateFrontmatter<NodeFrontmatter>(getNodePath(nodeId, dtRoot), { status } as Partial<NodeFrontmatter>);
}

/**
 * 更新节点的结构化字段（title/summary/status/type）
 */
export function updateNodeFields(
  nodeId: string,
  updates: Partial<Pick<NodeFrontmatter, 'title' | 'summary' | 'status' | 'type'>>,
  dtRoot?: string,
): void {
  updateFrontmatter<NodeFrontmatter>(getNodePath(nodeId, dtRoot), updates as Partial<NodeFrontmatter>);
}

/**
 * 给节点添加边
 */
export function addEdge(nodeId: string, edge: Edge, dtRoot?: string): void {
  const filePath = getNodePath(nodeId, dtRoot);
  const { frontmatter, content } = readFrontmatterFile<NodeFrontmatter>(filePath);

  // 防止重复边
  const exists = (frontmatter.edges ?? []).some(
    (e) => e.target === edge.target && e.direction === edge.direction,
  );
  if (!exists) {
    if (!frontmatter.edges) frontmatter.edges = [];
    frontmatter.edges.push(edge);
    writeFrontmatterFile(filePath, frontmatter, content);
  }
}

/**
 * 更新节点正文内容（保留 frontmatter 不变）
 */
export function updateNodeContent(nodeId: string, newContent: string, dtRoot?: string): void {
  const filePath = getNodePath(nodeId, dtRoot);
  const { frontmatter } = readFrontmatterFile<NodeFrontmatter>(filePath);
  writeFrontmatterFile(filePath, frontmatter, newContent);
}

/**
 * 列出所有节点（自动迁移旧格式）
 */
export function listAllNodes(dtRoot?: string): NodeFile[] {
  const root = resolveDtRoot(dtRoot);
  const paths = getDtPaths(root);
  const nodesDir = paths.nodes;

  if (!fs.existsSync(nodesDir)) return [];

  const files = fs.readdirSync(nodesDir).filter((f: string) => f.endsWith('.md')).sort();
  return files.map((f: string) => {
    const nodeId = f.replace(/\.md$/, '');
    return readNode(nodeId, root);
  });
}
