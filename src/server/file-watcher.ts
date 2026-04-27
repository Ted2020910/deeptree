/**
 * file-watcher.ts — 文件监听 → WebSocket 广播桥接 (v2)
 *
 * 监听 .dt/nodes/ 目录，变更时通过 WebSocket 通知前端。
 * 内置防抖：300ms 内合并通知。
 */

import { watchDirectory } from '../utils/watcher.js';
import type { DtWebSocketServer, WsMessage } from './ws-server.js';
import type { DtPaths } from '../core/project.js';

interface WatcherHandle {
  close: () => Promise<void>;
}

/**
 * 启动文件监听，将变更广播到 WebSocket
 */
export function startFileWatcher(
  paths: DtPaths,
  wsServer: DtWebSocketServer,
): WatcherHandle {
  const watchers: Array<{ close: () => Promise<void> }> = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function notifyUpdate(): void {
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const msg: WsMessage = {
        type: 'update',
        scope: 'nodes',
        timestamp: new Date().toISOString(),
      };
      wsServer.broadcast(msg);
    }, 300);
  }

  // 只监听 nodes 目录
  const watcher = watchDirectory(paths.nodes, '*.md');
  watchers.push(watcher);

  (async () => {
    for await (const _event of watcher.events) {
      notifyUpdate();
    }
  })().catch(() => {
    // 监听器关闭时忽略错误
  });

  return {
    close: async () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      await Promise.all(watchers.map((w) => w.close()));
    },
  };
}
