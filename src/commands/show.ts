/**
 * show.ts — dt show <id> (v2)
 *
 * 读取并格式化输出节点详情，包含 edges 信息
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { readNode, nodeExists } from '../core/node.js';
import type { NodeStatus } from '../types/index.js';

const STATUS_ICON: Record<NodeStatus, string> = {
  pending: '⏳',
  in_progress: '🔄',
  decided: '✅',
  completed: '✅',
  rejected: '❌',
};

export function registerShowCommand(program: Command): void {
  program
    .command('show')
    .description('查看节点详情')
    .argument('<id>', '节点 ID')
    .action((id: string) => {
      if (!nodeExists(id)) {
        console.error(chalk.red(`✗ 节点 ${id} 不存在`));
        process.exit(1);
      }

      const node = readNode(id);
      const fm = node.frontmatter;
      const icon = STATUS_ICON[fm.status] ?? '?';

      console.log('');
      console.log(
        `${icon} ${chalk.bold(`[${fm.id}]`)} ${chalk.cyan(fm.type)} — ${fm.status}`,
      );
      console.log(chalk.dim('─'.repeat(60)));

      if (fm.summary) {
        console.log(`  摘要: ${fm.summary}`);
      }
      if (fm.parent) {
        console.log(`  父节点: ${fm.parent}`);
      }
      if (fm.children.length > 0) {
        console.log(`  子节点: ${fm.children.join(', ')}`);
      }

      // 显示 edges
      const edges = fm.edges ?? [];
      if (edges.length > 0) {
        console.log(`  关联:`);
        for (const edge of edges) {
          const arrow =
            edge.direction === 'to'
              ? '→'
              : edge.direction === 'from'
                ? '←'
                : '↔';
          console.log(
            `    ${arrow} ${chalk.bold(edge.target)} (${edge.direction}): ${edge.summary}`,
          );
        }
      }

      console.log(`  创建时间: ${fm.created}`);
      console.log('');
      console.log(node.content);
      console.log('');
    });
}
