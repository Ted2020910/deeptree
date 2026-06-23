/**
 * hooks.ts — project entry file integration
 *
 * Keep project prompts thin. Reusable DT rules live in project dt skills.
 */

import fs from 'node:fs';
import path from 'node:path';

export const CLAUDE_MD_SECTION = `
## Decision Tree

This project uses DT for decision-process memory.

Before making project decisions, load the project \`dt\` skill at \`.claude/skills/dt/SKILL.md\`, then run:

\`\`\`bash
dt tree
\`\`\`

Use \`dt show <id>\` to inspect a node and its Markdown path. DT nodes may live anywhere in the project and are indexed by \`.dt/index.yaml\`.
`;

export const AGENTS_MD_SECTION = `
## Decision Tree

This project uses DT for decision-process memory.

Before making project decisions, use the project \`$dt\` skill at \`.agents/skills/dt/SKILL.md\`, then run:

\`\`\`bash
dt tree
\`\`\`

Use \`dt show <id>\` to inspect a node and its Markdown path. DT nodes may live anywhere in the project and are indexed by \`.dt/index.yaml\`.
`;

const DT_SKILL_BODY = `# DT

Use DT as the project's decision-process memory. It keeps "why we decided this" visible, not just "what changed".

## Start

When the current repository contains \`.dt/\`, run:

\`\`\`bash
dt tree
\`\`\`

If the tree is too broad for the task, use \`dt status\`, then inspect only the relevant node with \`dt show <id>\`.

## Workflow

1. Read the current decision context before making project-level choices.
2. Align the boundary of a new or ambiguous request in 1-2 sentences before implementation.
3. Work inside one relevant node at a time; do not expand several unresolved branches at once.
4. After a decision or task outcome, update the relevant node status or summary with \`dt update\`, and edit node Markdown directly when the reasoning body needs detail.

## Commands

- \`dt tree\`: show the global structure and distributed node paths.
- \`dt status\`: show project statistics and roots.
- \`dt show <id>\`: inspect a node's frontmatter and body.
- \`dt add <type> "title" --root\`: create a root node.
- \`dt add <type> "title" --from <id>\`: create a child node.
- \`dt link <src> <tgt> "summary" --direction to\`: connect existing nodes.
- \`dt update <id> --status/--title/--summary/--type\`: update structured fields.
- \`dt scan\`: rebuild the distributed Markdown node index.
- \`dt upgrade\`: upgrade the CLI checkout and migrate the current project to the latest DT protocol.

DT nodes may live anywhere in the project. The index is \`.dt/index.yaml\`; prefer DT commands over manual index edits.

## Agent Surface

For Codex, this project skill lives at \`.agents/skills/dt/SKILL.md\` and is referenced as \`$dt\` from \`AGENTS.md\`.

For Claude Code, the matching project skill lives at \`.claude/skills/dt/SKILL.md\` and is referenced from \`CLAUDE.md\`.

## Guardrails

- Do not use obsolete commands such as \`dt check\`.
- Do not treat DT as a replacement for Git; it records reasoning and task structure.
- Keep responses cognitively small when aligning with the user: no more than four key points in one reply.
`;

const CODEX_DT_SKILL = `---
name: dt
description: Decision Tree project-memory workflow for repositories that contain a .dt/ directory or mention the $dt skill. Use before project decisions, architecture changes, feature work, protocol updates, or when inspecting or updating decision history with dt tree/status/show/add/link/update/scan/upgrade.
---

${DT_SKILL_BODY}`;

const CLAUDE_DT_SKILL = `---
name: dt
description: Decision Tree project-memory workflow for repositories that contain a .dt/ directory or mention the dt skill. Use before project decisions, architecture changes, feature work, protocol updates, or when inspecting or updating decision history with dt tree/status/show/add/link/update/scan/upgrade.
---

${DT_SKILL_BODY}`;

const DT_STYLES_REFERENCE = `# DT Writing Styles

DT node types are free-form strings. These styles are recommendations, not schema limits.

## explore

Use for ambiguous questions, design reasoning, and cognitive alignment.

Suggested body:

- Known premises
- Cognitive starting point and boundary
- Reasoning path and tradeoffs
- Discussion consensus

## task

Use for concrete work that needs execution tracking.

Suggested body:

- Goal
- Scope
- Steps
- Verification
- Outcome

## document

Use for facts, source notes, raw material, and background records.

Keep inference separate from source facts. Prefer concise provenance and links or file paths.

## decision

Use when choosing between clear options.

Suggested body:

- Options considered
- Decision criteria
- Tradeoffs
- Final decision
- Follow-up implications
`;

const DT_AGENT_METADATA = `interface:
  display_name: "DT"
  short_description: "Use Decision Tree project memory"
  default_prompt: "Use the dt skill to inspect and update this project's decision tree before making project decisions."
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
  const normalizedSection = section.replace(/^\n+/, '');
  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf-8');
  }

  if (existing.includes('## Decision Tree')) {
    return;
  }

  const content = existing ? `${existing.trimEnd()}\n\n${normalizedSection}` : normalizedSection;
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 更新入口文件中的 dt 段落（替换为最新版本）。
 */
function updateMarkdownSection(filePath: string, section: string): void {
  const normalizedSection = section.replace(/^\n+/, '');
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, normalizedSection, 'utf-8');
    return;
  }

  const existing = fs.readFileSync(filePath, 'utf-8');
  const heading = existing.includes('## Decision Tree 协议')
    ? '## Decision Tree 协议'
    : '## Decision Tree';

  if (!existing.includes(heading)) {
    fs.writeFileSync(filePath, `${existing.trimEnd()}\n\n${normalizedSection}`, 'utf-8');
    return;
  }

  const sectionStart = existing.indexOf(heading);
  const beforeSection = existing.slice(0, sectionStart).trimEnd();
  const afterStart = existing.slice(sectionStart);
  const nextHeadingMatch = afterStart.match(/\n## (?!Decision Tree)/);
  let afterSection = '';
  if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
    afterSection = afterStart.slice(nextHeadingMatch.index).replace(/^\n+/, '\n\n');
  }

  fs.writeFileSync(
    filePath,
    `${beforeSection ? `${beforeSection}\n\n` : ''}${normalizedSection}${afterSection}`,
    'utf-8',
  );
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

function writeManagedFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const next = content.endsWith('\n') ? content : `${content}\n`;
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf-8') === next) {
    return;
  }
  fs.writeFileSync(filePath, next, 'utf-8');
}

function writeDtSkill(projectDir: string, rootDir: '.agents' | '.claude', skill: string): void {
  const skillDir = path.join(projectDir, rootDir, 'skills', 'dt');
  writeManagedFile(path.join(skillDir, 'SKILL.md'), skill);
  writeManagedFile(path.join(skillDir, 'references', 'styles.md'), DT_STYLES_REFERENCE);
  writeManagedFile(path.join(skillDir, 'agents', 'openai.yaml'), DT_AGENT_METADATA);
}

export function updateProjectSkillFiles(projectDir: string): void {
  writeDtSkill(projectDir, '.agents', CODEX_DT_SKILL);
  writeDtSkill(projectDir, '.claude', CLAUDE_DT_SKILL);
}
