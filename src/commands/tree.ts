/**
 * tree.ts — dt tree (v2)
 *
 * 展示决策树 + 自动检查用户变更
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { requireDtRoot, readTreeConfig } from '../core/project.js';
import { listAllNodes } from '../core/node.js';
import { buildTree, renderTree } from '../utils/render.js';
import { gitCommitIfChanged } from '../core/git.js';

export function registerTreeCommand(program: Command): void {
  program
    .command('tree')
    .description('展示决策树')
    .action(() => {
      const dtRoot = requireDtRoot();

      // 自动检测并提交人类编辑
      const humanChanges = gitCommitIfChanged(dtRoot);
      if (humanChanges) {
        console.log('');
        console.log(
          chalk.yellow(
            `⚡ 已自动保存 ${humanChanges.length} 处用户编辑:`,
          ),
        );
        for (const f of humanChanges.slice(0, 5)) {
          console.log(chalk.yellow(`   - ${f}`));
        }
        if (humanChanges.length > 5) {
          console.log(chalk.yellow(`   ... 及其他 ${humanChanges.length - 5} 个文件`));
        }
      }

      const config = readTreeConfig(dtRoot);
      const nodes = listAllNodes();

      if (!config.root_node) {
        console.log(chalk.dim('(暂无根节点。运行 `dt add goal "目标"` 创建)'));
        return;
      }

      if (nodes.length === 0) {
        console.log(chalk.dim('(暂无节点)'));
        return;
      }

      const tree = buildTree(nodes, config.root_node);
      if (!tree) {
        console.error(chalk.red(`✗ 根节点 ${config.root_node} 不存在`));
        process.exit(1);
      }

      console.log('');
      console.log(chalk.bold(`🌳 ${config.project}`));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(renderTree(tree));
      console.log('');
    });
}
