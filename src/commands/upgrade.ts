/**
 * upgrade.ts — dt upgrade
 *
 * 两层升级：
 * 1. CLI 自身：从 GitHub 远程仓库拉取最新代码并重新构建
 * 2. 当前项目：更新轻量入口文件并刷新分布式节点索引
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { findDtRoot, getDtPaths } from '../core/project.js';
import { updateProjectEntryFiles } from '../core/hooks.js';
import { readFrontmatterFile } from '../core/frontmatter.js';
import { gitAutoCommit } from '../core/git.js';
import { syncNodeIndex } from '../core/node-index.js';
import type { NodeFrontmatter } from '../types/index.js';

const LEGACY_STYLE_NODE_IDS = [
  'style-001',
  'style-002',
  'style-003',
  'style-004',
  'style-005',
] as const;

const LEGACY_STYLE_TITLES = new Set([
  '不同类型节点的写作风格要求',
  'Explore 节点 — 深度推导与认知对齐',
  'Task 节点 — 明确任务与执行跟踪',
  'Document 节点 — 原始事实与资源记录',
  'Decision 节点 — 多选项对比与结论',
]);

/**
 * 定位 dt CLI 的项目根目录
 * 从当前文件位置向上查找包含 package.json 的目录
 */
function findCliRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  let dir = path.dirname(__filename);

  // 向上查找 package.json
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      // 验证确实是 dt-cli 的 package.json
      try {
        const pkg = JSON.parse(
          fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'),
        );
        if (pkg.name === 'dt-cli') {
          return dir;
        }
      } catch {
        // 继续向上查找
      }
    }
    dir = path.dirname(dir);
  }

  throw new Error('无法定位 dt CLI 安装目录');
}

/**
 * 读取指定目录下 package.json 的版本号
 */
function readVersion(dir: string): string {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return pkg.version ?? 'unknown';
}

function isLegacyStyleNode(filePath: string, expectedId: string): boolean {
  try {
    const { frontmatter } = readFrontmatterFile<NodeFrontmatter>(filePath);
    return (
      frontmatter.id === expectedId &&
      frontmatter.status === 'completed' &&
      LEGACY_STYLE_TITLES.has(frontmatter.title)
    );
  } catch {
    return false;
  }
}

function removeLegacyStyleNodes(dtRoot: string): number {
  const paths = getDtPaths(dtRoot);
  let removed = 0;

  for (const id of LEGACY_STYLE_NODE_IDS) {
    const nodePath = path.join(paths.nodes, `${id}.md`);
    if (!fs.existsSync(nodePath)) continue;
    if (!isLegacyStyleNode(nodePath, id)) continue;
    fs.unlinkSync(nodePath);
    removed += 1;
  }

  return removed;
}

/**
 * 升级项目入口文件和索引。
 */
function upgradeProject(dtRoot: string): void {
  const projectDir = path.dirname(dtRoot);

  console.log(chalk.dim('  更新 CLAUDE.md / AGENTS.md...'));
  updateProjectEntryFiles(projectDir);

  const removedStyles = removeLegacyStyleNodes(dtRoot);
  if (removedStyles > 0) {
    console.log(chalk.dim(`  清理旧项目内写作风格节点: ${removedStyles}`));
  }

  console.log(chalk.dim('  刷新 .dt/index.yaml...'));
  syncNodeIndex(dtRoot, { full: true });

  gitAutoCommit(dtRoot, 'upgrade: 更新项目入口与索引');
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('更新 dt CLI 及当前项目到最新版本')
    .action(() => {
      let cliRoot: string;
      try {
        cliRoot = findCliRoot();
      } catch (err: unknown) {
        console.error(chalk.red('✗ 无法定位 dt CLI 安装目录'));
        console.error(
          chalk.dim('  请确保 dt 是通过 git clone + npm link 安装的'),
        );
        process.exit(1);
      }

      // ─── Part 1: CLI 自身升级 ───────────────────────────────────
      console.log('');
      console.log(chalk.cyan('⬆ 正在更新 dt CLI...'));
      console.log(chalk.dim(`  安装目录: ${cliRoot}`));

      const oldVersion = readVersion(cliRoot);

      // git pull
      console.log(chalk.dim('  拉取最新代码...'));
      try {
        const pullOutput = execSync('git pull origin main', {
          cwd: cliRoot,
          stdio: 'pipe',
          encoding: 'utf-8',
        }).trim();

        if (pullOutput.includes('Already up to date')) {
          console.log(chalk.green(`✓ CLI 已是最新版本 (${oldVersion})`));
        } else {
          // npm install
          console.log(chalk.dim('  安装依赖...'));
          try {
            execSync('npm install', {
              cwd: cliRoot,
              stdio: 'pipe',
            });
          } catch (err: unknown) {
            console.error(chalk.red('✗ npm install 失败'));
            if (err instanceof Error && 'stderr' in err) {
              console.error(
                chalk.dim(`  ${(err as { stderr: string }).stderr}`),
              );
            }
            process.exit(1);
          }

          // npm run build
          console.log(chalk.dim('  编译构建...'));
          try {
            execSync('npm run build', {
              cwd: cliRoot,
              stdio: 'pipe',
            });
          } catch (err: unknown) {
            console.error(chalk.red('✗ 构建失败'));
            if (err instanceof Error && 'stderr' in err) {
              console.error(
                chalk.dim(`  ${(err as { stderr: string }).stderr}`),
              );
            }
            process.exit(1);
          }

          const newVersion = readVersion(cliRoot);
          if (oldVersion !== newVersion) {
            console.log(
              chalk.green(`✓ dt CLI 已更新: ${oldVersion} → ${newVersion}`),
            );
          } else {
            console.log(chalk.green(`✓ dt CLI 已更新 (${newVersion})`));
          }
        }
      } catch (err: unknown) {
        console.log(chalk.yellow('⚠ git pull 失败（跳过 CLI 更新）'));
        if (err instanceof Error && 'stderr' in err) {
          const stderr = (err as { stderr: string }).stderr.trim();
          if (stderr) {
            console.log(chalk.dim(`  ${stderr}`));
          }
        }
        console.log(chalk.dim('  请检查网络连接和 git 配置'));
      }

      // ─── Part 2: 项目内升级 ────────────────────────────────────
      const dtRoot = findDtRoot();
      if (dtRoot) {
        console.log('');
        console.log(chalk.cyan('⬆ 正在更新当前项目...'));
        try {
          upgradeProject(dtRoot);
          console.log(chalk.green('✓ 项目已更新到最新协议版本'));
        } catch (err: unknown) {
          console.error(
            chalk.red('✗ 项目更新失败:'),
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      console.log('');
    });
}
