/**
 * init.ts — dt init (v3)
 *
 * dt init "<project-name>"
 *
 * 初始化后创建写作风格示例节点树，帮助模型理解四种节点类型的协作方式。
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import {
  createDtStructure,
  findDtRoot,
  writeTreeConfig,
} from '../core/project.js';
import { setupClaudeHook, appendClaudeMd } from '../core/hooks.js';
import { gitAutoCommit } from '../core/git.js';
import { registerProject, pathToId } from '../core/registry.js';
import { writeFrontmatterFile } from '../core/frontmatter.js';
import type { TreeConfig, NodeFrontmatter } from '../types/index.js';
import path from 'node:path';

// 写作风格节点的内容定义
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

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('初始化决策树项目')
    .argument('<name>', '项目名称')
    .action((name: string) => {
      // 检查是否已初始化
      const existing = findDtRoot();
      if (existing) {
        console.error(chalk.red(`✗ .dt/ 目录已存在: ${existing}`));
        process.exit(1);
      }

      // 创建目录结构
      const dtRoot = createDtStructure(process.cwd());

      // 创建 tree.yaml
      const config: TreeConfig = {
        project: name,
        created: new Date().toISOString(),
      };
      writeTreeConfig(dtRoot, config);

      // 创建写作风格示例节点
      const nodesDir = path.join(dtRoot, 'nodes');
      const now = new Date().toISOString();

      for (const node of STYLE_NODES) {
        const frontmatter: NodeFrontmatter = {
          id: node.id,
          root: false,
          title: node.title,
          summary: node.summary,
          type: node.type,
          status: 'completed',
          edges: node.id === 'style-001'
            ? [
                { target: 'style-002', type: 'to', summary: '探索型节点写作风格' },
                { target: 'style-003', type: 'to', summary: '任务型节点写作风格' },
                { target: 'style-004', type: 'to', summary: '资源记录型节点写作风格' },
                { target: 'style-005', type: 'to', summary: '决策型节点写作风格' },
              ]
            : [{ target: 'style-001', type: 'from', summary: '节点类型说明' }],
          created: now,
        };
        writeFrontmatterFile(
          path.join(nodesDir, `${node.id}.md`),
          frontmatter,
          node.content,
        );
      }

      // 设置 Claude Code Hook 和 CLAUDE.md
      try {
        setupClaudeHook(process.cwd());
        console.log(chalk.green('✓ Claude Code Hook 已配置'));
      } catch {
        console.log(chalk.dim('  (跳过 Hook 配置)'));
      }
      try {
        appendClaudeMd(process.cwd());
        console.log(chalk.green('✓ CLAUDE.md 已更新'));
      } catch {
        console.log(chalk.dim('  (跳过 CLAUDE.md 更新)'));
      }

      // 自动 git commit
      gitAutoCommit(dtRoot, `init: ${name}`);

      // 注册到全局项目列表
      try {
        const id = pathToId(process.cwd());
        registerProject({ id, name, path: process.cwd() });
        console.log(chalk.green(`✓ 已注册到全局项目列表 [${id}]`));
      } catch {
        console.log(chalk.dim('  (跳过项目注册)'));
      }

      console.log(chalk.green('✓ 决策树项目已初始化'));
      console.log('');
      console.log(`  项目: ${chalk.bold(name)}`);
      console.log(chalk.dim(`  已创建 5 个写作风格说明节点（运行 \`dt style\` 查看）`));
      console.log('');
    });
}
