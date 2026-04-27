/**
 * frontmatter.ts — YAML frontmatter 解析与序列化
 *
 * 使用 gray-matter 读写 Markdown 文件的 YAML frontmatter。
 */

import matter from 'gray-matter';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 读取一个 Markdown 文件，返回 frontmatter 对象和正文内容
 */
export function readFrontmatterFile<T extends Record<string, any>>(
  filePath: string,
): { frontmatter: T; content: string } {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as T,
    content: parsed.content.trim(),
  };
}

/**
 * 将 frontmatter 对象和正文写入 Markdown 文件
 */
export function writeFrontmatterFile<T extends Record<string, any>>(
  filePath: string,
  frontmatter: T,
  content: string,
): void {
  // 确保目录存在
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const output = matter.stringify(content, frontmatter);
  fs.writeFileSync(filePath, output, 'utf-8');
}

/**
 * 只更新 frontmatter 中的部分字段，保留正文不变
 */
export function updateFrontmatter<T extends Record<string, any>>(
  filePath: string,
  updates: Partial<T>,
): void {
  const { frontmatter, content } = readFrontmatterFile<T>(filePath);
  const merged = { ...frontmatter, ...updates };
  writeFrontmatterFile(filePath, merged, content);
}

/**
 * 追加内容到文件正文末尾
 */
export function appendContent(filePath: string, appendText: string): void {
  const { frontmatter, content } = readFrontmatterFile(filePath);
  const newContent = content ? `${content}\n\n${appendText}` : appendText;
  writeFrontmatterFile(filePath, frontmatter, newContent);
}
