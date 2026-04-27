/**
 * update.ts — 更新节点结构化字段 (v2)
 *
 * dt update <id> [--status X] [--title X] [--summary X] [--type X]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { nodeExists, updateNodeFields } from '../core/node.js';
import { requireDtRoot } from '../core/project.js';
import { gitAutoCommit, gitCommitIfChanged } from '../core/git.js';
import type { NodeStatus } from '../types/index.js';

const VALID_STATUSES: NodeStatus[] = [
  'pending',
  'in_progress',
  'decided',
  'completed',
  'rejected',
];

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('更新节点的结构化字段')
    .argument('<id>', '节点 ID')
    .option('--status <status>', '更新状态')
    .option('--title <title>', '更新标题')
    .option('--summary <summary>', '更新摘要')
    .option('--type <type>', '更新类型')
    .action(
      (
        id: string,
        opts: {
          status?: string;
          title?: string;
          summary?: string;
          type?: string;
        },
      ) => {
        const dtRoot = requireDtRoot();

        // 先提交人类编辑
        gitCommitIfChanged(dtRoot);

        if (!nodeExists(id)) {
          console.error(chalk.red(`✗ 节点 ${id} 不存在`));
          process.exit(1);
        }

        // 至少需要一个更新字段
        if (!opts.status && !opts.title && !opts.summary && !opts.type) {
          console.error(
            chalk.red(
              '✗ 请至少提供一个更新字段: --status, --title, --summary, --type',
            ),
          );
          process.exit(1);
        }

        // 验证 status
        if (opts.status && !VALID_STATUSES.includes(opts.status as NodeStatus)) {
          console.error(
            chalk.red(
              `✗ 无效状态: ${opts.status}，可选: ${VALID_STATUSES.join(', ')}`,
            ),
          );
          process.exit(1);
        }

        const updates: Record<string, string> = {};
        if (opts.status) updates.status = opts.status;
        if (opts.title) updates.title = opts.title;
        if (opts.summary) updates.summary = opts.summary;
        if (opts.type) updates.type = opts.type;

        updateNodeFields(id, updates);

        // 自动 git commit
        const fields = Object.keys(updates).join(', ');
        gitAutoCommit(dtRoot, `update ${id}: ${fields}`);

        console.log(
          chalk.green(
            `✓ 更新节点 ${chalk.bold(id)}: ${fields}`,
          ),
        );
      },
    );
}
