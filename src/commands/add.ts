import { Command } from 'commander';
import chalk from 'chalk';
import { createNode, nodeExists, addEdge } from '../core/node.js';
import { requireDtRoot } from '../core/project.js';
import { gitAutoCommit, gitCommitIfChanged } from '../core/git.js';

export function registerAddCommand(program: Command): void {
  program
    .command('add')
    .description('添加节点')
    .argument('<type>', '节点类型（如 goal, subproblem, solution，或自定义）')
    .argument('<title>', '节点标题')
    .option('--parent <id>', '父节点 ID')
    .option('--summary <text>', '节点摘要')
    .option('--link <id>', '同时绑定跨分支关联的目标节点 ID')
    .option('--link-summary <text>', '关联边摘要（配合 --link 使用）', '')
    .action(
      (
        type: string,
        title: string,
        opts: { parent?: string; summary?: string; link?: string; linkSummary?: string },
      ) => {
        const dtRoot = requireDtRoot();

        // 先提交人类编辑
        gitCommitIfChanged(dtRoot);

        // 验证父节点
        if (opts.parent && !nodeExists(opts.parent)) {
          console.error(chalk.red(`✗ 父节点 ${opts.parent} 不存在`));
          process.exit(1);
        }

        // 验证关联节点
        if (opts.link && !nodeExists(opts.link)) {
          console.error(chalk.red(`✗ 关联节点 ${opts.link} 不存在`));
          process.exit(1);
        }

        const id = createNode({
          type,
          title,
          summary: opts.summary,
          parent: opts.parent ?? null,
        });

        // 绑定跨分支关联边
        if (opts.link) {
          const linkSummary = opts.linkSummary ?? '';
          addEdge(id, { target: opts.link, direction: 'related', summary: linkSummary });
          addEdge(opts.link, { target: id, direction: 'related', summary: linkSummary });
        }

        // 自动 git commit
        gitAutoCommit(dtRoot, `add ${type} ${id}: ${title}`);

        const parentInfo = opts.parent ? ` (parent: ${opts.parent})` : '';
        const linkInfo = opts.link ? `, linked: ${opts.link}` : '';
        console.log(
          chalk.green(
            `✓ 创建${type}节点 ${chalk.bold(id)}: ${title}${parentInfo}${linkInfo}`,
          ),
        );
      },
    );
}

