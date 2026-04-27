/**
 * http-server.ts — HTTP 服务器 + 静态文件服务
 *
 * 用 node:http 创建服务器，处理静态文件和 API 路由。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './api-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * 查找 public 目录：优先 dist/public/，回退 src/public/
 */
function resolvePublicDir(): string {
  // 编译后运行：dist/server/http-server.js → dist/public/
  const distPublic = path.resolve(__dirname, '..', 'public');
  if (fs.existsSync(distPublic)) return distPublic;

  // 开发模式（tsx）：src/server/http-server.ts → src/public/
  const srcPublic = path.resolve(__dirname, '..', 'public');
  if (fs.existsSync(srcPublic)) return srcPublic;

  throw new Error('找不到 public 目录');
}

/**
 * 提供静态文件
 */
function serveStaticFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  publicDir: string,
): void {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  let pathname = url.pathname;

  // 默认 index.html
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(publicDir, pathname);

  // 安全检查：防止路径遍历
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA 回退：非 API 非静态文件都返回 index.html
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

export interface HttpServerOptions {
  port: number;
  host: string;
}

/**
 * 创建并启动 HTTP 服务器
 */
export function createHttpServer(opts: HttpServerOptions): http.Server {
  const publicDir = resolvePublicDir();

  const server = http.createServer(async (req, res) => {
    try {
      // 先尝试 API 路由
      const handled = await handleApiRequest(req, res);
      if (handled) return;

      // 静态文件
      serveStaticFile(req, res, publicDir);
    } catch (err) {
      console.error('[dt serve] 请求处理错误:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    }
  });

  return server;
}
