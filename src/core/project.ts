/**
 * project.ts — .dt/ 项目目录管理 & tree.yaml 读写
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { TreeConfig } from '../types/index.js';

/** .dt/ 子目录列表 */
const DT_SUBDIRS = ['nodes'];

// TreeConfig.root_node 已废弃，根节点由节点的 root:true 字段标记

/**
 * 从当前工作目录向上查找 .dt/ 目录
 * @returns .dt/ 目录的绝对路径，未找到则返回 null
 */
export function findDtRoot(startDir?: string): string | null {
  let dir = startDir ?? process.cwd();

  while (true) {
    const dtDir = path.join(dir, '.dt');
    if (fs.existsSync(dtDir) && fs.statSync(dtDir).isDirectory()) {
      return dtDir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // 到达根目录
    dir = parent;
  }

  return null;
}

/**
 * 获取 .dt/ 路径，不存在则抛出错误
 */
export function requireDtRoot(): string {
  const dtRoot = findDtRoot();
  if (!dtRoot) {
    throw new Error(
      '未找到 .dt/ 目录。请先运行 `dt init "项目名称"` 初始化项目。',
    );
  }
  return dtRoot;
}

/**
 * .dt/ 各子目录路径
 */
export type DtPaths = ReturnType<typeof getDtPaths>;

/**
 * 获取 .dt/ 下各子目录的路径
 */
export function getDtPaths(dtRoot: string) {
  return {
    root: dtRoot,
    treeYaml: path.join(dtRoot, 'tree.yaml'),
    nodes: path.join(dtRoot, 'nodes'),
  };
}

/**
 * 初始化 .dt/ 目录结构
 */
export function createDtStructure(baseDir: string): string {
  const dtDir = path.join(baseDir, '.dt');

  if (fs.existsSync(dtDir)) {
    throw new Error(`.dt/ 目录已存在于 ${baseDir}`);
  }

  fs.mkdirSync(dtDir, { recursive: true });

  for (const sub of DT_SUBDIRS) {
    fs.mkdirSync(path.join(dtDir, sub), { recursive: true });
  }

  return dtDir;
}

/**
 * 创建 tree.yaml
 */
export function writeTreeConfig(dtRoot: string, config: TreeConfig): void {
  const filePath = path.join(dtRoot, 'tree.yaml');
  const content = yaml.dump(config, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 读取 tree.yaml
 */
export function readTreeConfig(dtRoot: string): TreeConfig {
  const filePath = path.join(dtRoot, 'tree.yaml');
  if (!fs.existsSync(filePath)) {
    throw new Error(`tree.yaml 不存在: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(raw) as TreeConfig;
}

/**
 * 更新 tree.yaml 的部分字段
 */
export function updateTreeConfig(
  dtRoot: string,
  updates: Partial<TreeConfig>,
): void {
  const config = readTreeConfig(dtRoot);
  const merged = { ...config, ...updates };
  writeTreeConfig(dtRoot, merged);
}
