/**
 * id.ts — ID 生成器
 *
 * 根据目录中已有文件扫描最大 ID 并 +1，生成新 ID。
 *
 * 规则：nodes/ → 001, 002, 003 ...
 */

import fs from 'node:fs';

/**
 * 从目录中扫描已有文件，提取数字部分，找最大值 +1
 *
 * @param dir - 目标目录路径
 * @param prefix - ID 前缀（默认 ''）
 * @param digits - 数字位数（默认 3）
 * @returns 新 ID 字符串，如 "004"
 */
export function generateNextId(
  dir: string,
  prefix: string = '',
  digits: number = 3,
): string {
  if (!fs.existsSync(dir)) {
    return `${prefix}${'1'.padStart(digits, '0')}`;
  }

  const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.md'));
  let maxNum = 0;

  const pattern = new RegExp(`^${prefix}(\\d{${digits}})\\.md$`);

  for (const file of files) {
    const match = file.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(digits, '0')}`;
}

/**
 * 根据 ID 字符串获取文件名
 */
export function idToFilename(id: string): string {
  return `${id}.md`;
}

/**
 * 从文件名提取 ID
 */
export function filenameToId(filename: string): string {
  return filename.replace(/\.md$/, '');
}
