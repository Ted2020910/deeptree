/**
 * remote.ts — GitHub 远程同步（手动触发）
 *
 * 将当前项目的 .dt/ 节点内容同步到中央 GitHub 仓库（dt-cloud）。
 *
 * 设计原则：
 * - 手动触发：用户显式执行 dt push / dt pull
 * - 内容只同步节点数据（tree.yaml + nodes/*.md），不上传本机路径
 * - pull 时云端覆盖本地（以云端为准）
 * - 各机器独立维护自己的注册表，不上云
 *
 * 云端结构：
 *   dt-cloud/
 *   ├── global/              # 全局 dt（如存在）
 *   │   ├── tree.yaml
 *   │   └── nodes/
 *   └── projects/
 *       └── <project-id>/
 *           ├── tree.yaml
 *           └── nodes/
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { readRegistry, getRegistryPath } from './registry.js';

// ─────────────────────────────────────────────
// 类型与路径
// ─────────────────────────────────────────────

export interface RemoteConfig {
  remoteUrl: string
  lastSyncAt?: string
}

export function getDtHomeDir(): string {
  return path.join(os.homedir(), '.dt');
}

function getRemoteConfigPath(): string {
  return path.join(getDtHomeDir(), 'config.json');
}

export function getRemoteClonePath(): string {
  return path.join(getDtHomeDir(), 'remote');
}

export function getGlobalDtPath(): string {
  return path.join(getDtHomeDir(), 'global');
}

// ─────────────────────────────────────────────
// 配置读写
// ─────────────────────────────────────────────

export function getRemoteConfig(): RemoteConfig | null {
  const configPath = getRemoteConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!parsed.remoteUrl) return null;
    return parsed as RemoteConfig;
  } catch {
    return null;
  }
}

export function setRemoteConfig(config: RemoteConfig): void {
  const dir = getDtHomeDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getRemoteConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

export function isGlobalDt(dtRoot: string): boolean {
  const globalPath = getGlobalDtPath();
  return dtRoot === globalPath || dtRoot.startsWith(globalPath + path.sep);
}

/** 从注册表反查 project-id */
function getProjectIdFromDtRoot(dtRoot: string): string | null {
  const projectDir = path.dirname(dtRoot);
  const registry = readRegistry();
  return registry.projects.find(p => p.path === projectDir)?.id ?? null;
}

/** 递归拷贝目录（覆盖目标） */
function copyDirSync(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const srcItem = path.join(src, item);
    const destItem = path.join(dest, item);
    if (fs.statSync(srcItem).isDirectory()) {
      copyDirSync(srcItem, destItem);
    } else {
      fs.copyFileSync(srcItem, destItem);
    }
  }
}

function git(args: string[], cwd: string, timeoutMs = 15000): string {
  return execFileSync('git', args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: timeoutMs,
  });
}

// ─────────────────────────────────────────────
// 初始化 — dt remote set
// ─────────────────────────────────────────────

export function initRemoteClone(remoteUrl: string): void {
  const clonePath = getRemoteClonePath();

  if (fs.existsSync(path.join(clonePath, '.git'))) {
    try {
      const existing = git(['remote', 'get-url', 'origin'], clonePath).trim();
      if (existing !== remoteUrl) {
        git(['remote', 'set-url', 'origin', remoteUrl], clonePath);
      }
    } catch {
      try { git(['remote', 'set-url', 'origin', remoteUrl], clonePath); } catch { /* ignore */ }
    }
    try { git(['pull', '--rebase', '--autostash'], clonePath, 20000); } catch { /* ignore */ }
  } else {
    const parentDir = getDtHomeDir();
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

    const tmpPath = clonePath + '.tmp';
    if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { recursive: true });
    execFileSync('git', ['clone', remoteUrl, tmpPath], { stdio: 'pipe', timeout: 60000 });
    if (fs.existsSync(clonePath)) fs.rmSync(clonePath, { recursive: true });
    fs.renameSync(tmpPath, clonePath);
  }

  setRemoteConfig({ remoteUrl });
}

// ─────────────────────────────────────────────
// 手动推送 — dt push
// ─────────────────────────────────────────────

/**
 * 将当前项目的 .dt/ 推送到云端。
 * @returns 推送的 project-id 或 'global'
 */
export function pushProject(dtRoot: string): string {
  const config = getRemoteConfig();
  if (!config) throw new Error('尚未配置远程同步，请先运行 `dt remote set <github-url>`');

  const clonePath = getRemoteClonePath();
  if (!fs.existsSync(path.join(clonePath, '.git'))) {
    throw new Error('本地 clone 不存在，请先运行 `dt remote set <github-url>`');
  }

  // 先拉取最新，避免推送时被 reject
  try { git(['pull', '--rebase', '--autostash'], clonePath, 10000); } catch { /* ignore */ }

  let destDir: string;
  let label: string;

  if (isGlobalDt(dtRoot)) {
    destDir = path.join(clonePath, 'global');
    label = 'global';
  } else {
    const projectId = getProjectIdFromDtRoot(dtRoot);
    if (!projectId) throw new Error('当前项目未注册，请先运行 `dt register`');
    destDir = path.join(clonePath, 'projects', projectId);
    label = projectId;
  }

  // 清空旧的 nodes/，整体覆盖（确保删除的节点不会残留）
  const destNodes = path.join(destDir, 'nodes');
  if (fs.existsSync(destNodes)) fs.rmSync(destNodes, { recursive: true });

  // 拷贝 .dt/ 内容（仅 tree.yaml + nodes/，不含其他文件）
  const treeYaml = path.join(dtRoot, 'tree.yaml');
  if (fs.existsSync(treeYaml)) fs.copyFileSync(treeYaml, path.join(destDir, 'tree.yaml') as string);
  const nodesDir = path.join(dtRoot, 'nodes');
  if (fs.existsSync(nodesDir)) copyDirSync(nodesDir, destNodes);

  // commit + push
  git(['add', '.'], clonePath);

  let hasChanges = false;
  try {
    git(['diff', '--cached', '--quiet'], clonePath);
  } catch {
    hasChanges = true;
  }

  if (hasChanges) {
    git(['commit', '-m', `push: ${label}`], clonePath);
    git(['push', 'origin', 'HEAD'], clonePath, 20000);
  }

  setRemoteConfig({ ...config, lastSyncAt: new Date().toISOString() });
  return label;
}

// ─────────────────────────────────────────────
// 手动拉取 — dt pull
// ─────────────────────────────────────────────

/**
 * 从云端拉取当前项目最新内容，覆盖本地 .dt/。
 * @returns 拉取的 project-id 或 'global'
 */
export function pullProject(dtRoot: string): string {
  const config = getRemoteConfig();
  if (!config) throw new Error('尚未配置远程同步，请先运行 `dt remote set <github-url>`');

  const clonePath = getRemoteClonePath();
  if (!fs.existsSync(path.join(clonePath, '.git'))) {
    throw new Error('本地 clone 不存在，请先运行 `dt remote set <github-url>`');
  }

  // 拉取最新
  git(['pull', '--rebase', '--autostash'], clonePath, 20000);

  let srcDir: string;
  let label: string;

  if (isGlobalDt(dtRoot)) {
    srcDir = path.join(clonePath, 'global');
    label = 'global';
  } else {
    const projectId = getProjectIdFromDtRoot(dtRoot);
    if (!projectId) throw new Error('当前项目未注册，请先运行 `dt register`');
    srcDir = path.join(clonePath, 'projects', projectId);
    label = projectId;
  }

  if (!fs.existsSync(srcDir)) {
    throw new Error(`云端不存在项目 "${label}"，请先在某台机器上 dt push`);
  }

  // 云端覆盖本地（清空 nodes/ 后重新复制）
  const localNodes = path.join(dtRoot, 'nodes');
  if (fs.existsSync(localNodes)) fs.rmSync(localNodes, { recursive: true });
  copyDirSync(srcDir, dtRoot);

  setRemoteConfig({ ...config, lastSyncAt: new Date().toISOString() });
  return label;
}

// ─────────────────────────────────────────────
// 云端项目列表
// ─────────────────────────────────────────────

export interface CloudProject {
  id: string
  isLocal: boolean
  localPath?: string
}

export function listCloudProjects(): CloudProject[] {
  const clonePath = getRemoteClonePath();
  const projectsDir = path.join(clonePath, 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const localRegistry = readRegistry();
  const cloudIds = fs.readdirSync(projectsDir).filter(f =>
    fs.statSync(path.join(projectsDir, f)).isDirectory(),
  );

  return cloudIds.map(id => {
    const localEntry = localRegistry.projects.find(p => p.id === id);
    return { id, isLocal: !!localEntry, localPath: localEntry?.path };
  });
}

// ─────────────────────────────────────────────
// 从云端下载项目
// ─────────────────────────────────────────────

export function cloneProjectFromRemote(projectId: string, localPath?: string): string {
  const clonePath = getRemoteClonePath();
  // 先拉取最新
  try { git(['pull', '--rebase', '--autostash'], clonePath, 15000); } catch { /* ignore */ }

  const srcProject = path.join(clonePath, 'projects', projectId);
  if (!fs.existsSync(srcProject)) throw new Error(`云端不存在项目 "${projectId}"`);

  const destDir = localPath ? path.resolve(localPath) : path.join(os.homedir(), 'projects', projectId);
  const destDt = path.join(destDir, '.dt');
  fs.mkdirSync(destDt, { recursive: true });
  copyDirSync(srcProject, destDt);

  return destDir;
}
