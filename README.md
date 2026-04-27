# dt — Decision Tree CLI

> 人机协作的决策过程外化工具

dt 让 AI 和人类在同一棵决策树上思考。每个节点记录一个讨论单元的认知起点、推导逻辑和达成共识，所有内容本地化为 Markdown 文件，对人可读、对 AI 可操作、对 Git 可追溯。

---

## 为什么需要 dt

AI 的执行速度很快，但速度本身会放大偏差——方向错了跑得越快偏得越远。真正的瓶颈不是 AI 的能力，而是**人和 AI 的认知对齐**：

- AI 没有持久记忆，跨会话靠外部文件
- 人看不到 AI 的推导过程，只能看到结论
- 决策过程没有外化，回溯时无从追踪

dt 的解法：把决策过程变成一棵本地的有向图，每个节点是一个讨论单元，每条边是一个逻辑跳转。人和 AI 共享同一份结构。

---

## 安装

```bash
# 克隆后本地安装
git clone https://github.com/Ted2020910/deeptree.git
cd deeptree
pnpm install
pnpm build
npm link          # 全局注册 dt 命令
```

---

## 快速开始

```bash
# 在项目目录初始化决策树
dt init "项目名称"

# 查看当前状态
dt tree
dt status

# 添加一个目标节点
dt add goal "我们要解决什么问题"

# 拆解子问题
dt add subproblem "第一个子问题" --parent 001

# 添加跨分支关联
dt link 003 007 "两个子问题共享同一个约束"

# 更新节点状态
dt update 003 --status decided --summary "已确定方案 B"

# 查看节点详情
dt show 003
```

---

## 核心命令

| 动作 | 命令 | 说明 |
|------|------|------|
| 看 | `dt tree` | 全局结构，自动检测用户编辑 |
| 看 | `dt status` | 项目概览 |
| 看 | `dt show <id>` | 节点详情（frontmatter + 正文） |
| 想 | `dt add <type> "标题" --parent <id>` | 添加节点 |
| 想 | `dt add <type> "标题" --parent <id> --link <id> --link-summary "摘要"` | 添加节点并绑定跨分支关联 |
| 想 | `dt link <src> <tgt> "摘要"` | 建立已有节点之间的关联 |
| 写 | `dt update <id> --status/--title/--summary/--type` | 更新结构化字段 |

节点正文通过直接编辑 `.dt/nodes/xxx.md` 来更新，无需 CLI。

---

## 数据结构

每个节点是一个 Markdown 文件，存放在 `.dt/nodes/` 下：

```markdown
---
id: '003'
title: 人类真实的工作决策模式是什么
summary: 从第一性原理出发，先理解人如何做决策
type: subproblem
status: decided
parent: '002'
edges:
  - target: '007'
    direction: related
    summary: 人类决策模式是工作方式讨论的基础
---

## 已知前提
（来自其他节点或外部的既有共识、约束条件）

## 认知起点
（本节点讨论的具体出发点：这个问题是什么，边界在哪里）

## 推导逻辑
（分析过程、方案比较、权衡。记录"为什么"比"是什么"更有价值）

## 讨论共识
（达成的结论或决策。讨论进行中时可为空）
```

底层数据结构是**有向图（DAG）**，不是严格的树——节点之间可以有跨分支的 related 关联。

---

## Git 集成

dt 写操作后自动执行 `git add .dt/ && git commit`，对 AI Agent 完全透明。

- AI 操作后工作区始终是干净的
- 工作区出现 unstaged 变更 = 人类编辑
- `dt tree` / `dt status` 执行时自动检测并提示人类编辑

---

## 与 Claude Code 集成

`dt init` 会在项目根目录生成 `CLAUDE.md`，告知 Claude Code 如何使用 dt：会话开始时执行 `dt tree`，按照四层正文结构（已知前提 / 认知起点 / 推导逻辑 / 讨论共识）记录每个节点的讨论过程。

---

## 节点类型

预设类型（均可用自定义字符串替换）：

| 类型 | 用途 |
|------|------|
| `goal` | 目标或根问题 |
| `subproblem` | 子问题拆解 |
| `solution` | 方案 |
| `evaluation` | 方案评估 |
| `reflection` | 回顾与复盘 |

---

## License

MIT
