/**
 * remote.ts — GitHub 远程同步（对模型透明）
 *
 * 将本机的 .dt/ 数据和全局注册表镜像到一个中央 GitHub 仓库（dt-cloud）。
 * 所有操作静默进行，失败不影响用户工作。
 *
 * 云端结构：
 *   dt-cloud/
 *   ├── registry.json        # 全局注册表
 *   ├── global/              # 全局 dt 项目
 *   │   ├── tree.yaml
 *   │   └── nodes/
 *   └── projects/
 *       ├── <project-id>/
 *       │   ├── tree.yaml
 *       │   └── nodes/
 *       └── ...
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import { readRegistry, writeRegistry, getRegistryPath } from './registry.js';
import type { ProjectEntry } from './registry.js';

// ─────────────────────────────────────────────
// 类型与路径
// ─────────────────────────────────────────────

export interface RemoteConfig {
  remoteUrl: string
  lastSyncAt?: string
}

/** ~/.dt/ 根目录 */
function getDtHomeDir(): string {
  return path.join(os.homedir(), '.dt');
}

/** ~/.dt/config.json */
function getRemoteConfigPath(): string {
  return path.join(getDtHomeDir(), 'config.json');
}

/** ~/.dt/remote/ — dt-cloud 的本地 clone */
export function getRemoteClonePath(): string {
  return path.join(getDtHomeDir(), 'remote');
}

/** ~/.dt/global/ — 全局 dt 项目 */
export function getGlobalDtPath(): string {
  return path.join(getDtHomeDir(), 'global');
}

// ─────────────────────────────────────────────
// 配置读写
// ─────────────────────────────────────────────

/** 读取远程配置，未配置返回 null */
export function getRemoteConfig(): RemoteConfig | null {
  const configPath = getRemoteConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.remoteUrl) return null;
    return parsed as RemoteConfig;
  } catch {
    return null;
  }
}

/** 写入远程配置 */
export function setRemoteConfig(config: RemoteConfig): void {
  const dir = getDtHomeDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getRemoteConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 判断 dtRoot 是否为全局 dt */
export function isGlobalDt(dtRoot: string): boolean {
  const globalPath = getGlobalDtPath();
  return dtRoot === globalPath || dtRoot.startsWith(globalPath + path.sep);
}

/** 从注册表反查 project-id（根据 dtRoot 所在目录） */
function getProjectIdFromDtRoot(dtRoot: string): string | null {
  const projectDir = path.dirname(dtRoot);
  const registry = readRegistry();
  const entry = registry.projects.find(p => p.path === projectDir);
  return entry?.id ?? null;
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

/** 合并两个注册表（远端新条目追加，本地独有保留） */
function mergeRegistries(
  local: { projects: ProjectEntry[] },
  remote: { projects: ProjectEntry[] },
): { projects: ProjectEntry[] } {
  const merged = [...local.projects];
  for (const remoteEntry of remote.projects) {
    const exists = merged.find(p => p.id === remoteEntry.id);
    if (!exists) {
      // 远端新项目，追加（path 为云端记录，本机可能不同，但保留 id/name 供参考）
      merged.push(remoteEntry);
    }
  }
  return { projects: merged };
}

/** 执行 git 命令，带超时，失败抛出 */
function git(args: string[], cwd: string, timeoutMs = 10000): string {
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

/**
 * 初始化远程同步：
 * 1. 若 ~/.dt/remote/ 已是合法 clone，直接更新 config
 * 2. 否则 git clone <remoteUrl> ~/.dt/remote/
 */
export function initRemoteClone(remoteUrl: string): void {
  const clonePath = getRemoteClonePath();

  if (fs.existsSync(path.join(clonePath, '.git'))) {
    // 已存在 clone，验证 remote url 是否一致
    try {
      const existingRemote = git(['remote', 'get-url', 'origin'], clonePath).trim();
      if (existingRemote !== remoteUrl) {
        git(['remote', 'set-url', 'origin', remoteUrl], clonePath);
      }
    } catch {
      // 重置 remote url
      try {
        git(['remote', 'set-url', 'origin', remoteUrl], clonePath);
      } catch {
        // ignore
      }
    }
    // 拉取最新
    try {
      git(['pull', '--rebase', '--autostash'], clonePath, 15000);
    } catch {
      // ignore network issues
    }
  } else {
    // 全新 clone
    const parentDir = getDtHomeDir();
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

    // clone 到临时名再 rename，避免部分 clone 留下脏目录
    const tmpPath = clonePath + '.tmp';
    if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { recursive: true });

    execFileSync('git', ['clone', remoteUrl, tmpPath], {
      stdio: 'pipe',
      timeout: 60000,
    });
    if (fs.existsSync(clonePath)) fs.rmSync(clonePath, { recursive: true });
    fs.renameSync(tmpPath, clonePath);
  }

  setRemoteConfig({ remoteUrl });
}

// ─────────────────────────────────────────────
// 自动推送 — 写操作后透明调用
// ─────────────────────────────────────────────

/**
 * 写操作后自动同步到云端。
 * 对 Agent/模型完全透明：静默处理所有错误。
 */
export function remoteAutoSync(dtRoot: string, message: string): void {
  const config = getRemoteConfig();
  if (!config) return;

  const clonePath = getRemoteClonePath();
  if (!fs.existsSync(path.join(clonePath, '.git'))) return;

  try {
    // 先拉取最新（避免 push 冲突）
    try {
      git(['pull', '--rebase', '--autostash'], clonePath, 8000);
    } catch {
      // 网络问题，跳过 pull，仍尝试 push
    }

    if (isGlobalDt(dtRoot)) {
      // 同步全局 dt
      const destGlobal = path.join(clonePath, 'global');
      copyDirSync(dtRoot, destGlobal);
    } else {
      // 同步当前项目
      const projectId = getProjectIdFromDtRoot(dtRoot);
      if (!projectId) return; // 未注册的项目不同步

      const destProject = path.join(clonePath, 'projects', projectId);
      // 先清空目标目录的 nodes/，再复制（避免删除节点后云端仍保留）
      const destNodes = path.join(destProject, 'nodes');
      if (fs.existsSync(destNodes)) fs.rmSync(destNodes, { recursive: true });
      copyDirSync(dtRoot, destProject);
    }

    // 同步注册表
    const registryPath = getRegistryPath();
    if (fs.existsSync(registryPath)) {
      fs.copyFileSync(registryPath, path.join(clonePath, 'registry.json'));
    }

    // git commit + push
    try {
      git(['add', '.'], clonePath);
    } catch {
      return;
    }

    // 检查是否有变更
    try {
      git(['diff', '--cached', '--quiet'], clonePath);
      return; // 无变更
    } catch {
      // 有变更，继续
    }

    const projectId = isGlobalDt(dtRoot) ? 'global' : (getProjectIdFromDtRoot(dtRoot) ?? 'unknown');
    git(['commit', '-m', `sync: ${projectId} — ${message}`], clonePath);

    try {
      git(['push', 'origin', 'HEAD'], clonePath, 15000);
    } catch {
      // push 失败（网络问题），保留本地 commit，下次会推送
    }

    // 更新最后同步时间
    setRemoteConfig({ ...config, lastSyncAt: new Date().toISOString() });
  } catch {
    // 静默处理所有错误，不影响用户工作
  }
}

// ─────────────────────────────────────────────
// 自动拉取 — 读操作前透明调用
// ─────────────────────────────────────────────

/**
 * 读操作前自动拉取当前项目最新数据。
 * 带 3 秒超时，静默失败。
 */
export function remotePullCurrent(dtRoot?: string): void {
  const config = getRemoteConfig();
  if (!config) return;

  const clonePath = getRemoteClonePath();
  if (!fs.existsSync(path.join(clonePath, '.git'))) return;

  try {
    // 拉取云端最新
    git(['pull', '--rebase', '--autostash'], clonePath, 3000);

    if (dtRoot) {
      if (isGlobalDt(dtRoot)) {
        // 从云端 global/ 覆盖本地 global dt
        const srcGlobal = path.join(clonePath, 'global');
        if (fs.existsSync(srcGlobal)) {
          copyDirSync(srcGlobal, dtRoot);
        }
      } else {
        // 从云端 projects/<id>/ 覆盖本地 .dt/
        const projectId = getProjectIdFromDtRoot(dtRoot);
        if (projectId) {
          const srcProject = path.join(clonePath, 'projects', projectId);
          if (fs.existsSync(srcProject)) {
            copyDirSync(srcProject, dtRoot);
          }
        }
      }
    }

    // 合并注册表
    const remoteRegistryPath = path.join(clonePath, 'registry.json');
    if (fs.existsSync(remoteRegistryPath)) {
      try {
        const remoteRegistry = JSON.parse(fs.readFileSync(remoteRegistryPath, 'utf-8'));
        const localRegistry = readRegistry();
        const merged = mergeRegistries(localRegistry, remoteRegistry);
        writeRegistry(merged);
      } catch {
        // ignore
      }
    }
  } catch {
    // 静默失败
  }
}

// ─────────────────────────────────────────────
// 云端项目列表 — dt remote list
// ─────────────────────────────────────────────

export interface CloudProject {
  id: string
  name: string                  // 来自注册表
  localPath?: string            // 本机路径（如果已注册）
  isLocal: boolean              // 本机是否已有
}

/**
 * 从 ~/.dt/remote/ 读取云端所有项目
 */
export function listCloudProjects(): CloudProject[] {
  const clonePath = getRemoteClonePath();
  const projectsDir = path.join(clonePath, 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  // 读云端注册表获取 name
  let remoteRegistry: { projects: ProjectEntry[] } = { projects: [] };
  const remoteRegistryPath = path.join(clonePath, 'registry.json');
  if (fs.existsSync(remoteRegistryPath)) {
    try {
      remoteRegistry = JSON.parse(fs.readFileSync(remoteRegistryPath, 'utf-8'));
    } catch {
      // ignore
    }
  }

  const localRegistry = readRegistry();
  const cloudIds = fs.readdirSync(projectsDir).filter(f =>
    fs.statSync(path.join(projectsDir, f)).isDirectory(),
  );

  return cloudIds.map(id => {
    const remoteEntry = remoteRegistry.projects.find(p => p.id === id);
    const localEntry = localRegistry.projects.find(p => p.id === id);
    return {
      id,
      name: remoteEntry?.name ?? localEntry?.name ?? id,
      localPath: localEntry?.path,
      isLocal: !!localEntry,
    };
  });
}

// ─────────────────────────────────────────────
// 下载项目 — dt remote clone
// ─────────────────────────────────────────────

/**
 * 从云端下载项目到本机并注册。
 * @param projectId  云端项目 id
 * @param localPath  本机目标路径（不传则用 ~/projects/<id>）
 * @returns 实际写入的本机路径
 */
export function cloneProjectFromRemote(projectId: string, localPath?: string): string {
  const clonePath = getRemoteClonePath();
  const srcProject = path.join(clonePath, 'projects', projectId);

  if (!fs.existsSync(srcProject)) {
    throw new Error(`云端不存在项目 "${projectId}"`);
  }

  const destDir = localPath
    ? path.resolve(localPath)
    : path.join(os.homedir(), 'projects', projectId);

  const destDt = path.join(destDir, '.dt');
  fs.mkdirSync(destDt, { recursive: true });
  copyDirSync(srcProject, destDt);

  return destDir;
}
