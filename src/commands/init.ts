/**
 * init.ts — dt init (v2)
 *
 * dt init "<project-name>"
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import {
  createDtStructure,
  findDtRoot,
  writeTreeConfig,
} from '../core/project.js';
import { setupClaudeHook, appendClaudeMd } from '../core/hooks.js';
import { gitAutoCommit } from '../core/git.js';
import type { TreeConfig } from '../types/index.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('初始化决策树项目')
    .argument('<name>', '项目名称')
    .action((name: string) => {
      // 检查是否已初始化
      const existing = findDtRoot();
      if (existing) {
        console.error(chalk.red(`✗ .dt/ 目录已存在: ${existing}`));
        process.exit(1);
      }

      // 创建目录结构
      const dtRoot = createDtStructure(process.cwd());

      // 创建 tree.yaml
      const config: TreeConfig = {
        project: name,
        created: new Date().toISOString(),
        root_node: null,
      };

      writeTreeConfig(dtRoot, config);

      // 设置 Claude Code Hook 和 CLAUDE.md
      try {
        setupClaudeHook(process.cwd());
        console.log(chalk.green('✓ Claude Code Hook 已配置'));
      } catch {
        console.log(
          chalk.dim('  (跳过 Hook 配置)'),
        );
      }

      try {
        appendClaudeMd(process.cwd());
        console.log(chalk.green('✓ CLAUDE.md 已更新'));
      } catch {
        console.log(chalk.dim('  (跳过 CLAUDE.md 更新)'));
      }

      // 自动 git commit
      gitAutoCommit(dtRoot, `init: ${name}`);

      // 输出成功信息
      console.log(chalk.green('✓ 决策树项目已初始化'));
      console.log('');
      console.log(`  项目: ${chalk.bold(name)}`);
      console.log('');
      console.log(
        chalk.dim(
          '接下来可以运行 `dt add goal "你的目标"` 创建根目标节点',
        ),
      );
    });
}
