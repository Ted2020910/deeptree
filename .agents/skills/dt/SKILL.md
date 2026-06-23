---
name: dt
description: Decision Tree project-memory workflow for repositories that contain a .dt/ directory or mention the $dt skill. Use before project decisions, architecture changes, feature work, protocol updates, or when inspecting or updating decision history with dt tree/status/show/add/link/update/scan/upgrade.
---

# DT

DT 是人机协作的决策过程外化工具。它把"为什么这样决定"记录下来，而不只是"改了什么"。

根据当前任务选择对应场景，场景文件在 `scenarios/` 目录下。

## 场景路由

| 场景 | 适用时机 | 详细协议 |
|------|----------|----------|
| **discussion** | 问题尚未明确，需要对齐理解、推导方案 | `scenarios/discussion.md` |
| **planning** | 有多个可行方案需要取舍，或需要拆解模块结构 | `scenarios/planning.md` |
| **implementation** | 需求已明确，进入拆解执行和状态追踪 | `scenarios/implementation.md` |

三个场景可以连接成一条链：**discussion → planning → implementation**，对应从"问题模糊"到"方案确定"再到"任务完成"。

## 开始

当前目录包含 `.dt/` 时，先运行：

```bash
dt tree
```

再根据当前任务性质，读取对应场景文件获取具体工作方式。

## 核心命令

- `dt tree`：查看全局结构
- `dt status`：查看项目概览
- `dt show <id>`：查看节点详情
- `dt add <type> "title" --root`：创建根节点
- `dt add <type> "title" --from <id>`：创建子节点
- `dt link <src> <tgt> "summary" --direction to`：连接已有节点
- `dt update <id> --status/--title/--summary/--type`：更新结构化字段
- `dt scan`：重建分布式节点索引
- `dt upgrade`：升级 CLI 并迁移项目到最新协议

DT 节点可以存在于项目任意位置，索引在 `.dt/index.yaml`，优先用命令操作，不要手动编辑索引。

## 节点类型参考

节点类型是自由字符串，推荐四种：`explore`、`task`、`document`、`decision`。
详见 `references/styles.md`。

## Agent Surface

For Codex, this project skill lives at `.agents/skills/dt/SKILL.md` and is referenced as `$dt` from `AGENTS.md`.

For Claude Code, the matching project skill lives at `.claude/skills/dt/SKILL.md` and is referenced from `CLAUDE.md`.

## Guardrails

- Do not use obsolete commands such as `dt check`.
- Do not treat DT as a replacement for Git; it records reasoning and task structure.

