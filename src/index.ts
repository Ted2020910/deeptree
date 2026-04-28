#!/usr/bin/env node

/**
 * dt CLI — Decision Tree 命令行工具 (v2)
 *
 * 让任何 AI Agent 通过 bash 命令将思考过程外化为结构化的本地 Markdown 决策树。
 *
 * 核心命令（6 条）：
 *   看: dt tree / dt status / dt show <id>
 *   想: dt add <type> <title> / dt link <src> <tgt> <summary>
 *   写: dt update <id> --status/--title/--summary/--type
 *
 * 辅助命令：
 *   dt init <name>  — 初始化项目
 *   dt serve        — 启动前端可视化
 */

import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerTreeCommand } from './commands/tree.js';
import { registerStatusCommand } from './commands/status.js';
import { registerShowCommand } from './commands/show.js';
import { registerAddCommand } from './commands/add.js';
import { registerLinkCommand } from './commands/link.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerProjectCommands } from './commands/register.js';
import { registerServeCommand } from './commands/serve.js';

const program = new Command();

program
  .name('dt')
  .description(
    'Decision Tree CLI — 将决策过程外化为可追溯的本地 Markdown 决策图',
  )
  .version('0.2.0');

// 注册命令
registerInitCommand(program);
registerTreeCommand(program);
registerStatusCommand(program);
registerShowCommand(program);
registerAddCommand(program);
registerLinkCommand(program);
registerUpdateCommand(program);
registerServeCommand(program);
registerProjectCommands(program);

program.parse();
