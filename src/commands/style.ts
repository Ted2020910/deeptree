/**
 * style.ts — dt style
 *
 * Reads reusable DT writing styles from the project dt skill.
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { findDtRoot } from '../core/project.js';

function getProjectStylesPaths(): string[] {
  const dtRoot = findDtRoot();
  const projectDir = dtRoot ? path.dirname(dtRoot) : process.cwd();
  return [
    path.join(projectDir, '.agents', 'skills', 'dt', 'references', 'styles.md'),
    path.join(projectDir, '.claude', 'skills', 'dt', 'references', 'styles.md'),
  ];
}

export function registerStyleCommand(program: Command): void {
  program
    .command('style')
    .description('查看项目级 DT 写作风格说明')
    .action(() => {
      const stylesPath = getProjectStylesPaths().find(p => fs.existsSync(p));

      if (!stylesPath) {
        console.log(chalk.yellow('未找到项目级 dt skill 写作风格。'));
        for (const expectedPath of getProjectStylesPaths()) {
          console.log(chalk.dim(`  期望路径: ${expectedPath}`));
        }
        console.log(chalk.dim('  请在项目级 dt skill 的 references/styles.md 中添加写作风格。'));
        return;
      }

      console.log('');
      console.log(chalk.bold.cyan('DT Writing Styles'));
      console.log(chalk.dim(`来源: ${stylesPath}`));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(fs.readFileSync(stylesPath, 'utf-8'));
      console.log('');
    });
}
