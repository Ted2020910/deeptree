/**
 * show.ts — dt show <id> (v3)
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { readNode, nodeExists } from '../core/node.js';
import { isCrossRef } from '../types/index.js';
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
      console.log(`${icon} ${chalk.bold(`[${fm.id}]`)} ${chalk.cyan(fm.type)} — ${fm.status}`);
      if (fm.root) console.log(chalk.yellow('  ★ 根节点'));
      console.log(chalk.dim('─'.repeat(60)));

      if (fm.summary) console.log(`  摘要: ${fm.summary}`);

      const fromEdges = (fm.edges ?? []).filter((e) => e.type === 'from');
      const toEdges = (fm.edges ?? []).filter((e) => e.type === 'to');

      if (fromEdges.length > 0) {
        const labels = fromEdges.map((e) => {
          const crossTag = isCrossRef(e.target) ? chalk.magenta(' [跨项目]') : '';
          return `${chalk.bold(e.target)}${crossTag}${e.summary ? ` — ${e.summary}` : ''}`;
        });
        console.log(`  父节点 (from): ${labels.join(', ')}`);
      }

      if (toEdges.length > 0) {
        console.log(`  子节点 (to):`);
        for (const e of toEdges) {
          const crossTag = isCrossRef(e.target) ? chalk.magenta(' [跨项目]') : '';
          const depthTag = e.depth !== undefined ? chalk.dim(` depth:${e.depth}`) : '';
          const summaryText = e.summary ? chalk.dim(` — ${e.summary}`) : '';
          console.log(`    → ${chalk.bold(e.target)}${crossTag}${depthTag}${summaryText}`);
        }
      }

      console.log(`  创建时间: ${fm.created}`);
      console.log('');
      console.log(node.content);
      console.log('');
    });
}
