/**
 * status.ts — dt status (v2)
 *
 * 显示项目概览和节点统计 + 自动检查用户变更
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { requireDtRoot, readTreeConfig } from '../core/project.js';
import { listAllNodes } from '../core/node.js';
import { gitCommitIfChanged } from '../core/git.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('查看项目状态概览')
    .action(() => {
      const dtRoot = requireDtRoot();

      // 自动检测并提交人类编辑
      const humanChanges = gitCommitIfChanged(dtRoot);
      if (humanChanges) {
        console.log('');
        console.log(
          chalk.yellow(
            `⚡ 已自动保存 ${humanChanges.length} 处用户编辑`,
          ),
        );
      }

      const config = readTreeConfig(dtRoot);
      const nodes = listAllNodes();

      // 统计节点状态
      const statusCounts: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};

      for (const node of nodes) {
        const s = node.frontmatter.status;
        statusCounts[s] = (statusCounts[s] ?? 0) + 1;

        const t = node.frontmatter.type;
        typeCounts[t] = (typeCounts[t] ?? 0) + 1;
      }

      console.log('');
      console.log(chalk.bold(`📋 项目: ${config.project}`));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`  根节点: ${config.root_node ?? '(未设置)'}`);
      console.log(`  创建时间: ${config.created}`);
      console.log('');

      // 节点统计
      console.log(chalk.bold(`📊 节点统计 (共 ${nodes.length} 个)`));
      console.log(chalk.dim('─'.repeat(50)));

      if (nodes.length > 0) {
        console.log('  按状态:');
        for (const [status, count] of Object.entries(statusCounts)) {
          const icon =
            status === 'completed' || status === 'decided'
              ? '✅'
              : status === 'rejected'
                ? '❌'
                : status === 'in_progress'
                  ? '🔄'
                  : '⏳';
          console.log(`    ${icon} ${status}: ${count}`);
        }

        console.log('  按类型:');
        for (const [type, count] of Object.entries(typeCounts)) {
          console.log(`    ${type}: ${count}`);
        }
      } else {
        console.log(chalk.dim('  (暂无节点)'));
      }
      console.log('');
    });
}
