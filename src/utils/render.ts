/**
 * render.ts — 终端树形渲染工具 (v3)
 *
 * 变更：
 * - buildTree 从 root:true 节点出发，通过 to 边递归找子节点
 * - 支持多根节点（返回数组）
 * - 多父节点在每个父下都显示，加 [+] 标记避免混淆
 * - 防止循环引用（visited set）
 */

import chalk from 'chalk';
import type { NodeFile, NodeStatus } from '../types/index.js';

const STATUS_ICON: Record<NodeStatus, string> = {
  pending: '⏳',
  in_progress: '🔄',
  decided: '✅',
  completed: '✅',
  rejected: '❌',
};

export interface TreeRenderNode {
  id: string;
  label: string;
  type: string;
  status: NodeStatus;
  children: TreeRenderNode[];
  /** 该节点有多个父节点（在多处显示） */
  multiParent: boolean;
}

/**
 * 从扁平节点列表构建多棵树（每个 root:true 节点一棵）
 */
export function buildForest(nodes: NodeFile[]): TreeRenderNode[] {
  const nodeMap = new Map<string, NodeFile>();
  for (const n of nodes) {
    nodeMap.set(n.frontmatter.id, n);
  }

  // 统计每个节点有多少个 from 边（即有多少父节点）
  const parentCount = new Map<string, number>();
  for (const n of nodes) {
    for (const edge of n.frontmatter.edges ?? []) {
      if (edge.type === 'to') {
        // n → edge.target，即 edge.target 有一个父节点 n
        const target = edge.target;
        if (!target.includes('::')) { // 只统计本项目节点
          parentCount.set(target, (parentCount.get(target) ?? 0) + 1);
        }
      }
    }
  }

  function build(id: string, visited: Set<string>): TreeRenderNode | null {
    const node = nodeMap.get(id);
    if (!node) return null;

    const fm = node.frontmatter;
    const label = fm.title || (() => {
      const titleMatch = node.content.match(/^#\s+(.+)$/m);
      return titleMatch ? titleMatch[1] : fm.id;
    })();

    // 防止循环引用
    if (visited.has(id)) {
      return {
        id: fm.id,
        label: `${label} [循环引用]`,
        type: fm.type,
        status: fm.status,
        children: [],
        multiParent: false,
      };
    }

    const nextVisited = new Set(visited).add(id);

    // 从 to 边找子节点（只处理本项目节点）
    const childIds = (fm.edges ?? [])
      .filter((e) => e.type === 'to' && !e.target.includes('::'))
      .map((e) => e.target);

    return {
      id: fm.id,
      label,
      type: fm.type,
      status: fm.status,
      multiParent: (parentCount.get(id) ?? 0) > 1,
      children: childIds
        .map((childId) => build(childId, nextVisited))
        .filter((c): c is TreeRenderNode => c !== null),
    };
  }

  // 找所有根节点
  const roots = nodes.filter((n) => n.frontmatter.root === true);
  return roots.map((r) => build(r.frontmatter.id, new Set())).filter(
    (t): t is TreeRenderNode => t !== null,
  );
}

/**
 * 向后兼容：buildTree 返回单棵树（取第一棵）
 */
export function buildTree(nodes: NodeFile[], rootId: string): TreeRenderNode | null {
  const nodeMap = new Map<string, NodeFile>();
  for (const n of nodes) nodeMap.set(n.frontmatter.id, n);

  const forest = buildForest(nodes);
  // 优先返回指定 rootId 的树，否则返回第一棵
  return forest.find((t) => t.id === rootId) ?? forest[0] ?? null;
}

/**
 * 渲染单棵 ASCII 树
 */
export function renderTree(
  node: TreeRenderNode,
  prefix: string = '',
  isLast: boolean = true,
  isRoot: boolean = true,
): string {
  const lines: string[] = [];
  const icon = STATUS_ICON[node.status] ?? '?';
  const typeTag = chalk.cyan(`[${node.type}]`);
  const multiTag = node.multiParent ? chalk.yellow(' [+]') : '';

  if (isRoot) {
    lines.push(`${icon} ${chalk.bold(node.id)} ${typeTag} ${node.label}${multiTag}`);
  } else {
    const connector = isLast ? '└── ' : '├── ';
    lines.push(
      `${prefix}${connector}${icon} ${chalk.bold(node.id)} ${typeTag} ${node.label}${multiTag}`,
    );
  }

  const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const last = i === node.children.length - 1;
    lines.push(renderTree(child, childPrefix, last, false));
  }

  return lines.join('\n');
}

/**
 * 渲染整个 forest（多棵树）
 */
export function renderForest(trees: TreeRenderNode[]): string {
  if (trees.length === 0) return '';
  return trees.map((t) => renderTree(t)).join('\n\n');
}
