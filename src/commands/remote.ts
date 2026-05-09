/**
 * remote.ts — dt remote / dt push / dt pull 命令
 *
 *   dt remote set <github-url>   配置云端仓库
 *   dt remote status             查看同步状态
 *   dt remote list               列出云端所有项目
 *   dt remote clone <id> [path]  从云端下载项目到本机
 *   dt push                      推送当前项目到云端
 *   dt pull                      从云端拉取当前项目（覆盖本地）
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
  pushProject,
  pullProject,
} from '../core/remote.js';
import { registerProject, pathToId } from '../core/registry.js';
import { findDtRoot, requireDtRoot, readTreeConfig } from '../core/project.js';

export function registerRemoteCommands(program: Command): void {

  // ─── dt remote（子命令组）────────────────────────────────────
  const remote = program
    .command('remote')
    .description('管理 GitHub 远程同步');

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
        console.log(chalk.dim('使用 `dt push` 推送当前项目，`dt pull` 拉取最新内容。'));
      } catch (err: unknown) {
        console.error(chalk.red('✗ 初始化失败:'), err instanceof Error ? err.message : String(err));
        console.error(chalk.dim('  请检查 GitHub URL 格式和 SSH 权限'));
        process.exit(1);
      }
      console.log('');
    });

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
        console.log(`  最后同步: ${chalk.dim(new Date(config.lastSyncAt).toLocaleString())}`);
      } else {
        console.log(`  最后同步: ${chalk.dim('尚未同步')}`);
      }
      try {
        const projects = listCloudProjects();
        const localCount = projects.filter(p => p.isLocal).length;
        console.log(`  云端项目: ${projects.length} 个（本机已有 ${localCount} 个）`);
        const globalExists = fs.existsSync(path.join(getRemoteClonePath(), 'global'));
        console.log(`  全局 dt: ${globalExists ? chalk.green('✓') : chalk.dim('(无)')}`);
      } catch { /* ignore */ }
      console.log('');
    });

  remote
    .command('list')
    .description('列出云端所有项目')
    .action(() => {
      const config = getRemoteConfig();
      if (!config) {
        console.error(chalk.red('✗ 尚未配置远程同步'));
        process.exit(1);
      }
      const projects = listCloudProjects();
      console.log('');
      console.log(chalk.bold('☁  云端项目列表'));
      console.log(chalk.dim('─'.repeat(50)));
      if (projects.length === 0) {
        console.log(chalk.dim('  (云端暂无项目，运行 `dt push` 上传当前项目)'));
      } else {
        for (const p of projects) {
          if (p.isLocal) {
            console.log(`  ${chalk.green('●')} ${chalk.bold(p.id)}  ${chalk.dim(p.localPath ?? '')}`);
          } else {
            console.log(`  ${chalk.cyan('⬇')} ${chalk.bold(p.id)}  ${chalk.cyan('可下载')}`);
          }
        }
      }
      const globalExists = fs.existsSync(path.join(getRemoteClonePath(), 'global'));
      if (globalExists) {
        console.log(`  ${chalk.green('●')} ${chalk.bold('global')}  ${chalk.dim('全局 dt')}`);
      }
      console.log('');
    });

  remote
    .command('clone <project-id> [local-path]')
    .description('从云端下载项目到本机并注册')
    .action((projectId: string, localPath?: string) => {
      const config = getRemoteConfig();
      if (!config) {
        console.error(chalk.red('✗ 尚未配置远程同步'));
        process.exit(1);
      }
      console.log('');
      console.log(chalk.cyan(`⬇ 正在下载项目 "${projectId}"...`));
      try {
        const destDir = cloneProjectFromRemote(projectId, localPath);
        console.log(chalk.green(`✓ 已下载到: ${destDir}`));

        const dtRoot = path.join(destDir, '.dt');
        let projectName = projectId;
        try { projectName = readTreeConfig(dtRoot).project; } catch { /* ignore */ }

        const id = pathToId(destDir);
        registerProject({ id, name: projectName, path: destDir });
        console.log(chalk.green(`✓ 已注册: ${projectName} [${id}]`));
        console.log(chalk.dim('  在此目录运行 `dt push` 可将本地修改同步回云端。'));
      } catch (err: unknown) {
        console.error(chalk.red('✗ 下载失败:'), err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      console.log('');
    });

  // ─── dt push ─────────────────────────────────────────────────
  program
    .command('push')
    .description('推送当前项目到云端')
    .action(() => {
      const dtRoot = requireDtRoot();
      const config = getRemoteConfig();
      if (!config) {
        console.error(chalk.red('✗ 尚未配置远程同步'));
        console.error(chalk.dim('  运行 `dt remote set <github-url>` 进行配置'));
        process.exit(1);
      }
      console.log('');
      console.log(chalk.cyan('⬆ 正在推送到云端...'));
      try {
        const label = pushProject(dtRoot);
        console.log(chalk.green(`✓ 已推送: ${label}`));
      } catch (err: unknown) {
        console.error(chalk.red('✗ 推送失败:'), err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      console.log('');
    });

  // ─── dt pull ─────────────────────────────────────────────────
  program
    .command('pull')
    .description('从云端拉取当前项目（云端覆盖本地）')
    .action(() => {
      const dtRoot = requireDtRoot();
      const config = getRemoteConfig();
      if (!config) {
        console.error(chalk.red('✗ 尚未配置远程同步'));
        console.error(chalk.dim('  运行 `dt remote set <github-url>` 进行配置'));
        process.exit(1);
      }
      console.log('');
      console.log(chalk.cyan('⬇ 正在从云端拉取...'));
      try {
        const label = pullProject(dtRoot);
        console.log(chalk.green(`✓ 已拉取: ${label}（云端版本已覆盖本地）`));
      } catch (err: unknown) {
        console.error(chalk.red('✗ 拉取失败:'), err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      console.log('');
    });
}
