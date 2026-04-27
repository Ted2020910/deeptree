/**
 * ws-server.ts — WebSocket 服务器
 *
 * 基于 ws 库，附加到 HTTP server 上。
 * 管理客户端连接、广播消息、心跳保活。
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

export interface WsMessage {
  type: 'connected' | 'update' | 'pong';
  scope?: 'nodes' | 'contexts' | 'interactions' | 'changes';
  project?: string;
  timestamp?: string;
}

export interface DtWebSocketServer {
  /** 广播消息到所有已连接客户端 */
  broadcast: (message: WsMessage) => void;
  /** 关闭 WebSocket 服务器 */
  close: () => Promise<void>;
  /** 当前连接数 */
  clientCount: () => number;
}

/**
 * 创建 WebSocket 服务器，附加到 HTTP server
 */
export function createWsServer(httpServer: Server, projectName: string): DtWebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Set<WebSocket>();

  // 心跳保活
  const heartbeatInterval = setInterval(() => {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    }
  }, 30_000);

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);

    // 发送连接成功消息
    ws.send(JSON.stringify({
      type: 'connected',
      project: projectName,
      timestamp: new Date().toISOString(),
    }));

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // 忽略非 JSON 消息
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  function broadcast(message: WsMessage): void {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  async function close(): Promise<void> {
    clearInterval(heartbeatInterval);
    for (const client of clients) {
      client.close();
    }
    clients.clear();
    return new Promise((resolve) => {
      wss.close(() => resolve());
    });
  }

  return {
    broadcast,
    close,
    clientCount: () => clients.size,
  };
}
