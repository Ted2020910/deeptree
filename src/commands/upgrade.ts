/**
 * upgrade.ts - dt upgrade
 *
 * 1. Upgrade the dt CLI checkout by pulling and rebuilding it.
 * 2. Upgrade the current project: refresh entry files, migrate legacy node
 *    frontmatter to node/v1, rebuild the distributed node index.
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { findDtRoot, getDtPaths } from '../core/project.js';
import { updateProjectEntryFiles, updateProjectSkillFiles } from '../core/hooks.js';
import { readFrontmatterFile, writeFrontmatterFile } from '../core/frontmatter.js';
import { gitAutoCommit } from '../core/git.js';
import { DT_NODE_SCHEMA, getProjectRoot, syncNodeIndex } from '../core/node-index.js';
import type { Edge, NodeFrontmatter, NodeStatus } from '../types/index.js';

const LEGACY_STYLE_NODE_IDS = [
  'style-001',
  'style-002',
  'style-003',
  'style-004',
  'style-005',
] as const;

const LEGACY_STYLE_TITLES = new Set([
  '不同类型节点的写作风格要求',
  'Explore 节点 — 深度推导与认知对齐',
  'Explore 节点 - 深度推导与认知对齐',
  'Task 节点 — 明确任务与执行跟踪',
  'Task 节点 - 明确任务与执行跟踪',
  'Document 节点 — 原始事实与资源记录',
  'Document 节点 - 原始事实与资源记录',
  'Decision 节点 — 多选项对比与结论',
  'Decision 节点 - 多选项对比与结论',
]);

const VALID_STATUSES = new Set<NodeStatus>([
  'pending',
  'in_progress',
  'decided',
  'completed',
  'rejected',
]);

const MARKDOWN_SCAN_IGNORED_DIRS = new Set([
  '.git',
  '.dt',
  '.next',
  '.turbo',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'release',
]);

type LegacyNodeFrontmatter = Record<string, unknown> & {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  type?: unknown;
  status?: unknown;
  root?: unknown;
  edges?: unknown;
  parent?: unknown;
  children?: unknown;
  created?: unknown;
};

interface MigrationCandidate {
  filePath: string;
  frontmatter: LegacyNodeFrontmatter;
  content: string;
}

interface MigratedNode {
  filePath: string;
  frontmatter: NodeFrontmatter;
  content: string;
  before: string;
}

interface MigrationResult {
  scanned: number;
  migrated: number;
  reverseEdgesAdded: number;
}

function findCliRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  let dir = path.dirname(__filename);

  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
        if (pkg.name === 'dt-cli') return dir;
      } catch {
        // Keep walking up.
      }
    }
    dir = path.dirname(dir);
  }

  throw new Error('无法定位 dt CLI 安装目录');
}

function readVersion(dir: string): string {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return pkg.version ?? 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringifyFrontmatter(value: unknown): string {
  return JSON.stringify(sortForComparison(value));
}

function sortForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForComparison);
  }
  if (!isRecord(value)) return value;

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortForComparison(value[key]);
  }
  return sorted;
}

function isLegacyStyleNode(filePath: string, expectedId: string): boolean {
  try {
    const { frontmatter } = readFrontmatterFile<NodeFrontmatter>(filePath);
    return (
      frontmatter.id === expectedId &&
      frontmatter.status === 'completed' &&
      LEGACY_STYLE_TITLES.has(frontmatter.title)
    );
  } catch {
    return false;
  }
}

function removeLegacyStyleNodes(dtRoot: string): number {
  const paths = getDtPaths(dtRoot);
  let removed = 0;

  for (const id of LEGACY_STYLE_NODE_IDS) {
    const nodePath = path.join(paths.nodes, `${id}.md`);
    if (!fs.existsSync(nodePath)) continue;
    if (!isLegacyStyleNode(nodePath, id)) continue;
    fs.unlinkSync(nodePath);
    removed += 1;
  }

  return removed;
}

function scanMarkdownFiles(root: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (MARKDOWN_SCAN_IGNORED_DIRS.has(entry.name)) continue;
        walk(absolutePath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        results.push(absolutePath);
      }
    }
  }

  if (fs.existsSync(root)) walk(root);
  return results;
}

function legacyNodeFiles(dtRoot: string): string[] {
  const paths = getDtPaths(dtRoot);
  if (!fs.existsSync(paths.nodes)) return [];
  return fs
    .readdirSync(paths.nodes)
    .filter((file) => file.toLowerCase().endsWith('.md'))
    .map((file) => path.join(paths.nodes, file));
}

function isInLegacyNodesDir(filePath: string, dtRoot: string): boolean {
  const nodesDir = path.resolve(getDtPaths(dtRoot).nodes);
  return path.dirname(path.resolve(filePath)) === nodesDir;
}

function isLegacyNodeCandidate(
  frontmatter: LegacyNodeFrontmatter,
  filePath: string,
  dtRoot: string,
): boolean {
  if (frontmatter.dt === DT_NODE_SCHEMA) return true;
  if (typeof frontmatter.id !== 'string' || frontmatter.id.trim() === '') return false;
  if (isInLegacyNodesDir(filePath, dtRoot)) return true;

  return (
    typeof frontmatter.title === 'string' &&
    typeof frontmatter.type === 'string' &&
    typeof frontmatter.status === 'string' &&
    ('edges' in frontmatter ||
      'parent' in frontmatter ||
      'children' in frontmatter ||
      'root' in frontmatter ||
      'created' in frontmatter)
  );
}

function collectMigrationCandidates(dtRoot: string): MigrationCandidate[] {
  const files = new Map<string, string>();
  for (const filePath of legacyNodeFiles(dtRoot)) files.set(path.resolve(filePath), filePath);
  for (const filePath of scanMarkdownFiles(getProjectRoot(dtRoot))) {
    files.set(path.resolve(filePath), filePath);
  }

  const candidates: MigrationCandidate[] = [];
  for (const filePath of files.values()) {
    try {
      const { frontmatter, content } = readFrontmatterFile<LegacyNodeFrontmatter>(filePath);
      if (!isRecord(frontmatter)) continue;
      if (!isLegacyNodeCandidate(frontmatter, filePath, dtRoot)) continue;
      candidates.push({ filePath, frontmatter, content });
    } catch {
      // Ignore unreadable or non-frontmatter Markdown files.
    }
  }
  return candidates;
}

function readLegacyRootIds(dtRoot: string): Set<string> {
  const paths = getDtPaths(dtRoot);
  if (!fs.existsSync(paths.treeYaml)) return new Set();

  const raw = fs.readFileSync(paths.treeYaml, 'utf-8');
  const rootIds = new Set<string>();
  const re = /^\s*root_node:\s*["']?([^"'\r\n]+)["']?\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const id = match[1]?.trim();
    if (id) rootIds.add(id);
  }
  return rootIds;
}

function titleFromContent(content: string, fallback: string): string {
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return title || fallback;
}

function normalizeStatus(value: unknown): NodeStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value as NodeStatus)
    ? (value as NodeStatus)
    : 'pending';
}

function edgeTypeFromLegacy(value: unknown): Edge['type'] | null {
  if (value === 'from' || value === 'to') return value;
  return null;
}

function normalizeEdges(frontmatter: LegacyNodeFrontmatter): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>();

  function add(edge: Edge): void {
    if (!edge.target.trim()) return;
    const key = `${edge.type}\0${edge.target}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(edge);
  }

  if (Array.isArray(frontmatter.edges)) {
    for (const rawEdge of frontmatter.edges) {
      if (!isRecord(rawEdge)) continue;
      const target = typeof rawEdge.target === 'string' ? rawEdge.target.trim() : '';
      const type = edgeTypeFromLegacy(rawEdge.type) ?? edgeTypeFromLegacy(rawEdge.direction);
      if (!target || !type) continue;
      add({
        target,
        type,
        summary: typeof rawEdge.summary === 'string' ? rawEdge.summary : '',
        ...(typeof rawEdge.depth === 'number' ? { depth: rawEdge.depth } : {}),
      });
    }
  }

  if (typeof frontmatter.parent === 'string' && frontmatter.parent.trim()) {
    add({ target: frontmatter.parent.trim(), type: 'from', summary: '' });
  }

  if (Array.isArray(frontmatter.children)) {
    for (const child of frontmatter.children) {
      if (typeof child !== 'string' || !child.trim()) continue;
      add({ target: child.trim(), type: 'to', summary: '' });
    }
  }

  return edges;
}

function removeLegacyFields(frontmatter: Record<string, unknown>): void {
  for (const key of [
    'parent',
    'children',
    'direction',
    'decided_option',
    'requires_human',
    'depends_on_context',
    'score',
  ]) {
    delete frontmatter[key];
  }
}

function reverseEdgeType(type: Edge['type']): Edge['type'] {
  return type === 'from' ? 'to' : 'from';
}

function addReverseEdges(nodes: Map<string, MigratedNode>): number {
  let added = 0;

  for (const node of nodes.values()) {
    for (const edge of node.frontmatter.edges) {
      if (edge.target.includes('::')) continue;
      const targetNode = nodes.get(edge.target);
      if (!targetNode) continue;

      const reverseType = reverseEdgeType(edge.type);
      const exists = targetNode.frontmatter.edges.some(
        (candidate) => candidate.target === node.frontmatter.id && candidate.type === reverseType,
      );
      if (exists) continue;

      targetNode.frontmatter.edges.push({
        target: node.frontmatter.id,
        type: reverseType,
        summary: edge.summary,
        ...(edge.depth !== undefined ? { depth: edge.depth } : {}),
      });
      added += 1;
    }
  }

  return added;
}

function migrateProjectNodes(dtRoot: string): MigrationResult {
  const candidates = collectMigrationCandidates(dtRoot);
  const rootIds = readLegacyRootIds(dtRoot);
  const now = new Date().toISOString();
  const migratedNodes = new Map<string, MigratedNode>();

  for (const candidate of candidates) {
    const id = typeof candidate.frontmatter.id === 'string'
      ? candidate.frontmatter.id.trim()
      : '';
    if (!id) continue;

    const nextFrontmatter = { ...candidate.frontmatter };
    removeLegacyFields(nextFrontmatter);

    const nodeFrontmatter: NodeFrontmatter = {
      ...nextFrontmatter,
      dt: DT_NODE_SCHEMA,
      id,
      root: candidate.frontmatter.root === true || rootIds.has(id),
      title: typeof candidate.frontmatter.title === 'string' && candidate.frontmatter.title.trim()
        ? candidate.frontmatter.title.trim()
        : titleFromContent(candidate.content, id),
      summary: typeof candidate.frontmatter.summary === 'string' ? candidate.frontmatter.summary : '',
      type: typeof candidate.frontmatter.type === 'string' && candidate.frontmatter.type.trim()
        ? candidate.frontmatter.type.trim()
        : 'subproblem',
      status: normalizeStatus(candidate.frontmatter.status),
      edges: normalizeEdges(candidate.frontmatter),
      created: typeof candidate.frontmatter.created === 'string' && candidate.frontmatter.created.trim()
        ? candidate.frontmatter.created
        : now,
    };

    migratedNodes.set(id, {
      filePath: candidate.filePath,
      frontmatter: nodeFrontmatter,
      content: candidate.content,
      before: stringifyFrontmatter(candidate.frontmatter),
    });
  }

  const reverseEdgesAdded = addReverseEdges(migratedNodes);
  let migrated = 0;

  for (const node of migratedNodes.values()) {
    const after = stringifyFrontmatter(node.frontmatter);
    if (after === node.before) continue;
    writeFrontmatterFile(node.filePath, node.frontmatter, node.content);
    migrated += 1;
  }

  return {
    scanned: migratedNodes.size,
    migrated,
    reverseEdgesAdded,
  };
}

function upgradeProject(dtRoot: string): void {
  const projectDir = path.dirname(dtRoot);

  console.log(chalk.dim('  更新项目级 dt skills...'));
  updateProjectSkillFiles(projectDir);

  console.log(chalk.dim('  更新 CLAUDE.md / AGENTS.md...'));
  updateProjectEntryFiles(projectDir);

  const removedStyles = removeLegacyStyleNodes(dtRoot);
  if (removedStyles > 0) {
    console.log(chalk.dim(`  清理旧项目内写作风格节点: ${removedStyles}`));
  }

  console.log(chalk.dim('  迁移旧节点 frontmatter...'));
  const migration = migrateProjectNodes(dtRoot);
  console.log(
    chalk.dim(
      `  扫描 ${migration.scanned} 个节点，写回 ${migration.migrated} 个，补全反向边 ${migration.reverseEdgesAdded} 条`,
    ),
  );

  console.log(chalk.dim('  刷新 .dt/index.yaml...'));
  syncNodeIndex(dtRoot, { full: true });

  gitAutoCommit(dtRoot, 'upgrade: 更新项目入口与索引');
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('更新 dt CLI 及当前项目到最新版本')
    .action(() => {
      let cliRoot: string;
      try {
        cliRoot = findCliRoot();
      } catch {
        console.error(chalk.red('✗ 无法定位 dt CLI 安装目录'));
        console.error(chalk.dim('  请确认 dt 是通过 git clone + npm link 安装的'));
        process.exit(1);
      }

      console.log('');
      console.log(chalk.cyan('⬆ 正在更新 dt CLI...'));
      console.log(chalk.dim(`  安装目录: ${cliRoot}`));

      const oldVersion = readVersion(cliRoot);

      try {
        console.log(chalk.dim('  拉取最新代码...'));
        const pullOutput = execSync('git pull origin main', {
          cwd: cliRoot,
          stdio: 'pipe',
          encoding: 'utf-8',
        }).trim();

        if (pullOutput.includes('Already up to date')) {
          console.log(chalk.green(`✓ CLI 已是最新版本 (${oldVersion})`));
        } else {
          console.log(chalk.dim('  安装依赖...'));
          try {
            execSync('npm install', {
              cwd: cliRoot,
              stdio: 'pipe',
            });
          } catch (err: unknown) {
            console.error(chalk.red('✗ npm install 失败'));
            if (err instanceof Error && 'stderr' in err) {
              console.error(chalk.dim(`  ${(err as { stderr: string }).stderr}`));
            }
            process.exit(1);
          }

          console.log(chalk.dim('  编译构建...'));
          try {
            execSync('npm run build', {
              cwd: cliRoot,
              stdio: 'pipe',
            });
          } catch (err: unknown) {
            console.error(chalk.red('✗ 构建失败'));
            if (err instanceof Error && 'stderr' in err) {
              console.error(chalk.dim(`  ${(err as { stderr: string }).stderr}`));
            }
            process.exit(1);
          }

          const newVersion = readVersion(cliRoot);
          if (oldVersion !== newVersion) {
            console.log(chalk.green(`✓ dt CLI 已更新 ${oldVersion} -> ${newVersion}`));
          } else {
            console.log(chalk.green(`✓ dt CLI 已更新 (${newVersion})`));
          }
        }
      } catch (err: unknown) {
        console.log(chalk.yellow('⚠ git pull 失败，跳过 CLI 更新'));
        if (err instanceof Error && 'stderr' in err) {
          const stderr = (err as { stderr: string }).stderr.trim();
          if (stderr) console.log(chalk.dim(`  ${stderr}`));
        }
        console.log(chalk.dim('  请检查网络连接和 git 配置'));
      }

      const dtRoot = findDtRoot();
      if (dtRoot) {
        console.log('');
        console.log(chalk.cyan('⬆ 正在更新当前项目...'));
        try {
          upgradeProject(dtRoot);
          console.log(chalk.green('✓ 项目已更新到最新协议版本'));
        } catch (err: unknown) {
          console.error(
            chalk.red('✗ 项目更新失败:'),
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      console.log('');
    });
}
