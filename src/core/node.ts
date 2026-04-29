/**
 * node.ts — 节点 CRUD 操作 (v3)
 *
 * 核心变更：
 * - 去掉 parent/children 字段，统一用 edges（type: from|to）
 * - addEdge 自动补全反向边（双向存储，系统保证一致性）
 * - readNode 惰性迁移旧格式（parent/children → edges，related → to）
 * - 跨项目引用（projectId::nodeId）：硬引用，不可达报错
 * - root 字段替代 tree.yaml 的 root_node
 */

import fs from 'node:fs';
import path from 'node:path';
import { readFrontmatterFile, writeFrontmatterFile } from './frontmatter.js';
import { requireDtRoot, getDtPaths } from './project.js';
import { findProjectById } from './registry.js';
import { generateNextId, idToFilename } from '../utils/id.js';
import { parseCrossRef, isCrossRef } from '../types/index.js';
import type { NodeFrontmatter, NodeFile, NodeStatus, Edge } from '../types/index.js';

// ─── 路径解析 ────────────────────────────────────────────────

function resolveDtRoot(dtRoot?: string): string {
  return dtRoot ?? requireDtRoot();
}

export function getNodePath(nodeId: string, dtRoot?: string): string {
  const root = resolveDtRoot(dtRoot);
  const paths = getDtPaths(root);
  return path.join(paths.nodes, idToFilename(nodeId));
}

export function nodeExists(nodeId: string, dtRoot?: string): boolean {
  try {
    return fs.existsSync(getNodePath(nodeId, dtRoot));
  } catch {
    return false;
  }
}

// ─── 跨项目引用解析 ──────────────────────────────────────────

/**
 * 解析跨项目引用，返回目标项目的 dtRoot 路径。
 * 项目未注册或路径不可达时抛出明确错误。
 */
function resolveCrossRefRoot(projectId: string): string {
  const entry = findProjectById(projectId);
  if (!entry) {
    throw new Error(
      `项目 "${projectId}" 未注册\n  请先运行: dt register <path>  将该项目加入注册表`,
    );
  }
  const dtRoot = path.join(entry.path, '.dt');
  if (!fs.existsSync(dtRoot)) {
    throw new Error(
      `项目 "${projectId}" 路径不可达: ${entry.path}\n  请检查路径是否存在，或重新运行: dt register <path>`,
    );
  }
  return dtRoot;
}

/**
 * 读取节点，支持跨项目引用（target 格式：'projectId::nodeId'）
 */
export function readNodeByRef(target: string, localDtRoot?: string): NodeFile {
  if (isCrossRef(target)) {
    const ref = parseCrossRef(target)!;
    const remoteDtRoot = resolveCrossRefRoot(ref.projectId);
    return readNode(ref.nodeId, remoteDtRoot);
  }
  return readNode(target, localDtRoot);
}

/**
 * 检查节点是否存在，支持跨项目引用
 */
export function nodeExistsByRef(target: string, localDtRoot?: string): boolean {
  if (isCrossRef(target)) {
    try {
      const ref = parseCrossRef(target)!;
      const remoteDtRoot = resolveCrossRefRoot(ref.projectId);
      return nodeExists(ref.nodeId, remoteDtRoot);
    } catch {
      return false;
    }
  }
  return nodeExists(target, localDtRoot);
}

// ─── 读取节点（含惰性迁移） ───────────────────────────────────

/**
 * 读取一个节点，自动迁移旧格式：
 *   - parent/children → edges (from/to)
 *   - edges[].direction → edges[].type
 *   - related 边 → to 边
 *   - 补全 root 字段
 */
export function readNode(nodeId: string, dtRoot?: string): NodeFile {
  const filePath = getNodePath(nodeId, dtRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`节点 ${nodeId} 不存在`);
  }

  const { frontmatter, content } = readFrontmatterFile<
    NodeFrontmatter & {
      // 旧字段（迁移用）
      parent?: string | null;
      children?: string[];
      decided_option?: unknown;
      requires_human?: unknown;
      depends_on_context?: unknown;
      score?: unknown;
    }
  >(filePath);

  let needsMigration = false;

  // title 迁移
  if (!frontmatter.title) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    frontmatter.title = titleMatch ? titleMatch[1] : frontmatter.id;
    needsMigration = true;
  }

  // summary 迁移
  if (frontmatter.summary === undefined || frontmatter.summary === null) {
    frontmatter.summary = '';
    needsMigration = true;
  }

  // edges 初始化
  if (!Array.isArray(frontmatter.edges)) {
    frontmatter.edges = [];
    needsMigration = true;
  }

  // root 字段初始化
  if (frontmatter.root === undefined || frontmatter.root === null) {
    frontmatter.root = false;
    needsMigration = true;
  }

  // 迁移旧 edges[].direction → edges[].type
  // related 边语义不明确，迁移时删除，由用户重新用 dt link 明确方向
  const migratedEdges: Edge[] = [];
  for (const edge of frontmatter.edges) {
    const e = edge as Edge & { direction?: string };
    if (e.direction !== undefined) {
      if (e.direction === 'from' || e.direction === 'to') {
        edge.type = e.direction;
        delete e.direction;
        migratedEdges.push(edge);
      }
      // related 边：丢弃（语义不明确，需用户重新 dt link）
      needsMigration = true;
    } else {
      migratedEdges.push(edge);
    }
  }
  frontmatter.edges = migratedEdges;

  // 迁移旧 parent → from 边
  const fm = frontmatter as typeof frontmatter & { parent?: string | null; children?: string[] };
  if (fm.parent) {
    const alreadyHas = frontmatter.edges.some(
      (e) => e.target === fm.parent && e.type === 'from',
    );
    if (!alreadyHas) {
      frontmatter.edges.push({ target: fm.parent, type: 'from', summary: '' });
    }
    delete fm.parent;
    needsMigration = true;
  }

  // 迁移旧 children → to 边
  if (Array.isArray(fm.children) && fm.children.length > 0) {
    for (const childId of fm.children) {
      const alreadyHas = frontmatter.edges.some(
        (e) => e.target === childId && e.type === 'to',
      );
      if (!alreadyHas) {
        frontmatter.edges.push({ target: childId, type: 'to', summary: '' });
      }
    }
    delete fm.children;
    needsMigration = true;
  }

  // 清除其他旧字段
  const fmAny = fm as unknown as Record<string, unknown>;
  for (const key of ['decided_option', 'requires_human', 'depends_on_context', 'score']) {
    if (key in fmAny) {
      delete fmAny[key];
      needsMigration = true;
    }
  }

  if (needsMigration) {
    writeFrontmatterFile(filePath, frontmatter, content);
  }

  return { frontmatter, content };
}

// ─── 创建节点 ────────────────────────────────────────────────

export function createNode(opts: {
  type: string;
  title: string;
  summary?: string;
  /** 父节点 ID 列表（支持跨项目 'projectId::nodeId'） */
  froms?: string[];
  /** from 边的摘要（与 froms 一一对应，不足时用空字符串） */
  fromSummaries?: string[];
  /** 跨项目 from 边的拉取深度 */
  fromDepths?: number[];
  /** 是否为根节点 */
  root?: boolean;
  content?: string;
  dtRoot?: string;
}): string {
  const dtRoot = resolveDtRoot(opts.dtRoot);
  const paths = getDtPaths(dtRoot);
  const id = generateNextId(paths.nodes, '');

  const frontmatter: NodeFrontmatter = {
    id,
    root: opts.root ?? false,
    title: opts.title,
    summary: opts.summary ?? '',
    type: opts.type,
    status: 'pending',
    edges: [],
    created: new Date().toISOString(),
  };

  const defaultBody =
    `# ${opts.title}\n\n## 已知前提\n\n## 认知起点\n\n## 推导逻辑\n\n## 讨论共识\n`;
  const body = opts.content ? `# ${opts.title}\n\n${opts.content}` : defaultBody;

  const filePath = path.join(paths.nodes, idToFilename(id));
  writeFrontmatterFile(filePath, frontmatter, body);

  // 绑定 from 边（双向：新节点写 from，父节点自动补 to）
  const froms = opts.froms ?? [];
  for (let i = 0; i < froms.length; i++) {
    const fromTarget = froms[i];
    const summary = opts.fromSummaries?.[i] ?? '';
    const depth = opts.fromDepths?.[i];
    addEdgeBidirectional(
      id,
      { target: fromTarget, type: 'from', summary, ...(depth !== undefined ? { depth } : {}) },
      dtRoot,
    );
  }

  return id;
}

// ─── 边操作 ──────────────────────────────────────────────────

/**
 * 单向写入一条边（内部使用，不自动补反向边）
 */
function addEdgeSingle(nodeId: string, edge: Edge, dtRoot?: string): void {
  const filePath = getNodePath(nodeId, dtRoot);
  const { frontmatter, content } = readFrontmatterFile<NodeFrontmatter>(filePath);

  const exists = (frontmatter.edges ?? []).some(
    (e) => e.target === edge.target && e.type === edge.type,
  );
  if (!exists) {
    if (!frontmatter.edges) frontmatter.edges = [];
    frontmatter.edges.push(edge);
    writeFrontmatterFile(filePath, frontmatter, content);
  }
}

/**
 * 双向写入边（对外暴露的主要接口）：
 *   - 在 nodeId 写入 edge
 *   - 自动在 edge.target 写入反向边
 *
 * 跨项目节点（target 含 '::'）：
 *   - 本项目节点写 from/to 边（含跨项目 target）
 *   - 远端项目节点也自动补反向边（需可达）
 */
export function addEdgeBidirectional(
  nodeId: string,
  edge: Edge,
  dtRoot?: string,
): void {
  const localRoot = resolveDtRoot(dtRoot);

  if (isCrossRef(edge.target)) {
    // 跨项目：解析远端 dtRoot（不可达则抛出错误）
    const ref = parseCrossRef(edge.target)!;
    const remoteDtRoot = resolveCrossRefRoot(ref.projectId);

    // 本项目节点写边
    addEdgeSingle(nodeId, edge, localRoot);

    // 远端节点补反向边（target 用 "当前项目::nodeId" 格式需要知道当前项目 id）
    // 当前项目 id 从注册表反向查找
    const localProjectId = resolveLocalProjectId(localRoot);
    const reverseTarget = localProjectId ? `${localProjectId}::${nodeId}` : nodeId;
    const reverseEdge: Edge = {
      target: reverseTarget,
      type: edge.type === 'from' ? 'to' : 'from',
      summary: edge.summary,
      ...(edge.depth !== undefined ? { depth: edge.depth } : {}),
    };
    addEdgeSingle(ref.nodeId, reverseEdge, remoteDtRoot);
  } else {
    // 同项目：直接双向写
    addEdgeSingle(nodeId, edge, localRoot);
    const reverseEdge: Edge = {
      target: nodeId,
      type: edge.type === 'from' ? 'to' : 'from',
      summary: edge.summary,
    };
    addEdgeSingle(edge.target, reverseEdge, localRoot);
  }
}

/** 从注册表反向查找当前项目的 id */
function resolveLocalProjectId(dtRoot: string): string | null {
  try {
    const { readRegistry } = require('./registry.js') as typeof import('./registry.js');
    const projectPath = path.dirname(dtRoot); // dtRoot = /path/to/project/.dt
    const registry = readRegistry();
    const entry = registry.projects.find(
      (p) => path.resolve(p.path) === path.resolve(projectPath),
    );
    return entry?.id ?? null;
  } catch {
    return null;
  }
}

// ─── 更新操作 ────────────────────────────────────────────────

export function updateNodeStatus(nodeId: string, status: NodeStatus, dtRoot?: string): void {
  const filePath = getNodePath(nodeId, dtRoot);
  const { frontmatter, content } = readFrontmatterFile<NodeFrontmatter>(filePath);
  frontmatter.status = status;
  writeFrontmatterFile(filePath, frontmatter, content);
}

export function updateNodeFields(
  nodeId: string,
  updates: Partial<Pick<NodeFrontmatter, 'title' | 'summary' | 'status' | 'type' | 'root'>>,
  dtRoot?: string,
): void {
  const filePath = getNodePath(nodeId, dtRoot);
  const { frontmatter, content } = readFrontmatterFile<NodeFrontmatter>(filePath);
  Object.assign(frontmatter, updates);
  writeFrontmatterFile(filePath, frontmatter, content);
}

export function updateNodeContent(nodeId: string, newContent: string, dtRoot?: string): void {
  const filePath = getNodePath(nodeId, dtRoot);
  const { frontmatter } = readFrontmatterFile<NodeFrontmatter>(filePath);
  writeFrontmatterFile(filePath, frontmatter, newContent);
}

// ─── 列表查询 ────────────────────────────────────────────────

export function listAllNodes(dtRoot?: string): NodeFile[] {
  const root = resolveDtRoot(dtRoot);
  const paths = getDtPaths(root);
  const nodesDir = paths.nodes;

  if (!fs.existsSync(nodesDir)) return [];

  const files = fs
    .readdirSync(nodesDir)
    .filter((f: string) => f.endsWith('.md'))
    .sort();

  return files.map((f: string) => {
    const nodeId = f.replace(/\.md$/, '');
    return readNode(nodeId, root);
  });
}
