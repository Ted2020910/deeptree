/**
 * style.ts — dt style
 *
 * 列出所有 style-xxx 节点的写作风格说明。
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { listAllNodes, readNode } from '../core/node.js';
import { requireDtRoot } from '../core/project.js';

export function registerStyleCommand(program: Command): void {
  program
    .command('style')
    .description('查看预置的节点写作风格说明')
    .action(() => {
      requireDtRoot();

      const nodes = listAllNodes();
      const styleNodes = nodes
        .filter((n) => /^style-/.test(n.frontmatter.id))
        .sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));

      if (styleNodes.length === 0) {
        console.log(chalk.dim('(暂无 style-xxx 节点)'));
        return;
      }

      for (const node of styleNodes) {
        const fm = node.frontmatter;
        const full = readNode(fm.id);

        console.log('');
        console.log(chalk.bold.cyan(`[${fm.id}] ${fm.title ?? fm.id}`));
        if (fm.summary) console.log(chalk.dim(`  ${fm.summary}`));
        console.log(chalk.dim('─'.repeat(60)));
        console.log(full.content);
      }

      console.log('');
    });
}
