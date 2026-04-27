/**
 * api-routes.ts — REST API 路由处理 (v2)
 *
 * 精简版：只保留 nodes/tree/status/export 相关 API。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { readTreeConfig, requireDtRoot } from '../core/project.js';
import { listAllNodes, readNode, nodeExists, updateNodeFields, updateNodeContent } from '../core/node.js';
import { buildTree } from '../utils/render.js';

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

/**
 * 处理 API 请求
 * @returns true 如果请求被处理了
 */
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
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }

  if (!pathname.startsWith('/api/')) return false;

  try {
    // GET /api/tree — 完整树结构
    if (method === 'GET' && pathname === '/api/tree') {
      const dtRoot = requireDtRoot();
      const config = readTreeConfig(dtRoot);
      const nodes = listAllNodes();
      const tree = config.root_node ? buildTree(nodes, config.root_node) : null;
      json(res, {
        config,
        tree,
        nodes: nodes.map((n) => ({
          ...n.frontmatter,
          content: n.content,
        })),
      });
      return true;
    }

    // GET /api/nodes
    if (method === 'GET' && pathname === '/api/nodes') {
      const nodes = listAllNodes();
      json(res, nodes.map((n) => ({ ...n.frontmatter, content: n.content })));
      return true;
    }

    // GET /api/nodes/:id
    const nodeMatch = pathname.match(/^\/api\/nodes\/([^/]+)$/);
    if (method === 'GET' && nodeMatch) {
      const id = nodeMatch[1];
      if (!nodeExists(id)) {
        error(res, `节点 ${id} 不存在`, 404);
        return true;
      }
      const node = readNode(id);
      json(res, { ...node.frontmatter, content: node.content });
      return true;
    }

    // PUT /api/nodes/:id/frontmatter — 更新结构化字段
    const fmMatch = pathname.match(/^\/api\/nodes\/([^/]+)\/frontmatter$/);
    if (method === 'PUT' && fmMatch) {
      const id = fmMatch[1];
      if (!nodeExists(id)) { error(res, `节点 ${id} 不存在`, 404); return true; }
      const body = await parseBody(req);
      const allowed = ['title', 'summary', 'status', 'type'] as const;
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in body) updates[key] = body[key];
      }
      updateNodeFields(id, updates as Parameters<typeof updateNodeFields>[1]);
      json(res, { ok: true });
      return true;
    }

    // PUT /api/nodes/:id/content — 更新 Markdown 正文
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

      json(res, {
        project: config.project,
        created: config.created,
        rootNode: config.root_node,
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
          case 'goal':
            shape = `${fm.id}[["${label}"]]`;
            break;
          case 'solution':
            shape = `${fm.id}("${label}")`;
            break;
          case 'evaluation':
            shape = `${fm.id}{{"${label}"}}`;
            break;
          default:
            shape = `${fm.id}["${label}"]`;
        }

        lines.push(`    ${shape}`);

        if (fm.status === 'completed' || fm.status === 'decided') {
          lines.push(`    style ${fm.id} fill:#c8e6c9`);
        } else if (fm.status === 'rejected') {
          lines.push(`    style ${fm.id} fill:#ffcdd2`);
        } else if (fm.status === 'in_progress') {
          lines.push(`    style ${fm.id} fill:#fff9c4`);
        }

        if (fm.parent) {
          lines.push(`    ${fm.parent} --> ${fm.id}`);
        }

        // 渲染 edges
        const edges = fm.edges ?? [];
        for (const edge of edges) {
          if (edge.direction === 'to' || edge.direction === 'related') {
            lines.push(`    ${fm.id} -.-> ${edge.target}`);
          }
        }
      }

      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(lines.join('\n'));
      return true;
    }

    // 404 for unknown API routes
    error(res, `未知 API 路径: ${pathname}`, 404);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(res, message, 500);
    return true;
  }
}
