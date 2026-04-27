/**
 * link.ts — 添加跨分支关联边
 *
 * dt link <source> <target> <summary> [--direction from|to|related]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { nodeExists, addEdge } from '../core/node.js';
import { requireDtRoot } from '../core/project.js';
import { gitAutoCommit, gitCommitIfChanged } from '../core/git.js';
import type { Edge } from '../types/index.js';

export function registerLinkCommand(program: Command): void {
  program
    .command('link')
    .description('添加节点之间的关联边')
    .argument('<source>', '源节点 ID')
    .argument('<target>', '目标节点 ID')
    .argument('<summary>', '边的逻辑摘要')
    .option(
      '--direction <dir>',
      '关系方向: from, to, related（默认 related）',
      'related',
    )
    .action(
      (
        source: string,
        target: string,
        summary: string,
        opts: { direction: string },
      ) => {
        const dtRoot = requireDtRoot();

        // 先提交人类编辑
        gitCommitIfChanged(dtRoot);

        // 验证节点存在
        if (!nodeExists(source)) {
          console.error(chalk.red(`✗ 节点 ${source} 不存在`));
          process.exit(1);
        }
        if (!nodeExists(target)) {
          console.error(chalk.red(`✗ 节点 ${target} 不存在`));
          process.exit(1);
        }

        const direction = opts.direction as Edge['direction'];
        if (!['from', 'to', 'related'].includes(direction)) {
          console.error(
            chalk.red(`✗ 无效方向: ${direction}，可选: from, to, related`),
          );
          process.exit(1);
        }

        // 在源节点添加边
        addEdge(source, { target, direction, summary });

        // 在目标节点添加镜像边
        const mirrorDirection: Edge['direction'] =
          direction === 'to'
            ? 'from'
            : direction === 'from'
              ? 'to'
              : 'related';
        addEdge(target, {
          target: source,
          direction: mirrorDirection,
          summary,
        });

        // 自动 git commit
        gitAutoCommit(dtRoot, `link ${source} → ${target}: ${summary}`);

        console.log(
          chalk.green(
            `✓ 关联 ${chalk.bold(source)} ↔ ${chalk.bold(target)} (${direction}): ${summary}`,
          ),
        );
      },
    );
}
