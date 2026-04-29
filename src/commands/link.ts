/**
 * link.ts — 添加节点之间的边 (v3)
 *
 * dt link <source> <target> "摘要" [--direction from|to] [--depth n]
 * 双向自动补全反向边，支持跨项目引用。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { nodeExistsByRef, addEdgeBidirectional } from '../core/node.js';
import { requireDtRoot } from '../core/project.js';
import { gitAutoCommit, gitCommitIfChanged } from '../core/git.js';
import type { Edge } from '../types/index.js';

export function registerLinkCommand(program: Command): void {
  program
    .command('link')
    .description('添加节点之间的关联边（双向自动补全）')
    .argument('<source>', '源节点 ID')
    .argument('<target>', '目标节点 ID（支持跨项目 projectId::nodeId）')
    .argument('<summary>', '边的逻辑摘要')
    .option(
      '--direction <dir>',
      '关系方向: from（target 是 source 的父）, to（target 是 source 的子）。默认 to',
      'to',
    )
    .option('--depth <n>', '跨项目引用时拉取的节点深度', parseInt)
    .action(
      (
        source: string,
        target: string,
        summary: string,
        opts: { direction: string; depth?: number },
      ) => {
        const dtRoot = requireDtRoot();
        gitCommitIfChanged(dtRoot);

        if (!nodeExistsByRef(source)) {
          console.error(chalk.red(`✗ 节点 ${source} 不存在`));
          process.exit(1);
        }
        if (!nodeExistsByRef(target)) {
          console.error(chalk.red(`✗ 节点 ${target} 不存在`));
          process.exit(1);
        }

        const direction = opts.direction as Edge['type'];
        if (!['from', 'to'].includes(direction)) {
          console.error(chalk.red(`✗ 无效方向: ${direction}，可选: from, to`));
          process.exit(1);
        }

        const edge: Edge = {
          target,
          type: direction,
          summary,
          ...(opts.depth !== undefined ? { depth: opts.depth } : {}),
        };

        addEdgeBidirectional(source, edge, dtRoot);
        gitAutoCommit(dtRoot, `link ${source} → ${target}: ${summary}`);

        const arrow = direction === 'to' ? '→' : '←';
        console.log(chalk.green(`✓ 关联 ${chalk.bold(source)} ${arrow} ${chalk.bold(target)}: ${summary}`));
      },
    );
}
