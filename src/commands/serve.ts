/**
 * serve.ts — dt serve 命令
 *
 * 启动本地 Web 服务器 + WebSocket，提供决策树可视化界面。
 * 支持多项目：读取 ~/.dt/projects.json 注册表，同时监听所有可达项目。
 * 向后兼容：注册表为空时降级到当前目录的 .dt/
 */

import type { Command } from 'commander';
import path from 'node:path';
import chalk from 'chalk';
import { findDtRoot, getDtPaths, readTreeConfig } from '../core/project.js';
import { listProjects } from '../core/registry.js';
import { createHttpServer } from '../server/http-server.js';
import { createWsServer } from '../server/ws-server.js';
import { startFileWatcher } from '../server/file-watcher.js';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('启动决策树 Web 可视化服务（支持多项目）')
    .option('-p, --port <port>', '端口号', '3000')
    .option('--host <host>', '监听地址', 'localhost')
    .option('--open', '自动打开浏览器')
    .action(async (opts: { port: string; host: string; open?: boolean }) => {
      try {
        const port = parseInt(opts.port, 10);
        const host = opts.host;

        // 读取注册表中的可达项目
        const registeredProjects = listProjects().filter(p => p.reachable);

        // 向后兼容：注册表为空时降级到当前目录
        const currentDtRoot = findDtRoot();
        if (registeredProjects.length === 0 && !currentDtRoot) {
          console.error(chalk.red('错误: 未找到可用的 dt 项目。'));
          console.error(chalk.dim('  请先运行 `dt init "项目名"` 初始化项目，或 `dt register` 注册已有项目。'));
          process.exit(1);
        }

        // 构建监听列表
        const watchList = registeredProjects.map(p => ({
          projectId: p.id,
          paths: getDtPaths(path.join(p.path, '.dt')),
        }));

        // 若注册表为空但有当前目录项目，添加它（兼容旧用法）
        if (watchList.length === 0 && currentDtRoot) {
          const config = readTreeConfig(currentDtRoot);
          watchList.push({
            projectId: '_default',
            paths: getDtPaths(currentDtRoot),
          });
          console.log(chalk.dim('  注册表为空，使用当前目录项目: ') + chalk.bold(config.project));
        }

        // 创建服务器
        const httpServer = createHttpServer({ port, host });
        const firstProjectName = registeredProjects[0]?.name ?? 'dt';
        const wsServer = createWsServer(httpServer, firstProjectName);
        const fileWatcher = startFileWatcher(watchList, wsServer);

        httpServer.listen(port, host, () => {
          const url = `http://${host}:${port}`;
          console.log('');
          console.log(chalk.green('  🌳 dt serve 已启动'));
          console.log('');
          if (registeredProjects.length > 0) {
            console.log(`  项目: ${registeredProjects.map(p => chalk.bold(p.name)).join(', ')}`);
          }
          console.log(`  地址: ${chalk.cyan(url)}`);
          console.log(`  API:  ${chalk.dim(`${url}/api/projects`)}`);
          console.log('');
          console.log(chalk.dim('  按 Ctrl+C 停止服务'));
          console.log('');

          if (opts.open) {
            const { exec } = require('node:child_process');
            const cmd = process.platform === 'win32' ? 'start'
              : process.platform === 'darwin' ? 'open'
              : 'xdg-open';
            exec(`${cmd} ${url}`);
          }
        });

        const shutdown = async () => {
          console.log(chalk.dim('\n  正在关闭...'));
          await fileWatcher.close();
          await wsServer.close();
          httpServer.close();
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      } catch (err) {
        console.error(chalk.red(`错误: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });
}
