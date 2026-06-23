/**
 * init.ts — dt init
 *
 * Initializes project-local DT metadata only. Reusable DT instructions and
 * style templates live in the project dt skill.
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import {
  createDtStructure,
  findDtRoot,
  writeTreeConfig,
} from '../core/project.js';
import { setupClaudeHook, updateProjectEntryFiles, updateProjectSkillFiles } from '../core/hooks.js';
import { gitAutoCommit } from '../core/git.js';
import { registerProject, pathToId } from '../core/registry.js';
import { syncNodeIndex } from '../core/node-index.js';
import type { TreeConfig } from '../types/index.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('初始化决策树项目')
    .argument('<name>', '项目名称')
    .action((name: string) => {
      const existing = findDtRoot();
      if (existing) {
        console.error(chalk.red(`✗ .dt/ 目录已存在: ${existing}`));
        process.exit(1);
      }

      const dtRoot = createDtStructure(process.cwd());

      const config: TreeConfig = {
        project: name,
        created: new Date().toISOString(),
      };
      writeTreeConfig(dtRoot, config);
      syncNodeIndex(dtRoot);

      try {
        setupClaudeHook(process.cwd());
        console.log(chalk.green('✓ Claude Code Hook 已配置'));
      } catch {
        console.log(chalk.dim('  (跳过 Hook 配置)'));
      }
      try {
        updateProjectSkillFiles(process.cwd());
        updateProjectEntryFiles(process.cwd());
        console.log(chalk.green('✓ CLAUDE.md / AGENTS.md / dt skills 已更新'));
      } catch {
        console.log(chalk.dim('  (跳过项目入口文件 / skill 更新)'));
      }

      gitAutoCommit(dtRoot, `init: ${name}`);

      try {
        const id = pathToId(process.cwd());
        registerProject({ id, name, path: process.cwd() });
        console.log(chalk.green(`✓ 已注册到全局项目列表 [${id}]`));
      } catch {
        console.log(chalk.dim('  (跳过项目注册)'));
      }

      console.log(chalk.green('✓ 决策树项目已初始化'));
      console.log('');
      console.log(`  项目: ${chalk.bold(name)}`);
      console.log(chalk.dim('  可复用工作流与写作风格来自项目级 dt skill。'));
      console.log('');
    });
}
