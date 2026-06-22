/**
 * style.ts — dt style
 *
 * Reads reusable DT writing styles from the global dt skill.
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function getGlobalStylesPath(): string {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  return path.join(codexHome, 'skills', 'dt', 'references', 'styles.md');
}

export function registerStyleCommand(program: Command): void {
  program
    .command('style')
    .description('查看全局 DT 写作风格说明')
    .action(() => {
      const stylesPath = getGlobalStylesPath();

      if (!fs.existsSync(stylesPath)) {
        console.log(chalk.yellow('未找到全局 dt skill 写作风格。'));
        console.log(chalk.dim(`  期望路径: ${stylesPath}`));
        console.log(chalk.dim('  请安装或创建全局 $dt skill。'));
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
