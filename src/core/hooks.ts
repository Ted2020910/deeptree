/**
 * hooks.ts — Claude Code CLAUDE.md 自动配置 (v3)
 *
 * dt init 时自动配置 CLAUDE.md，告知 Agent 如何使用 dt。
 * 不再需要 PostToolUse Hook（变更检查已嵌入 dt tree/status）。
 */

import fs from 'node:fs';
import path from 'node:path';

export const CLAUDE_MD_SECTION = `
## Decision Tree 协议

dt 是人机协作的决策过程外化工具。目的是让人和 AI 的认知对齐、让决策过程可见可追溯、让人在关键时刻保持判断力。

如果当前目录存在 \`.dt/\` 项目，在会话开始时先执行 \`dt tree\` 了解当前状态。 \`dt style\` 查看当前预置的节点的写作风格，真正宝贵的是人在决策时的判断和思考过程，而不是最终的决策结果，希望dt tree能够让ai了解直观的这个信息。

### 核心命令

| 动作 | 命令 | 说明 |
|------|------|------|
| 看 | \`dt tree\` | 全局结构（自动检测用户编辑），多根并排，每节点显示 summary |
| 看 | \`dt status\` | 项目概览（节点统计、根节点列表） |
| 看 | \`dt show <id>\` | 节点详情（frontmatter + 正文） |
| 看 | \`dt style\` | 查看项目预置的写作风格说明节点 |
| 想 | \`dt add <type> "标题" --from <id>\` | 添加节点，指定父节点 |
| 想 | \`dt add <type> "标题" --from <id> --from <id2>\` | 添加多父节点（可多次 \`--from\`） |
| 想 | \`dt add <type> "标题" --root\` | 添加根节点 |
| 想 | \`dt link <src> <tgt> "摘要" --direction from|to\` | 在已有节点之间添加边（自动补反向边） |
| 想 | \`dt link <src> "proj::id" "摘要" --depth 2\` | 跨项目引用（项目未注册则报错） |
| 写 | \`dt update <id> --status/--title/--summary/--type\` | 更新结构化字段 |
| 写 | \`dt update <id> --root true|false\` | 设置根节点标记 |

### 节点类型

节点类型是自由字符串，无硬性限制。项目中预置了四种推荐写作风格的说明节点，可通过 \`dt style\` 查看，了解每种类型适合的协作方式后自由使用。

这四种只是预设的节点类型，你完全可以根据实际需求创造新的写作风格或节点类型。

推荐的四种风格类型：
- \`explore\` — 深度推导，使用四层结构（已知前提 / 认知起点 / 推导逻辑 / 讨论共识）
- \`task\` — 明确任务与执行跟踪
- \`document\` — 原始事实与资源记录，只陈述不推导
- \`decision\` — 多选项对比与结论

### 工作方式

**看**：用 \`dt tree/status/show\` 了解结构概览。需要深入时直接 Read \`.dt/nodes/xxx.md\`。

**想**：用 \`dt add <type> "标题"\` 添加节点，类型是自由字符串。
- 非根节点必须带 \`--from <id>\`，孤立节点失去上下文
- 支持多父：\`--from <id1> --from <id2>\`，系统自动在父节点补反向 \`to\` 边
- 跨项目引用格式：\`projectId::nodeId\`，项目须先 \`dt register <path>\` 注册，否则报错
- 用 \`dt link\` 在已有节点之间补充边，\`--direction to\` 表示 src 指向 tgt（src 是父），\`--direction from\` 表示 tgt 指向 src（tgt 是父）

**写**：结构化字段（状态/标题/摘要/类型/root）用 \`dt update\`。节点正文直接 Edit \`.dt/nodes/xxx.md\`，内容完全自由，无预设模板。

### 节点正文结构

节点正文内容完全自由，无预设模板。不同类型节点有不同的推荐写作风格，通过 \`dt style\` 查看项目自带的写作风格说明节点即可了解。

**节点 frontmatter** 字段说明：

| 字段 | 说明 |
|------|------|
| \`id\` | 节点唯一标识 |
| \`root\` | \`true\` = 根节点，作为 \`dt tree\` 的起始点，支持多根 |
| \`title\` | 节点标题 |
| \`summary\` | 一句话摘要，用于 \`dt tree\` 快速扫描，讨论完成后更新 |
| \`type\` | 节点类型（自由字符串，推荐：explore / task / document / decision） |
| \`status\` | pending / in_progress / decided / completed / rejected |
| \`edges\` | 关联边列表，\`type: from\` = 来自父节点，\`type: to\` = 指向子节点 |

**边的双向性**：系统自动维护反向边，写入 \`from\` 边时目标节点自动补 \`to\` 边，无需手动维护两侧。

**Git 操作由 dt CLI 自动处理，无需手动 commit。**
用户编辑的变更会在下次执行 \`dt tree\` 或 \`dt status\` 时自动检测并提示。
`;


/**
 * 设置 .claude/settings.json（简化版，不再添加 Hook）
 */
export function setupClaudeHook(projectDir: string): void {
  // v3: 不再需要 PostToolUse Hook
  // 变更检查已嵌入 dt tree / dt status
}

/**
 * 追加 CLAUDE.md 中的 dt 协议说明
 */
export function appendClaudeMd(projectDir: string): void {
  const claudeMdPath = path.join(projectDir, 'CLAUDE.md');

  let existing = '';
  if (fs.existsSync(claudeMdPath)) {
    existing = fs.readFileSync(claudeMdPath, 'utf-8');
  }

  // 检查是否已有 dt 协议
  if (existing.includes('Decision Tree 协议')) {
    return; // 已经配置过了
  }

  const content = existing + '\n' + CLAUDE_MD_SECTION;
  fs.writeFileSync(claudeMdPath, content, 'utf-8');
}

/**
 * 更新 CLAUDE.md 中的 dt 协议段落（替换为最新版本）
 * 如果不存在则追加。
 */
export function updateClaudeMd(projectDir: string): void {
  const claudeMdPath = path.join(projectDir, 'CLAUDE.md');

  if (!fs.existsSync(claudeMdPath)) {
    // 不存在则直接写入
    fs.writeFileSync(claudeMdPath, CLAUDE_MD_SECTION, 'utf-8');
    return;
  }

  const existing = fs.readFileSync(claudeMdPath, 'utf-8');

  if (!existing.includes('Decision Tree 协议')) {
    // 没有旧段落，直接追加
    fs.writeFileSync(claudeMdPath, existing + '\n' + CLAUDE_MD_SECTION, 'utf-8');
    return;
  }

  // 找到 "## Decision Tree 协议" 开始位置，替换到文件末尾或下一个同级 ## 标题
  const sectionStart = existing.indexOf('## Decision Tree 协议');
  const beforeSection = existing.slice(0, sectionStart);

  // 查找段落结束：下一个 "\n## " 标题（同级标题）或文件末尾
  const afterStart = existing.slice(sectionStart);
  // 跳过当前标题行，查找下一个 ## 开头的行
  const nextHeadingMatch = afterStart.match(/\n## (?!Decision Tree)/);
  let afterSection = '';
  if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
    afterSection = afterStart.slice(nextHeadingMatch.index);
  }

  const updated = beforeSection + CLAUDE_MD_SECTION + afterSection;
  fs.writeFileSync(claudeMdPath, updated, 'utf-8');
}
