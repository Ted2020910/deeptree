/**
 * serve.ts — dt serve 命令
 *
 * 启动本地 Web 服务器 + WebSocket，提供决策树可视化界面。
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { requireDtRoot, getDtPaths, readTreeConfig } from '../core/project.js';
import { createHttpServer } from '../server/http-server.js';
import { createWsServer } from '../server/ws-server.js';
import { startFileWatcher } from '../server/file-watcher.js';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('启动决策树 Web 可视化服务')
    .option('-p, --port <port>', '端口号', '3000')
    .option('--host <host>', '监听地址', 'localhost')
    .option('--open', '自动打开浏览器')
    .action(async (opts: { port: string; host: string; open?: boolean }) => {
      try {
        const dtRoot = requireDtRoot();
        const paths = getDtPaths(dtRoot);
        const config = readTreeConfig(dtRoot);
        const port = parseInt(opts.port, 10);
        const host = opts.host;

        // 创建 HTTP 服务器
        const httpServer = createHttpServer({ port, host });

        // 创建 WebSocket 服务器
        const wsServer = createWsServer(httpServer, config.project);

        // 启动文件监听
        const fileWatcher = startFileWatcher(paths, wsServer);

        // 启动服务
        httpServer.listen(port, host, () => {
          const url = `http://${host}:${port}`;
          console.log('');
          console.log(chalk.green('  🌳 dt serve 已启动'));
          console.log('');
          console.log(`  项目: ${chalk.bold(config.project)}`);
          console.log(`  地址: ${chalk.cyan(url)}`);
          console.log(`  API:  ${chalk.dim(`${url}/api/tree`)}`);
          console.log('');
          console.log(chalk.dim('  按 Ctrl+C 停止服务'));
          console.log('');

          // 自动打开浏览器
          if (opts.open) {
            const { exec } = require('node:child_process');
            const cmd = process.platform === 'win32' ? 'start'
              : process.platform === 'darwin' ? 'open'
              : 'xdg-open';
            exec(`${cmd} ${url}`);
          }
        });

        // 优雅退出
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
