/**
 * render.ts — 终端树形渲染工具
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
}

/**
 * 从扁平的节点列表构建树结构
 */
export function buildTree(nodes: NodeFile[], rootId: string): TreeRenderNode | null {
  const nodeMap = new Map<string, NodeFile>();
  for (const n of nodes) {
    nodeMap.set(n.frontmatter.id, n);
  }

  function build(id: string): TreeRenderNode | null {
    const node = nodeMap.get(id);
    if (!node) return null;

    const fm = node.frontmatter;
    // 优先从 frontmatter.title 读取，fallback 到 content 解析
    const label = fm.title || (() => {
      const titleMatch = node.content.match(/^#\s+(.+)$/m);
      return titleMatch ? titleMatch[1] : fm.id;
    })();

    return {
      id: fm.id,
      label,
      type: fm.type,
      status: fm.status,
      children: fm.children
        .map((childId) => build(childId))
        .filter((c): c is TreeRenderNode => c !== null),
    };
  }

  return build(rootId);
}

/**
 * 渲染 ASCII 树
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

  if (isRoot) {
    lines.push(`${icon} ${chalk.bold(node.id)} ${typeTag} ${node.label}`);
  } else {
    const connector = isLast ? '└── ' : '├── ';
    lines.push(
      `${prefix}${connector}${icon} ${chalk.bold(node.id)} ${typeTag} ${node.label}`,
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
