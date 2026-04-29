/**
 * update.ts — 更新节点结构化字段 (v3)
 *
 * dt update <id> [--status X] [--title X] [--summary X] [--type X] [--root true|false]
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
    .option('--root <bool>', '设置是否为根节点 (true|false)')
    .action(
      (
        id: string,
        opts: {
          status?: string;
          title?: string;
          summary?: string;
          type?: string;
          root?: string;
        },
      ) => {
        const dtRoot = requireDtRoot();
        gitCommitIfChanged(dtRoot);

        if (!nodeExists(id)) {
          console.error(chalk.red(`✗ 节点 ${id} 不存在`));
          process.exit(1);
        }

        if (!opts.status && !opts.title && !opts.summary && !opts.type && opts.root === undefined) {
          console.error(chalk.red('✗ 请至少提供一个更新字段: --status, --title, --summary, --type, --root'));
          process.exit(1);
        }

        if (opts.status && !VALID_STATUSES.includes(opts.status as NodeStatus)) {
          console.error(chalk.red(`✗ 无效状态: ${opts.status}，可选: ${VALID_STATUSES.join(', ')}`));
          process.exit(1);
        }

        if (opts.root !== undefined && !['true', 'false'].includes(opts.root)) {
          console.error(chalk.red('✗ --root 只接受 true 或 false'));
          process.exit(1);
        }

        const updates: Parameters<typeof updateNodeFields>[1] = {};
        if (opts.status) updates.status = opts.status as NodeStatus;
        if (opts.title) updates.title = opts.title;
        if (opts.summary) updates.summary = opts.summary;
        if (opts.type) updates.type = opts.type;
        if (opts.root !== undefined) updates.root = opts.root === 'true';

        updateNodeFields(id, updates, dtRoot);

        const fields = Object.keys(updates).join(', ');
        gitAutoCommit(dtRoot, `update ${id}: ${fields}`);
        console.log(chalk.green(`✓ 更新节点 ${chalk.bold(id)}: ${fields}`));
      },
    );
}
