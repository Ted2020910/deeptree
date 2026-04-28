/**
 * file-watcher.ts — 文件监听 → WebSocket 广播桥接 (v2)
 *
 * 支持多项目监听，变更时携带 projectId 通知前端。
 * 内置防抖：300ms 内合并通知。
 */

import { watchDirectory } from '../utils/watcher.js';
import type { DtWebSocketServer, WsMessage } from './ws-server.js';
import type { DtPaths } from '../core/project.js';

interface WatcherHandle {
  close: () => Promise<void>;
}

interface ProjectWatch {
  projectId: string;
  paths: DtPaths;
}

/**
 * 启动文件监听，将变更广播到 WebSocket
 * 支持单项目（向后兼容）和多项目
 */
export function startFileWatcher(
  pathsOrList: DtPaths | ProjectWatch[],
  wsServer: DtWebSocketServer,
): WatcherHandle {
  const watchers: Array<{ close: () => Promise<void> }> = [];
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function notifyUpdate(projectId: string): void {
    const existing = debounceTimers.get(projectId);
    if (existing) clearTimeout(existing);

    debounceTimers.set(projectId, setTimeout(() => {
      debounceTimers.delete(projectId);
      const msg: WsMessage = {
        type: 'update',
        scope: 'nodes',
        project: projectId,
        timestamp: new Date().toISOString(),
      };
      wsServer.broadcast(msg);
    }, 300));
  }

  // 规范化输入：兼容旧的单 DtPaths 参数
  const watchList: ProjectWatch[] = Array.isArray(pathsOrList)
    ? pathsOrList
    : [{ projectId: '_default', paths: pathsOrList }];

  for (const { projectId, paths } of watchList) {
    const watcher = watchDirectory(paths.nodes, '*.md');
    watchers.push(watcher);

    const pid = projectId; // closure capture
    (async () => {
      for await (const _event of watcher.events) {
        notifyUpdate(pid);
      }
    })().catch(() => {
      // 监听器关闭时忽略错误
    });
  }

  return {
    close: async () => {
      for (const timer of debounceTimers.values()) clearTimeout(timer);
      debounceTimers.clear();
      await Promise.all(watchers.map((w) => w.close()));
    },
  };
}
