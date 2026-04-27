/**
 * watcher.ts — 文件监听封装
 *
 * 使用 chokidar 监听 .dt/ 目录下的文件变化
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
 */
export function watchDirectory(
  dir: string,
  pattern: string = '*.md',
): {
  events: AsyncIterable<WatchEvent>;
  close: () => Promise<void>;
} {
  let resolveNext: ((event: WatchEvent) => void) | null = null;
  const queue: WatchEvent[] = [];
  let closed = false;

  const watcher: FSWatcher = watch(path.join(dir, pattern), {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  function pushEvent(type: WatchEvent['type'], filePath: string) {
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
