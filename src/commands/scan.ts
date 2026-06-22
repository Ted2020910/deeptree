/**
 * scan.ts — discover distributed dt Markdown nodes.
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { requireDtRoot } from '../core/project.js';
import { gitAutoCommit, gitCommitIfChanged } from '../core/git.js';
import { syncNodeIndex } from '../core/node-index.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('全量扫描项目 Markdown，发现带 dt frontmatter 的分布式节点')
    .action(() => {
      const dtRoot = requireDtRoot();
      gitCommitIfChanged(dtRoot);

      const result = syncNodeIndex(dtRoot, { full: true });
      gitAutoCommit(dtRoot, 'scan distributed nodes');

      console.log('');
      console.log(chalk.bold('🔎 dt scan'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`  索引节点: ${Object.keys(result.index.nodes).length}`);
      console.log(`  新增: ${result.added.length}`);
      console.log(`  更新: ${result.updated.length}`);
      console.log(`  移除: ${result.removed.length}`);

      if (result.conflicts.length > 0) {
        console.log('');
        console.log(chalk.yellow(`  冲突: ${result.conflicts.length}`));
        for (const conflict of result.conflicts.slice(0, 10)) {
          console.log(chalk.yellow(`    ${conflict.id}: ${conflict.paths.join(' , ')}`));
        }
        if (result.conflicts.length > 10) {
          console.log(chalk.yellow(`    ... 及其他 ${result.conflicts.length - 10} 个冲突`));
        }
      }

      console.log('');
    });
}
