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

DT 是人机协作的决策过程外化工具。它把"为什么这样决定"记录下来，而不只是"改了什么"。

根据当前任务选择对应场景，场景文件在 \`scenarios/\` 目录下。

## 场景路由

| 场景 | 适用时机 | 详细协议 |
|------|----------|----------|
| **discussion** | 问题尚未明确，需要对齐理解、推导方案 | \`scenarios/discussion.md\` |
| **planning** | 有多个可行方案需要取舍，或需要拆解模块结构 | \`scenarios/planning.md\` |
| **implementation** | 需求已明确，进入拆解执行和状态追踪 | \`scenarios/implementation.md\` |

三个场景可以连接成一条链：**discussion → planning → implementation**，对应从"问题模糊"到"方案确定"再到"任务完成"。

## 开始

当前目录包含 \`.dt/\` 时，先运行：

\`\`\`bash
dt tree
\`\`\`

再根据当前任务性质，读取对应场景文件获取具体工作方式。

## 核心命令

- \`dt tree\`：查看全局结构
- \`dt status\`：查看项目概览
- \`dt show <id>\`：查看节点详情
- \`dt add <type> "title" --root\`：创建根节点
- \`dt add <type> "title" --from <id>\`：创建子节点
- \`dt link <src> <tgt> "summary" --direction to\`：连接已有节点
- \`dt update <id> --status/--title/--summary/--type\`：更新结构化字段
- \`dt scan\`：重建分布式节点索引
- \`dt upgrade\`：升级 CLI 并迁移项目到最新协议

DT 节点可以存在于项目任意位置，索引在 \`.dt/index.yaml\`，优先用命令操作，不要手动编辑索引。

## 节点类型参考

节点类型是自由字符串，推荐四种：\`explore\`、\`task\`、\`document\`、\`decision\`。
详见 \`references/styles.md\`。

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

const DT_SCENARIO_DISCUSSION = `# DT 场景：协作讨论与决策推导

**适用时机：** 问题尚未明确、需要和用户对齐理解、推导方案、做出决策时。

---

## 对齐原则

**为什么对齐是第一优先级：**

人与人之间的对齐可以通过多种模态完成——表情、语气、肢体语言、沉默、犹豫——这些信号同时在传递"我没想清楚"或"我不同意但说不出为什么"。对齐是多通道并行发生的。

但人与 AI 之间只有语言这一个通道。语言天然有歧义，有上下文依赖，有隐含假设。而 AI 不会皱眉、不会犹豫——它会自信地沿着错误的理解一路推导下去，直到产出一个"看起来正确但根基歪了"的结论。

因此，人-AI 协作的核心瓶颈不是 AI 的能力，而是**对齐的精度**。每一个关键词、每一个判断前提，都需要人和 AI 确认看到的是同一个东西，然后才能往下推。

**AI 必须遵循的对齐方式：**

1. **逐词对齐，不假设理解。** 遇到用户提出的关键概念、需求描述、判断标准时，不要默认自己理解了。主动复述你的理解，请用户确认或修正。一个词的歧义可能让整棵决策树长歪。

2. **先对齐边界，再拆解问题。** 在分析问题之前，先明确：这个问题讨论什么、不讨论什么、到什么程度算"完成"。边界不清就开始推导，等于在流沙上盖楼。

3. **暴露推导过程，不只给结论。** 把你的推理链条展示出来——你基于什么前提、做了什么假设、排除了什么选项。用户需要看到的是"你怎么想的"，才能判断对齐是否正确。结论对了但推理歪了，下一步就会出错。

4. **主动标记不确定性。** 当你对用户的意图、某个概念的边界、某个技术选择的取舍有不确定时，显式说出来并提问，而不是选一个"最可能的"理解默默往下跑。沉默的假设是对齐的最大敌人。

**这些原则直接体现在节点正文结构中：**
- 「已知前提」= 对齐的起点，确认双方共识
- 「认知起点」= 对齐边界，为什么在这里讨论
- 「推导逻辑」= 暴露推理过程，让用户能审计
- 「讨论共识」= 对齐的产物，而非 AI 单方面的结论

---

## 节奏原则

**为什么需要节奏控制：**

对齐精度解决的是"看到的是不是同一个东西"，节奏控制解决的是"什么时候看哪个东西"。AI 天然倾向于一次性把所有问题展开、所有方案铺开、所有实现做完——因为它没有疲劳感，处理 10 个分支和 1 个分支对它来说没差别。但人类不是这样：同时处理多个未对齐的分支，等于每个分支都没真正对齐。结果是 AI 自信地推完了一整棵树，人类才发现树根就歪了，回退成本极高。

节奏控制的本质是：**用慢换准。宁可多轮短交互，不要一轮做完然后返工。**

**AI 必须遵循的节奏：**

1. **架构先行，实现在后。** 拿到一个新需求时，第一步不是动手实现，而是先在 dt 里建出树的骨架——根节点 + 关键子节点。dt 树本身就是"思路架构"的具象化。骨架经用户认可后，才进入某个叶子节点的推导或实现。跳过骨架直接实现 = 在没有地图的情况下开车。

2. **逐节点推进，不并行展开。** 一次只深入一个节点。当前节点没有达成共识（\`decided\` / \`completed\`）之前，不要主动展开兄弟节点或更深层节点。并行展开会让用户同时维护多个未完成的上下文，实际上一个都做不好。

---

## 认知负荷控制

**为什么要限制单次信息量：**

AI 一次性给出 8 个要点要求用户确认时，用户的真实反应不是"逐个审视"，而是"粗略点头"——因为同时评估 8 个未对齐的点超出人类工作记忆容量。粗略点头看起来是对齐了，实际上只是放弃了对齐。AI 把信息抛得越多，得到的反馈质量越低，后续推导的根基越虚。

少量、聚焦的信息才能换来高质量的确认。**对齐的吞吐量上限不在 AI，而在人类的认知带宽。**

**AI 必须遵循的输出约束：**

1. **一条回复的要点总数 ≤ 4。** 这里的"要点"包括陈述、提问、选项的总和，不是只数提问数。判断标准是：用户读完这条回复需要在脑子里同时持有几个信息单元。

2. **超出 4 个时必须向上抽象，不要硬塞。** 把多个具体细节合并成更高层的概念点，先在抽象层达成共识，下一轮再把其中某一点拆开下钻。讨论的"广度"和"深度"要分层推进，不要既铺广度又下深度。

3. **抽象由 AI 主动完成，不要把球甩给用户。** 不要写"以下是 8 个待确认项，请告诉我哪些重要"——这是把认知负荷转嫁给用户。AI 自己判断哪些可以合并、哪些可以暂缓，主动给出 ≤4 个的版本。

---

## 推荐节点类型

在讨论场景下优先使用：

- **\`explore\`** — 深度推导，使用四层结构（已知前提 / 认知起点 / 推导逻辑 / 讨论共识）
- **\`decision\`** — 多选项对比与结论，包含选项、评估标准、权衡、最终决定

## DT 工作流

\`\`\`
1. dt tree          → 了解当前讨论全局结构
2. dt add explore "问题标题" --root   → 建立讨论根节点
3. dt add explore "子问题" --from <id> → 逐步拆解，对齐后再下一层
4. Edit .dt/nodes/xxx.md              → 填写四层正文（已知前提/认知起点/推导逻辑/讨论共识）
5. dt update <id> --status decided    → 当前节点达成共识后更新状态
6. 进入下一个子节点
\`\`\`

## 节点正文模板（explore 类型）

\`\`\`markdown
## 已知前提
来自其他节点或外部的既有共识、约束条件、背景信息。
是进入本节点讨论的"行李"——不在本节点推导，直接引用。

## 认知起点
本节点讨论的具体出发点：这个问题/任务是什么，
为什么在这个节点讨论，讨论的边界在哪里。

## 推导逻辑
分析过程、方案比较、权衡、推导步骤。
记录"为什么这样决定"比"决定了什么"更有价值。
用户的关键修正要显式记录（如"用户指出..."）。

## 讨论共识
达成的结论或决策。讨论进行中时可为空，
讨论结束后更新此节，同时将节点 status 更新为 decided/completed。
\`\`\`
`;

const DT_SCENARIO_IMPLEMENTATION = `# DT 场景：任务规划与执行跟踪

**适用时机：** 需求已明确，进入实际拆解与执行阶段。关注的是"做什么"与"做了没有"，而非"为什么"。

---

## 核心原则

**任务节点的价值在于可追踪，而非推导。** 这个场景下 AI 不需要和用户反复对齐理解——需求已经清晰，重点是把工作拆解成可执行的粒度，执行过程中随时更新状态，完成后记录结果和遗留问题。

**AI 必须遵循：**

1. **先建骨架，再动手。** 用 \`dt add task\` 把任务树建出来，让用户确认拆解粒度是否合适，然后才开始执行第一个叶子任务。
2. **每完成一个节点立刻更新状态。** 不要等全部完成后再统一更新。\`dt update <id> --status completed\` 是每个任务节点的收尾动作。
3. **遇到阻塞要在节点里记录，不要跳过。** 任务被阻塞时，\`dt update <id> --status in_progress\`，在节点正文里写明阻塞原因和下一步行动，而不是沉默地切到下一个任务。

---

## 推荐节点类型

- **\`task\`** — 明确任务与执行跟踪，有具体产出和验收标准
- **\`document\`** — 记录原始约束、需求来源、参考资料（不推导，只陈述）

---

## DT 工作流

\`\`\`
1. dt tree                              → 了解现有任务结构
2. dt add task "功能模块" --root         → 建立任务根节点
3. dt add task "子任务" --from <id>      → 拆解子任务，粒度以半天内可完成为宜
4. 用户确认任务树骨架
5. dt update <id> --status in_progress  → 开始执行时更新状态
6. 执行，完成后更新节点正文 Outcome 部分
7. dt update <id> --status completed    → 完成后标记
8. 进入下一个 pending 节点
\`\`\`

---

## 节点正文模板（task 类型）

\`\`\`markdown
## 目标
本任务要达到的具体结果，一句话描述。

## 范围
包括什么，不包括什么。

## 步骤
- [ ] 步骤 1
- [ ] 步骤 2
- [ ] 步骤 3

## 验收标准
如何判断这个任务完成了。

## 结果
（完成后填写）实际产出、遇到的问题、与预期的差异。
\`\`\`

---

## 状态流转

\`\`\`
pending → in_progress → completed
                     → rejected（任务取消或不做）
\`\`\`

执行中遇到阻塞时，保持 \`in_progress\`，在节点正文里补充阻塞说明。
`;

const DT_SCENARIO_PLANNING = `# DT 场景：架构规划与方案评估

**适用时机：** 面对多个可行方案需要做取舍，或需要把一个大方向拆解成可执行的模块结构时。介于"讨论"（问题尚未明确）与"执行"（方案已定）之间。

---

## 核心原则

**架构规划的本质是约束驱动的取舍，而不是方案枚举。** 列出方案很容易，难的是在约束条件下找到"足够好"的那一个，并记录清楚"为什么不选其他的"。dt 在这个场景的价值是：把选择过程显式化，而不只是记录结论。

**AI 必须遵循：**

1. **先记录约束，再枚举方案。** 在评估任何方案之前，用 \`document\` 节点把已知约束（技术限制、时间、团队能力、兼容性要求）固定下来。约束是所有方案评估的判断基准。
2. **每个方案单独成节点，不要混在一起比较。** 每个候选方案有独立的 \`decision\` 节点，方便后续回溯"为什么放弃了方案 B"。
3. **结论节点要记录排除理由，不只记录选择。** 最终决策节点不只写"我们选了 X"，还要写"排除 Y 的原因是 Z"。排除理由往往比选择理由更有价值。

---

## 推荐节点类型

- **\`decision\`** — 核心评估节点，多选项对比，含最终选择与排除理由
- **\`document\`** — 记录约束条件、背景资料、参考案例（不推导）
- **\`explore\`** — 当某个方案内部还有不确定性，需要进一步推导时使用

---

## DT 工作流

\`\`\`
1. dt tree                                → 了解已有架构决策
2. dt add document "约束条件" --root       → 记录不可违反的约束
3. dt add decision "方案评估：XXX" --from <约束节点id>  → 创建评估节点
4. 在节点正文列出候选方案及评估维度
5. dt add explore "方案B的不确定性" --from <决策节点id>  → 如某方案需要深入推导
6. 对齐后回到决策节点，更新最终选择
7. dt update <id> --status decided        → 标记决策完成
8. dt add task "实施计划" --from <决策节点id>  → 决策后接入执行场景
\`\`\`

---

## 节点正文模板（decision 类型）

\`\`\`markdown
## 评估背景
要解决的问题是什么，为什么现在做这个决策。

## 约束条件
（引用 document 节点，或直接列出本决策的硬约束）

## 候选方案

### 方案 A：名称
- 做法：
- 优点：
- 缺点：
- 适用前提：

### 方案 B：名称
- 做法：
- 优点：
- 缺点：
- 适用前提：

## 评估维度
判断方案优劣的标准（按重要性排序）。

## 最终决策
选择方案 X，原因是……

排除方案 Y，因为……
排除方案 Z，因为……

## 后续影响
这个决策会带来哪些新约束或新问题。
\`\`\`

---

## 与其他场景的衔接

\`\`\`
讨论场景（problem unclear）
    → 问题清晰后进入 → 架构规划场景（options evaluation）
                              → 方案确定后进入 → 执行场景（task tracking）
\`\`\`

规划完成后，用 \`dt link <规划节点id> <任务节点id> "实施" --direction to\` 把决策与执行连接起来，保持决策链可追溯。
`;

const DT_AGENT_METADATA = `interface:
  display_name: "DT"
  short_description: "Use Decision Tree project memory"
  default_prompt: "Use the dt skill to inspect and update this project's decision tree before making project decisions."
`;

const DT_QODER_RULE = `---
trigger: always_on
---

## Decision Tree

DT 是人机协作的决策过程外化工具。如果当前目录存在 \`.dt/\`，会话开始时先执行 \`dt tree\` 了解当前状态。

### 场景路由

根据任务性质加载对应场景文件（位于 \`.agents/skills/dt/scenarios/\`）：

| 场景 | 适用时机 |
|------|----------|
| \`discussion.md\` | 问题尚未明确，需要对齐理解、推导方案 |
| \`planning.md\` | 有多个可行方案需要取舍，或需要拆解模块结构 |
| \`implementation.md\` | 需求已明确，进入拆解执行和状态追踪 |

三个场景连接成一条链：**discussion → planning → implementation**。
完整技能文档：\`.agents/skills/dt/SKILL.md\`

### 核心命令

| 命令 | 说明 |
|------|------|
| \`dt tree\` | 查看全局结构 |
| \`dt status\` | 查看项目概览 |
| \`dt show <id>\` | 查看节点详情 |
| \`dt add <type> "标题" --from <id>\` | 添加子节点 |
| \`dt add <type> "标题" --root\` | 添加根节点 |
| \`dt link <src> <tgt> "摘要" --direction to\` | 连接已有节点 |
| \`dt update <id> --status/--title/--summary/--type\` | 更新结构化字段 |

**Git 操作由 dt CLI 自动处理，无需手动 commit。**
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
  writeManagedFile(path.join(skillDir, 'scenarios', 'discussion.md'), DT_SCENARIO_DISCUSSION);
  writeManagedFile(path.join(skillDir, 'scenarios', 'implementation.md'), DT_SCENARIO_IMPLEMENTATION);
  writeManagedFile(path.join(skillDir, 'scenarios', 'planning.md'), DT_SCENARIO_PLANNING);
}

function writeQoderRule(projectDir: string): void {
  writeManagedFile(path.join(projectDir, '.qoder', 'rules', 'dt.md'), DT_QODER_RULE);
}

export function updateProjectSkillFiles(projectDir: string): void {
  writeDtSkill(projectDir, '.agents', CODEX_DT_SKILL);
  writeDtSkill(projectDir, '.claude', CLAUDE_DT_SKILL);
  writeQoderRule(projectDir);
}
