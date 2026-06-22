/**
 * tree.ts — dt tree (v3)
 *
 * 以 root:true 节点为起点渲染树，支持多根并排。
 * 去掉对 config.root_node 的依赖。
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { requireDtRoot, readTreeConfig } from '../core/project.js';
import { listAllNodes } from '../core/node.js';
import { buildForest, renderForest } from '../utils/render.js';
import { gitCommitIfChanged } from '../core/git.js';
import { syncNodeIndex } from '../core/node-index.js';

export function registerTreeCommand(program: Command): void {
  program
    .command('tree')
    .description('展示决策树（支持多根）')
    .action(() => {
      const dtRoot = requireDtRoot();

      syncNodeIndex(dtRoot, { full: true });
      const humanChanges = gitCommitIfChanged(dtRoot);
      if (humanChanges) {
        console.log('');
        console.log(chalk.yellow(`⚡ 已自动保存 ${humanChanges.length} 处用户编辑:`));
        for (const f of humanChanges.slice(0, 5)) {
          console.log(chalk.yellow(`   - ${f}`));
        }
        if (humanChanges.length > 5) {
          console.log(chalk.yellow(`   ... 及其他 ${humanChanges.length - 5} 个文件`));
        }
      }

      const config = readTreeConfig(dtRoot);
      const nodes = listAllNodes();

      if (nodes.length === 0) {
        console.log(chalk.dim('(暂无节点。运行 `dt add goal "目标" --root` 创建根节点)'));
        return;
      }

      const forest = buildForest(nodes);
      const shownIds = new Set<string>();
      const collectShown = (tree: ReturnType<typeof buildForest>[number]): void => {
        shownIds.add(tree.id);
        for (const child of tree.children) collectShown(child);
      };
      for (const tree of forest) collectShown(tree);
      const detachedNodes = nodes.filter((node) => !shownIds.has(node.frontmatter.id));

      console.log('');
      console.log(chalk.bold(`🌳 ${config.project}`));
      console.log(chalk.dim('─'.repeat(60)));
      if (forest.length > 0) {
        console.log(renderForest(forest));
      } else {
        console.log(chalk.dim('(暂无根节点。运行 `dt add goal "目标" --root` 或 `dt update <id> --root true`)'));
      }
      if (detachedNodes.length > 0) {
        console.log('');
        console.log(chalk.yellow('未挂接节点 / 不在根树中的节点'));
        console.log(chalk.dim('─'.repeat(60)));
        for (const node of detachedNodes) {
          const fm = node.frontmatter;
          console.log(`${chalk.bold(fm.id)} ${chalk.cyan(`[${fm.type}]`)} ${fm.title}`);
          if (fm.summary) console.log(chalk.dim(`   ${fm.summary}`));
          if (node.path) console.log(chalk.dim(`   @ ${node.path}`));
        }
      }
      console.log('');
    });
}
