/**
 * registry.ts — 全局项目注册表
 *
 * 管理 ~/.dt/projects.json，记录所有 dt 项目的路径。
 * dt init 时自动注册，dt register/unregister 手动管理。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface ProjectEntry {
  id: string       // URL-safe slug，如 "dt-cli"
  name: string     // 显示名，如 "dt"
  path: string     // 绝对路径，如 "/Users/xxx/code/dt"
  addedAt: string  // ISO datetime
}

interface Registry {
  projects: ProjectEntry[]
}

/** 注册表文件路径 */
export function getRegistryPath(): string {
  return path.join(os.homedir(), '.dt', 'projects.json');
}

/** 读取注册表（不存在时返回空注册表） */
export function readRegistry(): Registry {
  const registryPath = getRegistryPath();
  if (!fs.existsSync(registryPath)) {
    return { projects: [] };
  }
  try {
    const content = fs.readFileSync(registryPath, 'utf-8');
    return JSON.parse(content) as Registry;
  } catch {
    return { projects: [] };
  }
}

/** 写入注册表（自动创建目录） */
export function writeRegistry(registry: Registry): void {
  const registryPath = getRegistryPath();
  const dir = path.dirname(registryPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
}

/** 注册一个项目（id 已存在则更新 path） */
export function registerProject(entry: Omit<ProjectEntry, 'addedAt'>): void {
  const registry = readRegistry();
  const existing = registry.projects.findIndex(p => p.id === entry.id);
  const newEntry: ProjectEntry = { ...entry, addedAt: new Date().toISOString() };

  if (existing >= 0) {
    registry.projects[existing] = newEntry;
  } else {
    registry.projects.push(newEntry);
  }
  writeRegistry(registry);
}

/** 从注册表移除一个项目 */
export function unregisterProject(id: string): boolean {
  const registry = readRegistry();
  const before = registry.projects.length;
  registry.projects = registry.projects.filter(p => p.id !== id);
  if (registry.projects.length < before) {
    writeRegistry(registry);
    return true;
  }
  return false;
}

/** 按 id 查找项目 */
export function findProjectById(id: string): ProjectEntry | undefined {
  return readRegistry().projects.find(p => p.id === id);
}

/** 列出所有项目，带 reachable 状态 */
export function listProjects(): Array<ProjectEntry & { reachable: boolean }> {
  const registry = readRegistry();
  return registry.projects.map(p => ({
    ...p,
    reachable: fs.existsSync(path.join(p.path, '.dt')),
  }));
}

/** 根据目录路径生成 id slug */
export function pathToId(dirPath: string): string {
  return path.basename(dirPath)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}
