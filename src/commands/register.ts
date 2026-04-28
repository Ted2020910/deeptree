/**
 * register.ts — dt register / dt unregister / dt projects 命令
 */

import type { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import { registerProject, unregisterProject, listProjects, pathToId } from '../core/registry.js';
import { findDtRoot, readTreeConfig } from '../core/project.js';

export function registerProjectCommands(program: Command): void {

  // dt register [path]
  program
    .command('register [dir]')
    .description('注册一个 dt 项目到全局列表（默认当前目录）')
    .action((dir?: string) => {
      const targetDir = dir ? path.resolve(dir) : process.cwd();
      const dtRoot = findDtRoot(targetDir);
      if (!dtRoot) {
        console.error(chalk.red(`错误: 在 ${targetDir} 未找到 .dt/ 目录。`));
        console.error(chalk.dim('  请先运行 `dt init "项目名"` 初始化项目。'));
        process.exit(1);
      }
      const config = readTreeConfig(dtRoot);
      const id = pathToId(targetDir);
      registerProject({ id, name: config.project, path: targetDir });
      console.log(chalk.green(`✓ 已注册项目: ${chalk.bold(config.project)} [${id}]`));
      console.log(chalk.dim(`  路径: ${targetDir}`));
    });

  // dt unregister <id>
  program
    .command('unregister <id>')
    .description('从全局列表移除一个 dt 项目')
    .action((id: string) => {
      const removed = unregisterProject(id);
      if (removed) {
        console.log(chalk.green(`✓ 已移除项目: ${id}`));
      } else {
        console.error(chalk.red(`错误: 未找到项目 ${id}`));
        process.exit(1);
      }
    });

  // dt projects
  program
    .command('projects')
    .description('列出所有注册的 dt 项目')
    .action(() => {
      const projects = listProjects();
      if (projects.length === 0) {
        console.log(chalk.dim('  暂无注册项目。运行 `dt register` 添加项目。'));
        return;
      }
      console.log('');
      for (const p of projects) {
        const status = p.reachable
          ? chalk.green('●')
          : chalk.red('✕');
        const nameStr = chalk.bold(p.name);
        const idStr = chalk.dim(`[${p.id}]`);
        const pathStr = chalk.dim(p.path);
        const reach = p.reachable ? '' : chalk.red(' (路径不存在)');
        console.log(`  ${status} ${nameStr} ${idStr}${reach}`);
        console.log(`    ${pathStr}`);
      }
      console.log('');
    });
}
