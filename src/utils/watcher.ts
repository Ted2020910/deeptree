/**
 * watcher.ts — 文件监听封装 (v2)
 *
 * 修复：
 * - Windows 上 usePolling: true（chokidar 默认 fs.watch 在 Windows 不稳定）
 * - 监听目录而非 glob 字符串（polling 模式下 glob 展开有问题）
 * - 过滤逻辑移到事件处理层（只处理 .md 文件）
 */

import { watch, type FSWatcher } from 'chokidar';
import path from 'node:path';

export interface WatchEvent {
  type: 'add' | 'change' | 'unlink';
  filePath: string;
  filename: string;
}

/**
 * 监听目录变化，返回一个异步可迭代器
 * @param dir 监听的目录路径（直接传目录，不带 glob）
 * @param _pattern 保留参数，不再使用（兼容旧调用签名）
 */
export function watchDirectory(
  dir: string,
  _pattern: string = '*.md',
): {
  events: AsyncIterable<WatchEvent>;
  close: () => Promise<void>;
} {
  let resolveNext: ((event: WatchEvent) => void) | null = null;
  const queue: WatchEvent[] = [];
  let closed = false;

  // 关键修复1：监听目录本身，而非 path.join(dir, '*.md')
  // 关键修复2：usePolling:true，解决 Windows 上 fs.watch 不触发的问题
  const watcher: FSWatcher = watch(dir, {
    ignoreInitial: true,
    persistent: true,
    usePolling: true,
    interval: 500,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  function pushEvent(type: WatchEvent['type'], filePath: string) {
    // 关键修复3：过滤逻辑移到这里，只处理 .md 文件
    if (!filePath.endsWith('.md')) return;

    const event: WatchEvent = {
      type,
      filePath,
      filename: path.basename(filePath),
    };

    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve(event);
    } else {
      queue.push(event);
    }
  }

  watcher.on('add', (fp: string) => pushEvent('add', fp));
  watcher.on('change', (fp: string) => pushEvent('change', fp));
  watcher.on('unlink', (fp: string) => pushEvent('unlink', fp));

  const events: AsyncIterable<WatchEvent> = {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<WatchEvent>> {
          if (closed) return { done: true, value: undefined };

          if (queue.length > 0) {
            return { done: false, value: queue.shift()! };
          }

          return new Promise((resolve) => {
            resolveNext = (event) => {
              resolve({ done: false, value: event });
            };
          });
        },
      };
    },
  };

  return {
    events,
    close: async () => {
      closed = true;
      await watcher.close();
    },
  };
}
