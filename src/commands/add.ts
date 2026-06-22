import { Command } from 'commander';
import chalk from 'chalk';
import { createNode, nodeExistsByRef } from '../core/node.js';
import { requireDtRoot } from '../core/project.js';
import { gitAutoCommit, gitCommitIfChanged } from '../core/git.js';

export function registerAddCommand(program: Command): void {
  program
    .command('add')
    .description('添加节点')
    .argument('<type>', '节点类型（如 goal, subproblem, solution，或自定义）')
    .argument('<title>', '节点标题')
    .option('--from <id>', '父节点 ID（可多次使用，支持跨项目 projectId::nodeId）', collect, [])
    .option('--from-summary <text>', '最后一条 --from 边的摘要（可多次）', collect, [])
    .option('--from-depth <n>', '跨项目 from 边的拉取深度（可多次）', collectInt, [])
    .option('--summary <text>', '节点自身摘要')
    .option('--root', '标记为根节点')
    .option('--path <path>', '节点 Markdown 文件路径（相对项目根目录；不传则写入 .dt/nodes/<id>.md）')
    .option('--directory <dir>', '节点 Markdown 所在目录（相对项目根目录；与 --filename 搭配使用）')
    .option('--filename <name>', '节点 Markdown 文件名（默认 <id>.md；仅在 --directory 生效时使用）')
    .action(
      (
        type: string,
        title: string,
        opts: {
          from: string[];
          fromSummary: string[];
          fromDepth: number[];
          summary?: string;
          root?: boolean;
          path?: string;
          directory?: string;
          filename?: string;
        },
      ) => {
        const dtRoot = requireDtRoot();
        gitCommitIfChanged(dtRoot);

        // 验证所有 from 节点存在（跨项目会同时验证注册表和可达性）
        for (const fromId of opts.from) {
          if (!nodeExistsByRef(fromId)) {
            console.error(chalk.red(`✗ 父节点 ${fromId} 不存在`));
            process.exit(1);
          }
        }

        const id = createNode({
          type,
          title,
          summary: opts.summary,
          froms: opts.from,
          fromSummaries: opts.fromSummary,
          fromDepths: opts.fromDepth,
          root: opts.root ?? false,
          path: opts.path,
          directory: opts.directory,
          filename: opts.filename,
          dtRoot,
        });

        gitAutoCommit(dtRoot, `add ${type} ${id}: ${title}`);

        const fromInfo = opts.from.length > 0
          ? ` (from: ${opts.from.join(', ')})`
          : opts.root ? ' (root)' : '';
        const pathInfo = opts.path
          ? chalk.dim(`\n  路径: ${opts.path}`)
          : opts.directory
            ? chalk.dim(`\n  目录: ${opts.directory}`)
            : '';
        console.log(chalk.green(`✓ 创建${type}节点 ${chalk.bold(id)}: ${title}${fromInfo}`) + pathInfo);
      },
    );
}

/** commander collect helper：将多次 --option 收集为数组 */
function collect(val: string, arr: string[]): string[] {
  arr.push(val);
  return arr;
}

function collectInt(val: string, arr: number[]): number[] {
  arr.push(parseInt(val, 10));
  return arr;
}
