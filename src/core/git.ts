/**
 * git.ts — Git 自动操作（对 Agent 透明）
 *
 * dt CLI 的每次写操作后自动 git commit，
 * Agent 不需要知道 git 的存在。
 */

import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * 检查是否在 git 仓库中
 */
export function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: dir,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取 .dt/ 所在的项目根目录
 */
function getProjectDir(dtRoot: string): string {
  return path.dirname(dtRoot);
}

/**
 * dt 写操作后自动 commit
 * 静默处理：非 git 仓库或无变更时不报错
 */
export function gitAutoCommit(dtRoot: string, message: string): void {
  const projectDir = getProjectDir(dtRoot);
  if (!isGitRepo(projectDir)) return;

  try {
    // 先 add .dt/ 目录
    execSync('git add .dt/', {
      cwd: projectDir,
      stdio: 'pipe',
    });

    // 检查是否有 staged changes
    try {
      execSync('git diff --cached --quiet .dt/', {
        cwd: projectDir,
        stdio: 'pipe',
      });
      // 没有变更，静默返回
      return;
    } catch {
      // 有变更，继续 commit
    }

    execSync(`git commit -m "dt: ${message}"`, {
      cwd: projectDir,
      stdio: 'pipe',
    });
  } catch {
    // 静默处理任何 git 错误
  }
}

/**
 * 检测 .dt/ 下未提交的变更（= 人类编辑）
 * @returns 变更文件列表，无变更返回 null
 */
export function gitDetectChanges(dtRoot: string): string[] | null {
  const projectDir = getProjectDir(dtRoot);
  if (!isGitRepo(projectDir)) return null;

  try {
    const output = execSync('git diff --name-only .dt/', {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();

    // 也检查 untracked 文件
    const untracked = execSync('git ls-files --others --exclude-standard .dt/', {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();

    const files = [
      ...output.split('\n').filter(Boolean),
      ...untracked.split('\n').filter(Boolean),
    ];

    return files.length > 0 ? files : null;
  } catch {
    return null;
  }
}

/**
 * 如果有未提交的 .dt/ 变更，自动 commit 为 "dt: user edit"
 * @returns 是否有变更被提交
 */
export function gitCommitIfChanged(dtRoot: string): string[] | null {
  const changes = gitDetectChanges(dtRoot);
  if (!changes) return null;

  const projectDir = getProjectDir(dtRoot);
  try {
    execSync('git add .dt/', {
      cwd: projectDir,
      stdio: 'pipe',
    });
    execSync('git commit -m "dt: user edit"', {
      cwd: projectDir,
      stdio: 'pipe',
    });
  } catch {
    // 静默处理
  }

  return changes;
}
