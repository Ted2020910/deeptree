/**
 * hooks.ts — project entry file integration
 *
 * Keep project prompts thin. Reusable DT rules live in the global dt skill.
 */

import fs from 'node:fs';
import path from 'node:path';

export const CLAUDE_MD_SECTION = `
## Decision Tree

This project uses DT for decision-process memory.

Before making project decisions, load the global \`$dt\` skill, then run:

\`\`\`bash
dt tree
\`\`\`

Use \`dt show <id>\` to inspect a node and its Markdown path. DT nodes may live anywhere in the project and are indexed by \`.dt/index.yaml\`.
`;

export const AGENTS_MD_SECTION = `
## Decision Tree

This project uses DT for decision-process memory.

Before making project decisions, use the global \`$dt\` skill, then run:

\`\`\`bash
dt tree
\`\`\`

Use \`dt show <id>\` to inspect a node and its Markdown path. DT nodes may live anywhere in the project and are indexed by \`.dt/index.yaml\`.
`;

/**
 * 设置 .claude/settings.json（简化版，不再添加 Hook）
 */
export function setupClaudeHook(projectDir: string): void {
  void projectDir;
}

/**
 * 追加项目入口文件中的 dt 说明
 */
function appendMarkdownSection(filePath: string, section: string): void {
  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf-8');
  }

  if (existing.includes('## Decision Tree')) {
    return;
  }

  const content = existing ? `${existing}\n${section}` : section;
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 更新入口文件中的 dt 段落（替换为最新版本）。
 */
function updateMarkdownSection(filePath: string, section: string): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, section, 'utf-8');
    return;
  }

  const existing = fs.readFileSync(filePath, 'utf-8');
  const heading = existing.includes('## Decision Tree 协议')
    ? '## Decision Tree 协议'
    : '## Decision Tree';

  if (!existing.includes(heading)) {
    fs.writeFileSync(filePath, existing + '\n' + section, 'utf-8');
    return;
  }

  const sectionStart = existing.indexOf(heading);
  const beforeSection = existing.slice(0, sectionStart);
  const afterStart = existing.slice(sectionStart);
  const nextHeadingMatch = afterStart.match(/\n## (?!Decision Tree)/);
  let afterSection = '';
  if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
    afterSection = afterStart.slice(nextHeadingMatch.index);
  }

  fs.writeFileSync(filePath, beforeSection + section + afterSection, 'utf-8');
}

export function appendClaudeMd(projectDir: string): void {
  appendMarkdownSection(path.join(projectDir, 'CLAUDE.md'), CLAUDE_MD_SECTION);
}

export function updateClaudeMd(projectDir: string): void {
  updateMarkdownSection(path.join(projectDir, 'CLAUDE.md'), CLAUDE_MD_SECTION);
}

export function appendAgentsMd(projectDir: string): void {
  appendMarkdownSection(path.join(projectDir, 'AGENTS.md'), AGENTS_MD_SECTION);
}

export function updateAgentsMd(projectDir: string): void {
  updateMarkdownSection(path.join(projectDir, 'AGENTS.md'), AGENTS_MD_SECTION);
}

export function appendProjectEntryFiles(projectDir: string): void {
  appendClaudeMd(projectDir);
  appendAgentsMd(projectDir);
}

export function updateProjectEntryFiles(projectDir: string): void {
  updateClaudeMd(projectDir);
  updateAgentsMd(projectDir);
}
