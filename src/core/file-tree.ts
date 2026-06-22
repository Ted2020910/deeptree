/**
 * file-tree.ts — project filesystem tree helpers
 *
 * The tree is rooted at the project directory, not at .dt/.
 * Markdown files that carry DT frontmatter are annotated with node metadata.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readFrontmatterFile } from './frontmatter.js';
import { getProjectRoot, readNodeIndex, syncNodeIndex } from './node-index.js';
import { readTreeConfig } from './project.js';
import type {
  FileTreeDtNodeMarker,
  FileTreeEntry,
  FileTreeResponse,
} from '../types/index.js';
import { isDtNodeFrontmatter } from './node-index.js';
import type { NodeFrontmatter } from '../types/index.js';

const IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

function isMarkdownFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.md');
}

function markerFromFrontmatter(frontmatter: NodeFrontmatter): FileTreeDtNodeMarker {
  return {
    id: frontmatter.id,
    title: frontmatter.title,
    type: frontmatter.type,
    status: frontmatter.status,
    root: frontmatter.root,
  };
}

function collectDtMarkers(dtRoot: string): Map<string, FileTreeDtNodeMarker> {
  const markers = new Map<string, FileTreeDtNodeMarker>();
  const index = readNodeIndex(dtRoot);

  for (const entry of Object.values(index.nodes)) {
    const absPath = path.join(getProjectRoot(dtRoot), entry.path);
    if (!fs.existsSync(absPath)) continue;
    try {
      const { frontmatter } = readFrontmatterFile<NodeFrontmatter>(absPath);
      if (!isDtNodeFrontmatter(frontmatter)) continue;
      markers.set(normalizeRelativePath(entry.path), markerFromFrontmatter(frontmatter));
    } catch {
      // Ignore unreadable files; they will still appear in the tree.
    }
  }

  return markers;
}

function readMarkerFromFile(filePath: string): FileTreeDtNodeMarker | null {
  try {
    const { frontmatter } = readFrontmatterFile<Record<string, unknown>>(filePath);
    if (!isDtNodeFrontmatter(frontmatter)) return null;
    return markerFromFrontmatter(frontmatter);
  } catch {
    return null;
  }
}

function buildEntry(
  absolutePath: string,
  relativePath: string,
  markers: Map<string, FileTreeDtNodeMarker>,
): FileTreeEntry | null {
  const stat = fs.statSync(absolutePath);
  const baseName = path.basename(absolutePath);

  if (stat.isDirectory()) {
    if (isIgnoredDir(baseName)) return null;

    const children: FileTreeEntry[] = [];
    const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      const childAbs = path.join(absolutePath, entry.name);
      const childRel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory() && isIgnoredDir(entry.name)) continue;
      const child = buildEntry(childAbs, childRel, markers);
      if (child) children.push(child);
    }

    return {
      name: baseName,
      path: relativePath || '.',
      type: 'directory',
      children,
    };
  }

  if (!stat.isFile()) return null;

  const markerKey = normalizeRelativePath(relativePath);
  const dtNode = markers.get(markerKey) ?? (isMarkdownFile(baseName) ? readMarkerFromFile(absolutePath) ?? undefined : undefined);

  return {
    name: baseName,
    path: markerKey,
    type: 'file',
    isMarkdown: isMarkdownFile(baseName),
    dtNode,
  };
}

/**
 * Build a project filesystem tree rooted at the project directory.
 * The tree is safe to send directly to the frontend.
 */
export function buildProjectFileTree(dtRoot: string): FileTreeResponse {
  const projectRoot = getProjectRoot(dtRoot);
  const config = readTreeConfig(dtRoot);
  syncNodeIndex(dtRoot, { full: true });

  const markers = collectDtMarkers(dtRoot);
  const rootDirName = path.basename(projectRoot) || config.project;
  const rootEntry = buildEntry(projectRoot, '', markers) ?? {
    name: rootDirName,
    path: '.',
    type: 'directory',
    children: [],
  };

  return {
    root: {
      ...rootEntry,
      name: config.project || rootDirName,
      path: '.',
      type: 'directory',
      children: rootEntry.children ?? [],
    },
    updated: new Date().toISOString(),
  };
}

/**
 * Create a directory inside the project root.
 * The input can be absolute or project-relative.
 */
export function createProjectFolder(dtRoot: string, inputPath: string): string {
  const projectRoot = getProjectRoot(dtRoot);
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(projectRoot, inputPath);
  const relative = path.relative(projectRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`文件夹必须位于项目目录内: ${inputPath}`);
  }
  if (relative.split(path.sep).includes('.dt')) {
    throw new Error('不能在 .dt 目录中创建文件夹');
  }
  fs.mkdirSync(resolved, { recursive: true });
  return normalizeRelativePath(relative || '.');
}
