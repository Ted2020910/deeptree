/**
 * api-routes.ts — REST API 路由处理 (v3)
 *
 * 支持多项目路由 /api/projects/:id/*
 * 保留旧版 /api/tree 兼容路由
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { readTreeConfig, requireDtRoot, getDtPaths } from '../core/project.js';
import {
  listAllNodes,
  readNode,
  nodeExists,
  updateNodeFields,
  updateNodeContent,
  createNode,
  promoteMarkdownToNode,
  deleteNode,
  addEdgeBidirectional,
  removeEdgeBidirectional,
  updateEdgeSummaryBidirectional,
} from '../core/node.js';
import { buildForest, buildTree } from '../utils/render.js';
import { listProjects, findProjectById } from '../core/registry.js';
import { gitAutoCommitLater as gitAutoCommit } from '../core/git.js';
import type { Edge } from '../types/index.js';
import { syncNodeIndex } from '../core/node-index.js';
import { buildProjectFileTree, createProjectFolder } from '../core/file-tree.js';

async function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body) as Record<string, unknown>); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function error(res: ServerResponse, message: string, status = 400): void {
  json(res, { error: message }, status);
}

/** 解析项目 dtRoot，不存在则返回 null */
function resolveDtRootForProject(projectId: string): string | null {
  const entry = findProjectById(projectId);
  if (!entry) return null;
  const dtRoot = path.join(entry.path, '.dt');
  if (!fs.existsSync(dtRoot)) return null;
  return dtRoot;
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }

  if (!pathname.startsWith('/api/')) return false;

  try {

    // ─── 多项目路由 ─────────────────────────────────────────

    // GET /api/projects
    if (method === 'GET' && pathname === '/api/projects') {
      const projects = listProjects();
      json(res, { projects });
      return true;
    }

    // GET /api/projects/:id/tree
    const projectTreeMatch = pathname.match(/^\/api\/projects\/([^/]+)\/tree$/);
    if (method === 'GET' && projectTreeMatch) {
      const projectId = projectTreeMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      syncNodeIndex(dtRoot);
      const config = readTreeConfig(dtRoot);
      const nodes = listAllNodes(dtRoot);
      const forest = buildForest(nodes);
      json(res, {
        config,
        forest,
        nodes: nodes.map(n => ({ ...n.frontmatter, content: n.content, path: n.path })),
      });
      return true;
    }

    // GET /api/projects/:id/files
    const projectFilesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/files$/);
    if (method === 'GET' && projectFilesMatch) {
      const projectId = projectFilesMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      json(res, buildProjectFileTree(dtRoot));
      return true;
    }

    // POST /api/projects/:id/folders
    const projectFoldersMatch = pathname.match(/^\/api\/projects\/([^/]+)\/folders$/);
    if (method === 'POST' && projectFoldersMatch) {
      const projectId = projectFoldersMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      const body = await parseBody(req);
      const folderPath = typeof body.path === 'string' ? body.path.trim() : '';
      if (!folderPath) { error(res, 'path 字段必填'); return true; }
      const createdPath = createProjectFolder(dtRoot, folderPath);
      gitAutoCommit(dtRoot, `create folder ${createdPath}`);
      json(res, { ok: true, path: createdPath }, 201);
      return true;
    }

    // PUT /api/projects/:id/nodes/:nid/frontmatter
    const projectFmMatch = pathname.match(/^\/api\/projects\/([^/]+)\/nodes\/([^/]+)\/frontmatter$/);
    if (method === 'PUT' && projectFmMatch) {
      const [, projectId, nodeId] = projectFmMatch;
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      if (!nodeExists(nodeId, dtRoot)) { error(res, `节点 ${nodeId} 不存在`, 404); return true; }
      const body = await parseBody(req);
      const allowed = ['title', 'summary', 'status', 'type', 'root'] as const;
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in body) updates[key] = body[key];
      }
      updateNodeFields(nodeId, updates as Parameters<typeof updateNodeFields>[1], dtRoot);
      gitAutoCommit(dtRoot, `update ${nodeId} frontmatter`);
      json(res, { ok: true });
      return true;
    }

    // PUT /api/projects/:id/nodes/:nid/content
    const projectContentMatch = pathname.match(/^\/api\/projects\/([^/]+)\/nodes\/([^/]+)\/content$/);
    if (method === 'PUT' && projectContentMatch) {
      const [, projectId, nodeId] = projectContentMatch;
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      if (!nodeExists(nodeId, dtRoot)) { error(res, `节点 ${nodeId} 不存在`, 404); return true; }
      const body = await parseBody(req);
      if (typeof body.content !== 'string') { error(res, 'content 字段必须为字符串'); return true; }
      updateNodeContent(nodeId, body.content, dtRoot);
      gitAutoCommit(dtRoot, `update ${nodeId} content`);
      json(res, { ok: true });
      return true;
    }

    // POST /api/projects/:id/nodes  创建节点
    const projectNodesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/nodes$/);
    if (method === 'POST' && projectNodesMatch) {
      const projectId = projectNodesMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      const body = await parseBody(req);
      const type = typeof body.type === 'string' && body.type.trim() ? body.type : 'subproblem';
      const title = typeof body.title === 'string' ? body.title : '';
      if (!title.trim()) { error(res, 'title 字段必填'); return true; }
      const summary = typeof body.summary === 'string' ? body.summary : '';
      const nodePath = typeof body.path === 'string' && body.path.trim() ? body.path.trim() : undefined;
      const directory = typeof body.directory === 'string' && body.directory.trim() ? body.directory.trim() : undefined;
      const filename = typeof body.filename === 'string' && body.filename.trim() ? body.filename.trim() : undefined;
      const root = body.root === true;
      const fromsRaw = Array.isArray(body.froms) ? body.froms : [];
      const froms: string[] = [];
      for (const v of fromsRaw) {
        if (typeof v === 'string' && v.trim()) froms.push(v.trim());
      }
      // 验证父节点存在（仅本项目节点验证；跨项目交给 createNode 抛错）
      for (const f of froms) {
        if (!f.includes('::') && !nodeExists(f, dtRoot)) {
          error(res, `父节点 ${f} 不存在`, 400);
          return true;
        }
      }
      const fromSummariesRaw = Array.isArray(body.fromSummaries) ? body.fromSummaries : [];
      const fromSummaries = fromSummariesRaw.map((s) => (typeof s === 'string' ? s : ''));
      const id = createNode({
        type,
        title,
        summary,
        froms,
        fromSummaries,
        root,
        path: nodePath,
        directory,
        filename,
        dtRoot,
      });
      gitAutoCommit(dtRoot, `add ${type} ${id}: ${title}`);
      json(res, { ok: true, id }, 201);
      return true;
    }

    // POST /api/projects/:id/promote  将现有 Markdown 转为节点
    const projectPromoteMatch = pathname.match(/^\/api\/projects\/([^/]+)\/promote$/);
    if (method === 'POST' && projectPromoteMatch) {
      const projectId = projectPromoteMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      const body = await parseBody(req);
      const filePath = typeof body.path === 'string' ? body.path.trim() : '';
      if (!filePath) { error(res, 'path 字段必填'); return true; }
      const type = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : undefined;
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined;
      const summary = typeof body.summary === 'string' ? body.summary : undefined;
      const root = body.root === true ? true : body.root === false ? false : undefined;
      const fromsRaw = Array.isArray(body.froms) ? body.froms : [];
      const froms: string[] = [];
      for (const v of fromsRaw) {
        if (typeof v === 'string' && v.trim()) froms.push(v.trim());
      }
      for (const f of froms) {
        if (!f.includes('::') && !nodeExists(f, dtRoot)) {
          error(res, `父节点 ${f} 不存在`, 400);
          return true;
        }
      }
      const fromSummariesRaw = Array.isArray(body.fromSummaries) ? body.fromSummaries : [];
      const fromSummaries = fromSummariesRaw.map((s) => (typeof s === 'string' ? s : ''));
      const id = promoteMarkdownToNode({
        path: filePath,
        type,
        title,
        summary,
        root,
        froms,
        fromSummaries,
        dtRoot,
      });
      gitAutoCommit(dtRoot, `promote ${id}`);
      json(res, { ok: true, id }, 201);
      return true;
    }

    // DELETE /api/projects/:id/nodes/:nid  删除节点
    const projectDeleteNodeMatch = pathname.match(/^\/api\/projects\/([^/]+)\/nodes\/([^/]+)$/);
    if (method === 'DELETE' && projectDeleteNodeMatch) {
      const [, projectId, nodeId] = projectDeleteNodeMatch;
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      if (!nodeExists(nodeId, dtRoot)) { error(res, `节点 ${nodeId} 不存在`, 404); return true; }
      deleteNode(nodeId, dtRoot);
      gitAutoCommit(dtRoot, `delete node ${nodeId}`);
      json(res, { ok: true });
      return true;
    }

    // POST /api/projects/:id/edges  添加边
    const projectEdgesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/edges$/);
    if (method === 'POST' && projectEdgesMatch) {
      const projectId = projectEdgesMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      const body = await parseBody(req);
      const source = typeof body.source === 'string' ? body.source : '';
      const target = typeof body.target === 'string' ? body.target : '';
      const type = body.type === 'from' ? 'from' : body.type === 'to' ? 'to' : null;
      const summary = typeof body.summary === 'string' ? body.summary : '';
      if (!source || !target || !type) {
        error(res, 'source / target / type(from|to) 必填');
        return true;
      }
      if (!nodeExists(source, dtRoot)) { error(res, `源节点 ${source} 不存在`, 404); return true; }
      if (!target.includes('::') && !nodeExists(target, dtRoot)) {
        error(res, `目标节点 ${target} 不存在`, 404); return true;
      }
      if (source === target) { error(res, '不能连接到自身'); return true; }
      const edge: Edge = { target, type, summary };
      addEdgeBidirectional(source, edge, dtRoot);
      gitAutoCommit(dtRoot, `link ${source} ${type === 'to' ? '→' : '←'} ${target}`);
      json(res, { ok: true });
      return true;
    }

    // DELETE /api/projects/:id/edges  删除边（参数走 query 或 body）
    if (method === 'DELETE' && projectEdgesMatch) {
      const projectId = projectEdgesMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      const qs = url.searchParams;
      const body = await parseBody(req);
      const source = qs.get('source') ?? (typeof body.source === 'string' ? body.source : '');
      const target = qs.get('target') ?? (typeof body.target === 'string' ? body.target : '');
      const typeRaw = qs.get('type') ?? (typeof body.type === 'string' ? body.type : '');
      const type: Edge['type'] | undefined =
        typeRaw === 'from' ? 'from' : typeRaw === 'to' ? 'to' : undefined;
      if (!source || !target) { error(res, 'source 与 target 必填'); return true; }
      if (!nodeExists(source, dtRoot)) { error(res, `源节点 ${source} 不存在`, 404); return true; }
      removeEdgeBidirectional(source, target, type, dtRoot);
      gitAutoCommit(dtRoot, `unlink ${source} ⇿ ${target}`);
      json(res, { ok: true });
      return true;
    }

    // PATCH /api/projects/:id/edges  改边 summary（不删边）
    if (method === 'PATCH' && projectEdgesMatch) {
      const projectId = projectEdgesMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      const body = await parseBody(req);
      const source = typeof body.source === 'string' ? body.source : '';
      const target = typeof body.target === 'string' ? body.target : '';
      const typeRaw = typeof body.type === 'string' ? body.type : '';
      const type: Edge['type'] | undefined =
        typeRaw === 'from' ? 'from' : typeRaw === 'to' ? 'to' : undefined;
      const summary = typeof body.summary === 'string' ? body.summary : '';
      if (!source || !target) { error(res, 'source 与 target 必填'); return true; }
      if (!nodeExists(source, dtRoot)) { error(res, `源节点 ${source} 不存在`, 404); return true; }
      updateEdgeSummaryBidirectional(source, target, type, summary, dtRoot);
      gitAutoCommit(dtRoot, `edit edge ${source}↔${target} summary`);
      json(res, { ok: true });
      return true;
    }

    // POST /api/projects/:id/export  导出节点子集 + 内部边
    const projectExportMatch = pathname.match(/^\/api\/projects\/([^/]+)\/export$/);
    if (method === 'POST' && projectExportMatch) {
      const projectId = projectExportMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      const body = await parseBody(req);
      const idsRaw = Array.isArray(body.nodeIds) ? body.nodeIds : [];
      const ids: string[] = [];
      for (const v of idsRaw) {
        if (typeof v === 'string' && nodeExists(v, dtRoot)) ids.push(v);
      }
      if (ids.length === 0) { error(res, 'nodeIds 必须为非空字符串数组'); return true; }
      const idSet = new Set(ids);
      const exportedNodes = ids.map((id) => {
        const n = readNode(id, dtRoot);
        return { ...n.frontmatter, content: n.content, path: n.path };
      });
      // 只保留 source 与 target 都在导出集合内的边（用 'to' 边作为权威方向，去重）
      const internalEdges: Array<{ source: string; target: string; type: 'to'; summary: string }> = [];
      const seen = new Set<string>();
      for (const node of exportedNodes) {
        for (const e of (node.edges ?? []) as Edge[]) {
          if (e.target.includes('::')) continue;
          if (!idSet.has(e.target)) continue;
          let s = node.id, t = e.target;
          if (e.type === 'from') { s = e.target; t = node.id; }
          const key = `${s}→${t}`;
          if (seen.has(key)) continue;
          seen.add(key);
          internalEdges.push({ source: s, target: t, type: 'to', summary: e.summary ?? '' });
        }
      }
      const config = readTreeConfig(dtRoot);
      const bundle = {
        format: 'dt-bundle/v1',
        source: { id: projectId, name: config.project },
        exportedAt: new Date().toISOString(),
        nodes: exportedNodes.map((n) => ({
          id: n.id,
          root: n.root ?? false,
          title: n.title,
          summary: n.summary ?? '',
          type: n.type,
          status: n.status,
          content: n.content,
          path: n.path,
          created: n.created,
        })),
        internalEdges,
      };
      json(res, bundle);
      return true;
    }

    // POST /api/projects/:id/import  导入 bundle，分配新 ID 并重建内部边
    const projectImportMatch = pathname.match(/^\/api\/projects\/([^/]+)\/import$/);
    if (method === 'POST' && projectImportMatch) {
      const projectId = projectImportMatch[1];
      const dtRoot = resolveDtRootForProject(projectId);
      if (!dtRoot) { error(res, `项目 ${projectId} 不存在或路径无效`, 404); return true; }
      const body = await parseBody(req);
      const bundle = body as Record<string, unknown>;
      if (bundle.format !== 'dt-bundle/v1') { error(res, '不支持的 bundle 格式（需 dt-bundle/v1）'); return true; }
      const nodes = Array.isArray(bundle.nodes) ? bundle.nodes : [];
      const internalEdges = Array.isArray(bundle.internalEdges) ? bundle.internalEdges : [];
      if (nodes.length === 0) { error(res, 'bundle.nodes 为空'); return true; }
      // 第一遍：分配新 ID（不带 from），后续再写入边
      const idMap = new Map<string, string>();
      const createdIds: string[] = [];
      try {
        for (const raw of nodes) {
          const n = raw as Record<string, unknown>;
          const oldId = typeof n.id === 'string' ? n.id : null;
          const title = typeof n.title === 'string' ? n.title : '(untitled)';
          const type = typeof n.type === 'string' ? n.type : 'subproblem';
          const summary = typeof n.summary === 'string' ? n.summary : '';
          const isRoot = n.root === true;
          const content = typeof n.content === 'string' ? n.content : '';
          const originalPath = typeof n.path === 'string' ? n.path : undefined;
          const targetPath = originalPath && !fs.existsSync(path.join(path.dirname(dtRoot), originalPath))
            ? originalPath
            : undefined;
          if (!oldId) continue;
          const newId = createNode({
            type, title, summary, root: isRoot, content, path: targetPath, dtRoot,
          });
          idMap.set(oldId, newId);
          createdIds.push(newId);
          // 应用 status（createNode 默认 pending）
          if (typeof n.status === 'string' && n.status !== 'pending') {
            updateNodeFields(newId, { status: n.status as Parameters<typeof updateNodeFields>[1]['status'] }, dtRoot);
          }
        }
        // 第二遍：重建内部边
        for (const e of internalEdges) {
          const er = e as Record<string, unknown>;
          const s = typeof er.source === 'string' ? idMap.get(er.source) : undefined;
          const t = typeof er.target === 'string' ? idMap.get(er.target) : undefined;
          const summary = typeof er.summary === 'string' ? er.summary : '';
          if (!s || !t || s === t) continue;
          addEdgeBidirectional(s, { target: t, type: 'to', summary }, dtRoot);
        }
      } catch (err) {
        // 失败时回滚已创建的节点
        for (const id of createdIds) {
          try { deleteNode(id, dtRoot); } catch { /* ignore */ }
        }
        const message = err instanceof Error ? err.message : String(err);
        error(res, `导入失败: ${message}`, 500);
        return true;
      }
      gitAutoCommit(dtRoot, `import bundle: ${createdIds.length} nodes`);
      const idMapping = Array.from(idMap.entries()).map(([from, to]) => ({ from, to }));
      json(res, { ok: true, imported: createdIds.length, idMapping }, 201);
      return true;
    }

    // ─── 兼容旧版路由 ───────────────────────────────────────

    // GET /api/tree
    if (method === 'GET' && pathname === '/api/tree') {
      let dtRoot: string;
      try {
        dtRoot = requireDtRoot();
      } catch {
        const projects = listProjects();
        const first = projects.find(p => p.reachable);
        if (!first) { error(res, '未找到可用的 dt 项目', 404); return true; }
        dtRoot = path.join(first.path, '.dt');
      }
      const config = readTreeConfig(dtRoot);
      const nodes = listAllNodes(dtRoot);
      const forest = buildForest(nodes);
      // 兼容旧 tree 字段：取第一棵树
      const tree = forest[0] ?? null;
      json(res, {
        config,
        tree,
        forest,
        nodes: nodes.map(n => ({ ...n.frontmatter, content: n.content, path: n.path })),
      });
      return true;
    }

    // GET /api/nodes
    if (method === 'GET' && pathname === '/api/nodes') {
      const nodes = listAllNodes();
      json(res, nodes.map((n) => ({ ...n.frontmatter, content: n.content, path: n.path })));
      return true;
    }

    // GET /api/nodes/:id
    const nodeMatch = pathname.match(/^\/api\/nodes\/([^/]+)$/);
    if (method === 'GET' && nodeMatch) {
      const id = nodeMatch[1];
      if (!nodeExists(id)) { error(res, `节点 ${id} 不存在`, 404); return true; }
      const node = readNode(id);
      json(res, { ...node.frontmatter, content: node.content, path: node.path });
      return true;
    }

    // PUT /api/nodes/:id/frontmatter
    const fmMatch = pathname.match(/^\/api\/nodes\/([^/]+)\/frontmatter$/);
    if (method === 'PUT' && fmMatch) {
      const id = fmMatch[1];
      if (!nodeExists(id)) { error(res, `节点 ${id} 不存在`, 404); return true; }
      const body = await parseBody(req);
      const allowed = ['title', 'summary', 'status', 'type', 'root'] as const;
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in body) updates[key] = body[key];
      }
      updateNodeFields(id, updates as Parameters<typeof updateNodeFields>[1]);
      json(res, { ok: true });
      return true;
    }

    // PUT /api/nodes/:id/content
    const contentMatch = pathname.match(/^\/api\/nodes\/([^/]+)\/content$/);
    if (method === 'PUT' && contentMatch) {
      const id = contentMatch[1];
      if (!nodeExists(id)) { error(res, `节点 ${id} 不存在`, 404); return true; }
      const body = await parseBody(req);
      if (typeof body.content !== 'string') { error(res, 'content 字段必须为字符串'); return true; }
      updateNodeContent(id, body.content);
      json(res, { ok: true });
      return true;
    }

    // GET /api/status
    if (method === 'GET' && pathname === '/api/status') {
      const dtRoot = requireDtRoot();
      const config = readTreeConfig(dtRoot);
      const nodes = listAllNodes();

      const statusCounts: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};
      for (const n of nodes) {
        statusCounts[n.frontmatter.status] = (statusCounts[n.frontmatter.status] ?? 0) + 1;
        typeCounts[n.frontmatter.type] = (typeCounts[n.frontmatter.type] ?? 0) + 1;
      }

      const roots = nodes.filter(n => n.frontmatter.root).map(n => n.frontmatter.id);

      json(res, {
        project: config.project,
        created: config.created,
        rootNodes: roots,
        totalNodes: nodes.length,
        statusCounts,
        typeCounts,
      });
      return true;
    }

    // GET /api/export/mermaid
    if (method === 'GET' && pathname === '/api/export/mermaid') {
      const nodes = listAllNodes();
      const lines = ['graph TD'];

      for (const node of nodes) {
        const fm = node.frontmatter;
        const label = fm.title || node.content.split('\n')[0]?.replace(/^#+\s*/, '') || fm.id;
        let shape: string;

        switch (fm.type) {
          case 'goal':    shape = `${fm.id}[["${label}"]]`; break;
          case 'solution': shape = `${fm.id}("${label}")`; break;
          case 'evaluation': shape = `${fm.id}{{"${label}"}}`; break;
          default: shape = `${fm.id}["${label}"]`;
        }

        lines.push(`    ${shape}`);

        if (fm.status === 'completed' || fm.status === 'decided') {
          lines.push(`    style ${fm.id} fill:#c8e6c9`);
        } else if (fm.status === 'rejected') {
          lines.push(`    style ${fm.id} fill:#ffcdd2`);
        } else if (fm.status === 'in_progress') {
          lines.push(`    style ${fm.id} fill:#fff9c4`);
        }

        // 从 edges 重建连接线（to 边）
        for (const edge of fm.edges ?? []) {
          if (edge.type === 'to' && !edge.target.includes('::')) {
            lines.push(`    ${fm.id} --> ${edge.target}`);
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(lines.join('\n'));
      return true;
    }

    error(res, `未知 API 路径: ${pathname}`, 404);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(res, message, 500);
    return true;
  }
}
