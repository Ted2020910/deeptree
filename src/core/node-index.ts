/**
 * node-index.ts — distributed dt node index
 *
 * A dt project still has one local .dt/ directory, but node Markdown files may
 * live anywhere inside the project. .dt/index.yaml maps stable node ids to
 * their current relative file paths.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { readFrontmatterFile } from './frontmatter.js';
import { getDtPaths } from './project.js';
import type { NodeFrontmatter, NodeIndex, NodeIndexEntry } from '../types/index.js';

const INDEX_VERSION = 1 as const;
export const DT_NODE_SCHEMA = 'node/v1';

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  '.dt',
  '.next',
  '.turbo',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

export interface IndexSyncResult {
  index: NodeIndex;
  added: string[];
  updated: string[];
  removed: string[];
  conflicts: Array<{ id: string; paths: string[] }>;
}

function emptyIndex(): NodeIndex {
  return {
    version: INDEX_VERSION,
    updated: new Date().toISOString(),
    nodes: {},
  };
}

export function getProjectRoot(dtRoot: string): string {
  return path.dirname(dtRoot);
}

export function toProjectRelative(filePath: string, dtRoot: string): string {
  const projectRoot = getProjectRoot(dtRoot);
  const absolutePath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(projectRoot, filePath);
  const relative = path.relative(projectRoot, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`节点路径必须位于项目目录内: ${filePath}`);
  }
  return normalizeRelativePath(relative);
}

export function fromProjectRelative(relativePath: string, dtRoot: string): string {
  return path.join(getProjectRoot(dtRoot), relativePath);
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Detect whether a Markdown frontmatter block is a dt node.
 *
 * New distributed nodes should carry dt: node/v1. For existing projects, we
 * also accept the complete legacy dt node shape.
 */
export function isDtNodeFrontmatter(value: unknown): value is NodeFrontmatter {
  if (!isRecord(value)) return false;
  if (value.dt === DT_NODE_SCHEMA) return true;

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.type === 'string' &&
    typeof value.status === 'string' &&
    typeof value.root === 'boolean' &&
    Array.isArray(value.edges) &&
    typeof value.created === 'string'
  );
}

export function readNodeIndex(dtRoot: string): NodeIndex {
  const paths = getDtPaths(dtRoot);
  if (!fs.existsSync(paths.indexYaml)) {
    return emptyIndex();
  }

  try {
    const raw = fs.readFileSync(paths.indexYaml, 'utf-8');
    const parsed = yaml.load(raw) as Partial<NodeIndex> | null;
    if (!parsed || parsed.version !== INDEX_VERSION || !parsed.nodes) {
      return emptyIndex();
    }
    return {
      version: INDEX_VERSION,
      updated: parsed.updated ?? new Date().toISOString(),
      nodes: parsed.nodes,
    };
  } catch {
    return emptyIndex();
  }
}

export function writeNodeIndex(dtRoot: string, index: NodeIndex): void {
  const paths = getDtPaths(dtRoot);
  const next: NodeIndex = {
    version: INDEX_VERSION,
    updated: new Date().toISOString(),
    nodes: sortIndexEntries(index.nodes),
  };
  const content = yaml.dump(next, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
  });
  fs.writeFileSync(paths.indexYaml, content, 'utf-8');
}

function sortIndexEntries(entries: Record<string, NodeIndexEntry>): Record<string, NodeIndexEntry> {
  const sorted: Record<string, NodeIndexEntry> = {};
  for (const id of Object.keys(entries).sort()) {
    sorted[id] = entries[id];
  }
  return sorted;
}

function fingerprint(filePath: string): Pick<NodeIndexEntry, 'mtimeMs' | 'hash'> {
  const stat = fs.statSync(filePath);
  const raw = fs.readFileSync(filePath);
  return {
    mtimeMs: stat.mtimeMs,
    hash: crypto.createHash('sha1').update(raw).digest('hex'),
  };
}

function entryFor(id: string, relativePath: string, dtRoot: string): NodeIndexEntry {
  const absolutePath = fromProjectRelative(relativePath, dtRoot);
  return {
    id,
    path: relativePath,
    ...fingerprint(absolutePath),
    indexedAt: new Date().toISOString(),
  };
}

function readDtNodeId(filePath: string): string | null {
  try {
    const { frontmatter } = readFrontmatterFile<Record<string, unknown>>(filePath);
    if (!isDtNodeFrontmatter(frontmatter)) return null;
    return frontmatter.id;
  } catch {
    return null;
  }
}

function addOrUpdateEntry(
  entries: Record<string, NodeIndexEntry>,
  id: string,
  relativePath: string,
  dtRoot: string,
  changes: Pick<IndexSyncResult, 'added' | 'updated' | 'conflicts'>,
): void {
  const existing = entries[id];
  if (existing && existing.path !== relativePath) {
    const existingAbs = fromProjectRelative(existing.path, dtRoot);
    if (fs.existsSync(existingAbs)) {
      changes.conflicts.push({ id, paths: [existing.path, relativePath] });
      return;
    }
  }

  const next = entryFor(id, relativePath, dtRoot);
  if (!existing) {
    changes.added.push(id);
  } else if (
    existing.path !== next.path ||
    existing.mtimeMs !== next.mtimeMs ||
    existing.hash !== next.hash
  ) {
    changes.updated.push(id);
  }
  entries[id] = next;
}

function scanMarkdownFiles(root: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) continue;
        walk(absolutePath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
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
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join(paths.nodes, file));
}

export function syncNodeIndex(
  dtRoot: string,
  opts: { full?: boolean; write?: boolean } = {},
): IndexSyncResult {
  const shouldWrite = opts.write ?? true;
  const index = readNodeIndex(dtRoot);
  const nextEntries: Record<string, NodeIndexEntry> = { ...index.nodes };
  const changes: Pick<IndexSyncResult, 'added' | 'updated' | 'removed' | 'conflicts'> = {
    added: [],
    updated: [],
    removed: [],
    conflicts: [],
  };

  // Refresh known entries and drop stale/non-dt paths.
  for (const [id, entry] of Object.entries(index.nodes)) {
    const absolutePath = fromProjectRelative(entry.path, dtRoot);
    if (!fs.existsSync(absolutePath)) {
      delete nextEntries[id];
      changes.removed.push(id);
      continue;
    }
    const actualId = readDtNodeId(absolutePath);
    if (!actualId) {
      delete nextEntries[id];
      changes.removed.push(id);
      continue;
    }
    if (actualId !== id) {
      delete nextEntries[id];
    }
    addOrUpdateEntry(
      nextEntries,
      actualId,
      toProjectRelative(absolutePath, dtRoot),
      dtRoot,
      changes,
    );
  }

  // Legacy .dt/nodes files are always discoverable for backwards compatibility.
  for (const absolutePath of legacyNodeFiles(dtRoot)) {
    const id = readDtNodeId(absolutePath);
    if (!id) continue;
    addOrUpdateEntry(nextEntries, id, toProjectRelative(absolutePath, dtRoot), dtRoot, changes);
  }

  if (opts.full) {
    for (const absolutePath of scanMarkdownFiles(getProjectRoot(dtRoot))) {
      const id = readDtNodeId(absolutePath);
      if (!id) continue;
      addOrUpdateEntry(nextEntries, id, toProjectRelative(absolutePath, dtRoot), dtRoot, changes);
    }
  }

  const hasChanges =
    changes.added.length > 0 ||
    changes.updated.length > 0 ||
    changes.removed.length > 0 ||
    changes.conflicts.length > 0;

  const nextIndex: NodeIndex = {
    version: INDEX_VERSION,
    updated: new Date().toISOString(),
    nodes: sortIndexEntries(nextEntries),
  };

  if (shouldWrite && hasChanges) {
    writeNodeIndex(dtRoot, nextIndex);
    return {
      index: nextIndex,
      added: unique(changes.added),
      updated: unique(changes.updated),
      removed: unique(changes.removed),
      conflicts: changes.conflicts,
    };
  }

  return {
    index: hasChanges ? nextIndex : index,
    added: unique(changes.added),
    updated: unique(changes.updated),
    removed: unique(changes.removed),
    conflicts: changes.conflicts,
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function resolveNodeFilePath(nodeId: string, dtRoot: string): string | null {
  const synced = syncNodeIndex(dtRoot, { full: true });
  const entry = synced.index.nodes[nodeId];
  if (!entry) return null;
  const absolutePath = fromProjectRelative(entry.path, dtRoot);
  return fs.existsSync(absolutePath) ? absolutePath : null;
}

export function registerNodePath(nodeId: string, filePath: string, dtRoot: string): void {
  const relativePath = toProjectRelative(filePath, dtRoot);
  const index = readNodeIndex(dtRoot);
  index.nodes[nodeId] = entryFor(nodeId, relativePath, dtRoot);
  writeNodeIndex(dtRoot, index);
}

export function removeNodeFromIndex(nodeId: string, dtRoot: string): void {
  const index = readNodeIndex(dtRoot);
  if (index.nodes[nodeId]) {
    delete index.nodes[nodeId];
    writeNodeIndex(dtRoot, index);
  }
}

export function listIndexedNodeIds(dtRoot: string): string[] {
  return Object.keys(syncNodeIndex(dtRoot, { full: true }).index.nodes).sort();
}

export function generateNextIndexedId(dtRoot: string, digits = 3): string {
  const ids = listIndexedNodeIds(dtRoot);
  let maxNum = 0;
  for (const id of ids) {
    const match = id.match(new RegExp(`^(\\d{${digits}})$`));
    if (!match) continue;
    maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return String(maxNum + 1).padStart(digits, '0');
}
