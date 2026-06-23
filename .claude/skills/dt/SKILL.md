---
name: dt
description: Decision Tree project-memory workflow for repositories that contain a .dt/ directory or mention the dt skill. Use before project decisions, architecture changes, feature work, protocol updates, or when inspecting or updating decision history with dt tree/status/show/add/link/update/scan/upgrade.
---

# DT

Use DT as the project's decision-process memory. It keeps "why we decided this" visible, not just "what changed".

## Start

When the current repository contains `.dt/`, run:

```bash
dt tree
```

If the tree is too broad for the task, use `dt status`, then inspect only the relevant node with `dt show <id>`.

## Workflow

1. Read the current decision context before making project-level choices.
2. Align the boundary of a new or ambiguous request in 1-2 sentences before implementation.
3. Work inside one relevant node at a time; do not expand several unresolved branches at once.
4. After a decision or task outcome, update the relevant node status or summary with `dt update`, and edit node Markdown directly when the reasoning body needs detail.

## Commands

- `dt tree`: show the global structure and distributed node paths.
- `dt status`: show project statistics and roots.
- `dt show <id>`: inspect a node's frontmatter and body.
- `dt add <type> "title" --root`: create a root node.
- `dt add <type> "title" --from <id>`: create a child node.
- `dt link <src> <tgt> "summary" --direction to`: connect existing nodes.
- `dt update <id> --status/--title/--summary/--type`: update structured fields.
- `dt scan`: rebuild the distributed Markdown node index.
- `dt upgrade`: upgrade the CLI checkout and migrate the current project to the latest DT protocol.

DT nodes may live anywhere in the project. The index is `.dt/index.yaml`; prefer DT commands over manual index edits.

## Agent Surface

For Codex, this project skill lives at `.agents/skills/dt/SKILL.md` and is referenced as `$dt` from `AGENTS.md`.

For Claude Code, the matching project skill lives at `.claude/skills/dt/SKILL.md` and is referenced from `CLAUDE.md`.

## Guardrails

- Do not use obsolete commands such as `dt check`.
- Do not treat DT as a replacement for Git; it records reasoning and task structure.
- Keep responses cognitively small when aligning with the user: no more than four key points in one reply.
