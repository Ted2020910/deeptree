/**
 * remote.ts — dt remote 子命令
 *
 * 用户可见的远程同步管理命令：
 *   dt remote set <github-url>       初始化云端配置
 *   dt remote status                 查看同步状态
 *   dt remote list                   列出云端所有项目
 *   dt remote clone <id> [path]      从云端下载项目到本机
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import {
  getRemoteConfig,
  initRemoteClone,
  getRemoteClonePath,
  listCloudProjects,
  cloneProjectFromRemote,
  remotePullCurrent,
} from '../core/remote.js';
import { registerProject, readRegistry, pathToId } from '../core/registry.js';
import { findDtRoot, readTreeConfig } from '../core/project.js';

export function registerRemoteCommands(program: Command): void {
  const remote = program
    .command('remote')
    .description('管理 GitHub 远程同步');

  // ─── dt remote set <github-url> ───────────────────────────
  remote
    .command('set <github-url>')
    .description('配置并初始化 GitHub 远程同步仓库')
    .action((githubUrl: string) => {
      console.log('');
      console.log(chalk.cyan('🔗 正在初始化远程同步...'));
      console.log(chalk.dim(`   远端: ${githubUrl}`));

      try {
        initRemoteClone(githubUrl);
        console.log(chalk.green('✓ 远程同步配置完成'));
        console.log(chalk.dim(`  本地 clone: ${getRemoteClonePath()}`));
        console.log('');
        console.log(chalk.dim('之后所有 dt 写操作将自动同步到云端。'));
        console.log(chalk.dim('运行 `dt remote status` 查看状态。'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('✗ 初始化失败:'), message);
        console.error(chalk.dim('  请检查 GitHub URL 格式和 SSH 权限'));
        process.exit(1);
      }
      console.log('');
    });

  // ─── dt remote status ─────────────────────────────────────
  remote
    .command('status')
    .description('查看远程同步状态')
    .action(() => {
      const config = getRemoteConfig();
      console.log('');

      if (!config) {
        console.log(chalk.yellow('⚠ 尚未配置远程同步'));
        console.log(chalk.dim('  运行 `dt remote set <github-url>` 进行配置'));
        console.log('');
        return;
      }

      console.log(chalk.bold('☁  远程同步状态'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`  远端: ${chalk.cyan(config.remoteUrl)}`);
      console.log(`  本地 clone: ${chalk.dim(getRemoteClonePath())}`);

      const cloneExists = fs.existsSync(getRemoteClonePath());
      console.log(`  Clone 状态: ${cloneExists ? chalk.green('✓ 已就绪') : chalk.red('✗ 不存在')}`);

      if (config.lastSyncAt) {
        const d = new Date(config.lastSyncAt);
        console.log(`  最后同步: ${chalk.dim(d.toLocaleString())}`);
      } else {
        console.log(`  最后同步: ${chalk.dim('尚未同步')}`);
      }

      // 显示云端项目数量
      try {
        const cloudProjects = listCloudProjects();
        const localCount = cloudProjects.filter(p => p.isLocal).length;
        console.log(`  云端项目: ${cloudProjects.length} 个（本机已有 ${localCount} 个）`);

        // 检查全局 dt
        const clonePath = getRemoteClonePath();
        const globalExists = fs.existsSync(clonePath + '/global');
        console.log(`  全局 dt: ${globalExists ? chalk.green('✓ 已同步') : chalk.dim('(无)')}`);
      } catch {
        // ignore
      }

      console.log('');
    });

  // ─── dt remote list ───────────────────────────────────────
  remote
    .command('list')
    .description('列出云端所有项目')
    .action(() => {
      const config = getRemoteConfig();
      if (!config) {
        console.error(chalk.red('✗ 尚未配置远程同步'));
        console.error(chalk.dim('  运行 `dt remote set <github-url>` 进行配置'));
        process.exit(1);
      }

      // 先 pull 最新
      console.log(chalk.dim('正在刷新云端数据...'));
      try {
        remotePullCurrent();
      } catch {
        // ignore
      }

      const projects = listCloudProjects();
      console.log('');
      console.log(chalk.bold('☁  云端项目列表'));
      console.log(chalk.dim('─'.repeat(50)));

      if (projects.length === 0) {
        console.log(chalk.dim('  (云端暂无项目)'));
      } else {
        for (const p of projects) {
          if (p.isLocal) {
            console.log(`  ${chalk.green('●')} ${chalk.bold(p.name)} ${chalk.dim(`[${p.id}]`)}`);
            if (p.localPath) console.log(`    ${chalk.dim(p.localPath)}`);
          } else {
            console.log(`  ${chalk.cyan('⬇')} ${chalk.bold(p.name)} ${chalk.dim(`[${p.id}]`)} ${chalk.cyan('可下载')}`);
          }
        }
      }

      // 检查全局 dt
      const clonePath = getRemoteClonePath();
      if (fs.existsSync(path.join(clonePath, 'global'))) {
        console.log('');
        console.log(`  ${chalk.green('●')} ${chalk.bold('全局 dt')} ${chalk.dim('[global]')}`);
      }

      console.log('');
    });

  // ─── dt remote clone <id> [path] ──────────────────────────
  remote
    .command('clone <project-id> [local-path]')
    .description('从云端下载项目到本机并注册')
    .action((projectId: string, localPath?: string) => {
      const config = getRemoteConfig();
      if (!config) {
        console.error(chalk.red('✗ 尚未配置远程同步'));
        process.exit(1);
      }

      // 先确保 clone 是最新的
      try {
        remotePullCurrent();
      } catch {
        // ignore
      }

      console.log('');
      console.log(chalk.cyan(`⬇ 正在下载项目 "${projectId}"...`));

      try {
        const destDir = cloneProjectFromRemote(projectId, localPath);
        console.log(chalk.green(`✓ 已下载到: ${destDir}`));

        // 读取项目名称并注册
        const dtRoot = path.join(destDir, '.dt');
        let projectName = projectId;
        try {
          const config = readTreeConfig(dtRoot);
          projectName = config.project;
        } catch {
          // ignore
        }

        const id = pathToId(destDir);
        registerProject({ id, name: projectName, path: destDir });
        console.log(chalk.green(`✓ 已注册到本机: ${projectName} [${id}]`));
        console.log(chalk.dim('  之后在此目录执行 dt 命令将自动同步。'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('✗ 下载失败:'), message);
        process.exit(1);
      }
      console.log('');
    });
}
