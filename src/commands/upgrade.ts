/**
 * upgrade.ts — dt upgrade
 *
 * 两层升级：
 * 1. CLI 自身：从 GitHub 远程仓库拉取最新代码并重新构建
 * 2. 当前项目：更新 CLAUDE.md 协议说明 + 写作风格示例节点
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { findDtRoot, getDtPaths } from '../core/project.js';
import { updateClaudeMd, CLAUDE_MD_SECTION } from '../core/hooks.js';
import { writeFrontmatterFile, readFrontmatterFile } from '../core/frontmatter.js';
import { gitAutoCommit } from '../core/git.js';
import type { NodeFrontmatter } from '../types/index.js';

// ─── 写作风格节点定义（与 init.ts 保持同步）─────────────────────
const STYLE_NODES: Array<{
  id: string;
  type: string;
  title: string;
  summary: string;
  content: string;
}> = [
  {
    id: 'style-001',
    type: 'explore',
    title: '不同类型节点的写作风格要求',
    summary: '根节点：介绍 dt 支持的四种推荐节点写作风格',
    content: `# 不同类型节点的写作风格要求

dt 的节点类型是自由字符串，没有硬性限制。以下四种是推荐的写作风格模式，每种对应不同的人机协作方式。子节点分别展示每种风格的具体结构。

使用时按实际需要选择类型，也可以完全自定义。`,
  },
  {
    id: 'style-002',
    type: 'explore',
    title: 'Explore 节点 — 深度推导与认知对齐',
    summary: '适合需要推导过程的探索性问题，使用四层结构记录人机对齐过程',
    content: `# Explore 节点 — 深度推导与认知对齐

## 已知前提
来自其他节点或外部的既有共识、约束条件、背景信息。
是进入本节点讨论的"行李"——不在本节点推导，直接引用。

## 认知起点
本节点讨论的具体出发点：这个问题/任务是什么，
为什么在这个节点讨论，讨论的边界在哪里。

## 推导逻辑
分析过程、方案比较、权衡、推导步骤。
记录"为什么这样决定"比"决定了什么"更有价值。
用户的关键修正要显式记录（如"用户指出..."）。

## 讨论共识
达成的结论或决策。讨论进行中时可为空，
讨论结束后更新此节，同时将节点 status 更新为 decided/completed。`,
  },
  {
    id: 'style-003',
    type: 'task',
    title: 'Task 节点 — 明确任务与执行跟踪',
    summary: '适合目标清晰、需要执行的任务，关注做什么和完成标准',
    content: `# Task 节点 — 明确任务与执行跟踪

Task 节点用于记录需要执行的具体任务。内容结构由任务本身决定，没有强制格式。

常见写法示例：

**任务描述**
用一两句话说清楚要做什么。

**完成标准**
什么情况下算完成？

**依赖 / 前置条件**
有哪些东西必须先准备好？

**执行记录**
过程中的关键决定或意外情况。

状态流转：pending → in_progress → completed`,
  },
  {
    id: 'style-004',
    type: 'document',
    title: 'Document 节点 — 原始事实与资源记录',
    summary: '用于记录不需要推导的原始事实、外部资料、背景信息',
    content: `# Document 节点 — 原始事实与资源记录

Document 节点只陈述事实，不做推导。内容来自外部资料、调研结果、既有约束等。

写作原则：
- 只写"是什么"，不写"为什么"或"怎么做"
- 来源明确时注明来源
- 内容保持原始性，推导分析放到 Explore 节点

典型用途：
- 记录用户访谈原始内容
- 存放技术文档摘录
- 保存市场数据或竞品信息
- 记录项目约束条件（时间、预算、技术栈）`,
  },
  {
    id: 'style-005',
    type: 'decision',
    title: 'Decision 节点 — 多选项对比与结论',
    summary: '适合需要在多个明确选项之间做出选择的决策场景',
    content: `# Decision 节点 — 多选项对比与结论

Decision 节点用于在已知选项之间做出选择。与 Explore 不同，这里问题已经收敛，核心工作是对比和选择。

常见写法示例：

**决策问题**
需要在什么之间做选择？

**选项**
- 选项 A：优点 / 缺点 / 适用条件
- 选项 B：优点 / 缺点 / 适用条件
- 选项 C：...

**评估标准**
用什么维度来判断哪个更好？

**结论**
选择了什么，理由是什么。

讨论结束后将 status 更新为 decided。`,
  },
];

// 旧版写作风格节点的标题列表（用于安全检测是否可以删除）
const OLD_STYLE_TITLES = STYLE_NODES.map((n) => n.title);

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

/**
 * 检查旧版节点（001-005）是否为写作风格节点
 */
function isOldStyleNode(filePath: string): boolean {
  try {
    const { frontmatter } = readFrontmatterFile<NodeFrontmatter>(filePath);
    return OLD_STYLE_TITLES.includes(frontmatter.title);
  } catch {
    return false;
  }
}

/**
 * 升级项目内的写作风格节点和 CLAUDE.md
 */
function upgradeProject(dtRoot: string): void {
  const projectDir = path.dirname(dtRoot);
  const paths = getDtPaths(dtRoot);
  const now = new Date().toISOString();

  // Step 1: 更新 CLAUDE.md
  console.log(chalk.dim('  更新 CLAUDE.md...'));
  updateClaudeMd(projectDir);

  // Step 2: 清理旧的写作风格节点（001-005，仅在它们确实是风格节点时删除）
  const oldIds = ['001', '002', '003', '004', '005'];
  let cleanedOld = false;
  for (const oldId of oldIds) {
    const oldPath = path.join(paths.nodes, `${oldId}.md`);
    if (fs.existsSync(oldPath) && isOldStyleNode(oldPath)) {
      fs.unlinkSync(oldPath);
      cleanedOld = true;
    }
  }
  if (cleanedOld) {
    console.log(chalk.dim('  清理旧节点 (001~005)...'));
  }

  // Step 3: 删除旧的 style- 节点（如果存在）
  for (const node of STYLE_NODES) {
    const oldStylePath = path.join(paths.nodes, `${node.id}.md`);
    if (fs.existsSync(oldStylePath)) {
      fs.unlinkSync(oldStylePath);
    }
  }

  // Step 4: 写入最新的写作风格节点
  console.log(chalk.dim('  更新写作风格节点 (style-001 ~ style-005)...'));
  for (const node of STYLE_NODES) {
    const frontmatter: NodeFrontmatter = {
      id: node.id,
      root: false,
      title: node.title,
      summary: node.summary,
      type: node.type,
      status: 'completed',
      edges:
        node.id === 'style-001'
          ? [
              { target: 'style-002', type: 'to', summary: '探索型节点写作风格' },
              { target: 'style-003', type: 'to', summary: '任务型节点写作风格' },
              {
                target: 'style-004',
                type: 'to',
                summary: '资源记录型节点写作风格',
              },
              { target: 'style-005', type: 'to', summary: '决策型节点写作风格' },
            ]
          : [{ target: 'style-001', type: 'from', summary: '节点类型说明' }],
      created: now,
    };
    writeFrontmatterFile(
      path.join(paths.nodes, `${node.id}.md`),
      frontmatter,
      node.content,
    );
  }

  // Step 5: git auto commit
  gitAutoCommit(dtRoot, 'upgrade: 更新协议与写作风格节点');
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
        console.error(chalk.red('✗ git pull 失败'));
        if (err instanceof Error && 'stderr' in err) {
          console.error(chalk.dim(`  ${(err as { stderr: string }).stderr}`));
        }
        console.error(chalk.dim('  请检查网络连接和 git 配置'));
        process.exit(1);
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
