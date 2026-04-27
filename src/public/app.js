/**
 * app.js — dt Decision Tree 前端应用
 *
 * 模块：API 客户端、WebSocket、D3 树渲染、面板交互
 */

// ============================================================
// API Client
// ============================================================

const API = {
  async get(path) {
    const res = await fetch(`/api${path}`);
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
  },
};

// ============================================================
// State
// ============================================================

const state = {
  tree: null,       // TreeRenderNode
  nodes: [],        // flat node list
  config: null,     // TreeConfig
  contexts: [],
  interactions: [],
  selectedNodeId: null,
  wsConnected: false,
};

// ============================================================
// WebSocket Client (auto-reconnect with exponential backoff)
// ============================================================

let ws = null;
let wsReconnectDelay = 1000;

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    wsReconnectDelay = 1000;
    state.wsConnected = true;
    updateWsStatus(true);
    setStatus('已连接');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'connected') {
        // 初始连接确认
      } else if (msg.type === 'update') {
        handleUpdate(msg.scope);
      }
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    state.wsConnected = false;
    updateWsStatus(false);
    setStatus('连接断开，正在重连...');
    setTimeout(() => {
      wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, 30000);
      connectWebSocket();
    }, wsReconnectDelay);
  };

  ws.onerror = () => {
    ws.close();
  };
}

function updateWsStatus(connected) {
  const el = document.getElementById('ws-status');
  if (connected) {
    el.textContent = '已连接';
    el.className = 'badge badge-connected';
  } else {
    el.textContent = '断开';
    el.className = 'badge badge-disconnected';
  }
}

function setStatus(msg) {
  document.getElementById('status-message').textContent = msg;
}

// ============================================================
// Data Loading
// ============================================================

async function loadAll() {
  try {
    const [treeData, interactions, contexts] = await Promise.all([
      API.get('/tree'),
      API.get('/interactions'),
      API.get('/contexts'),
    ]);

    state.config = treeData.config;
    state.tree = treeData.tree;
    state.nodes = treeData.nodes;
    state.interactions = interactions;
    state.contexts = contexts;

    document.getElementById('project-name').textContent = state.config.project;
    document.getElementById('node-count').textContent = `${state.nodes.length} 节点`;

    renderTree();
    renderInteractions();
    renderContexts();
    setStatus(`已加载 ${state.nodes.length} 个节点`);
  } catch (err) {
    setStatus(`加载失败: ${err.message}`);
    console.error(err);
  }
}

async function handleUpdate(scope) {
  setStatus(`检测到 ${scope} 变更，正在刷新...`);
  await loadAll();

  // 如果当前有选中的节点，刷新详情
  if (state.selectedNodeId) {
    const node = state.nodes.find(n => n.id === state.selectedNodeId);
    if (node) showNodeDetail(node);
  }
}

// ============================================================
// D3 Tree Rendering
// ============================================================

const STATUS_COLOR = {
  pending: '#565f89',
  in_progress: '#7aa2f7',
  decided: '#9ece6a',
  completed: '#9ece6a',
  rejected: '#f7768e',
};

const TYPE_ICON = {
  goal: '🎯',
  subproblem: '🔍',
  solution: '💡',
  evaluation: '⚖️',
  reflection: '🪞',
  practice: '🔧',
};

let svgGroup = null;
let zoom = null;

function renderTree() {
  if (!state.tree) return;

  const svg = d3.select('#tree-svg');
  svg.selectAll('*').remove();

  const container = document.getElementById('tree-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  svg.attr('width', width).attr('height', height);

  // Zoom
  zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .on('zoom', (event) => {
      svgGroup.attr('transform', event.transform);
    });

  svg.call(zoom);

  svgGroup = svg.append('g');

  // Convert tree to d3 hierarchy
  const root = d3.hierarchy(state.tree, d => d.children);

  // Tree layout
  const nodeCount = root.descendants().length;
  const treeHeight = Math.max(400, nodeCount * 50);
  const treeWidth = Math.max(600, (root.height + 1) * 220);

  const treeLayout = d3.tree()
    .size([treeHeight, treeWidth])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

  treeLayout(root);

  // Center the tree
  const initialX = 80;
  const initialY = (height - treeHeight) / 2;
  svgGroup.attr('transform', `translate(${initialX}, ${initialY})`);

  // Reset zoom to initial position
  svg.call(zoom.transform, d3.zoomIdentity.translate(initialX, initialY));

  // Links
  svgGroup.selectAll('.link')
    .data(root.links())
    .join('path')
    .attr('class', 'link')
    .attr('d', d3.linkHorizontal()
      .x(d => d.y)
      .y(d => d.x)
    );

  // Nodes
  const nodeGroups = svgGroup.selectAll('.node')
    .data(root.descendants())
    .join('g')
    .attr('class', d => {
      const classes = ['node', `node-${d.data.status}`, `node-${d.data.type}`];
      if (d.data.id === state.selectedNodeId) classes.push('node-selected');
      return classes.join(' ');
    })
    .attr('transform', d => `translate(${d.y}, ${d.x})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation();
      selectNode(d.data.id);
    });

  // Node circles
  nodeGroups.append('circle')
    .attr('r', d => {
      switch (d.data.type) {
        case 'goal': return 14;
        case 'evaluation': case 'reflection': case 'practice': return 7;
        default: return 10;
      }
    })
    .attr('fill', d => STATUS_COLOR[d.data.status] || '#565f89')
    .attr('stroke', d => STATUS_COLOR[d.data.status] || '#565f89')
    .attr('stroke-width', d => d.data.id === state.selectedNodeId ? 3 : 2)
    .attr('fill-opacity', 0.3);

  // Type icon
  nodeGroups.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', d => d.data.type === 'goal' ? '12px' : '9px')
    .text(d => TYPE_ICON[d.data.type] || '');

  // Node label
  nodeGroups.append('text')
    .attr('x', d => {
      switch (d.data.type) {
        case 'goal': return 20;
        case 'evaluation': case 'reflection': case 'practice': return 12;
        default: return 16;
      }
    })
    .attr('dy', '0.35em')
    .attr('font-size', '12px')
    .attr('fill', '#c0caf5')
    .text(d => {
      const label = d.data.label || d.data.id;
      return label.length > 30 ? label.slice(0, 30) + '...' : label;
    });

  // Node ID (below)
  nodeGroups.append('text')
    .attr('x', d => {
      switch (d.data.type) {
        case 'goal': return 20;
        default: return 16;
      }
    })
    .attr('dy', '1.8em')
    .attr('font-size', '9px')
    .attr('fill', '#565f89')
    .text(d => d.data.id);

  // Click background to deselect
  svg.on('click', () => {
    state.selectedNodeId = null;
    renderTree();
    showNoSelection();
  });
}

function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  renderTree();

  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    showNodeDetail(node);
    switchTab('detail');
  }
}

// ============================================================
// Node Detail Panel
// ============================================================

function showNoSelection() {
  document.getElementById('no-selection').style.display = '';
  document.getElementById('node-detail').style.display = 'none';
}

function showNodeDetail(node) {
  document.getElementById('no-selection').style.display = 'none';
  document.getElementById('node-detail').style.display = '';

  document.getElementById('detail-id').textContent = node.id;
  document.getElementById('detail-type').textContent = node.type;

  const statusEl = document.getElementById('detail-status');
  statusEl.textContent = node.status;
  statusEl.className = `node-status-tag status-${node.status}`;

  // Title from content first line
  const title = node.content?.split('\n')[0]?.replace(/^#+\s*/, '') || node.id;
  document.getElementById('detail-title').textContent = title;

  // Meta info
  const meta = document.getElementById('detail-meta');
  let metaHtml = '';
  if (node.parent) metaHtml += `<div>父节点: <span style="color:var(--accent)">${node.parent}</span></div>`;
  if (node.children?.length) metaHtml += `<div>子节点: ${node.children.join(', ')}</div>`;
  if (node.decided_option) metaHtml += `<div>选择方案: <span style="color:var(--green)">${node.decided_option}</span></div>`;
  if (node.score !== undefined) metaHtml += `<div>评分: <span style="color:var(--yellow)">${node.score}</span></div>`;
  metaHtml += `<div>创建: ${new Date(node.created).toLocaleString()}</div>`;
  meta.innerHTML = metaHtml;

  // Content (skip first heading line)
  const contentLines = (node.content || '').split('\n');
  const contentBody = contentLines.slice(1).join('\n').trim();
  document.getElementById('detail-content').textContent = contentBody || '(无内容)';
}

// ============================================================
// Interactions Panel
// ============================================================

function renderInteractions() {
  const list = document.getElementById('interactions-list');
  const noEl = document.getElementById('no-interactions');
  const badge = document.getElementById('interaction-badge');

  const waiting = state.interactions.filter(i => i.status === 'waiting');

  if (waiting.length > 0) {
    badge.textContent = waiting.length;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  if (state.interactions.length === 0) {
    list.innerHTML = '';
    noEl.style.display = '';
    return;
  }

  noEl.style.display = 'none';

  // Sort: waiting first, then answered
  const sorted = [...state.interactions].sort((a, b) => {
    if (a.status === 'waiting' && b.status !== 'waiting') return -1;
    if (a.status !== 'waiting' && b.status === 'waiting') return 1;
    return 0;
  });

  list.innerHTML = sorted.map(i => {
    const isWaiting = i.status === 'waiting';
    const question = i.content?.split('\n').find(l => l.trim() && !l.startsWith('#')) || i.id;

    let html = `<div class="interaction-card ${isWaiting ? '' : 'answered'}" data-id="${i.id}">`;
    html += `<div class="interaction-header">
      <span style="font-family:monospace;font-size:11px;color:var(--text-muted)">${i.id}</span>
      <span class="interaction-type">${i.type}</span>
    </div>`;
    html += `<div class="interaction-question">${escapeHtml(question)}</div>`;

    if (isWaiting) {
      if (i.options?.length) {
        html += '<div class="interaction-options">';
        for (const opt of i.options) {
          html += `<button class="option-btn" data-option-id="${opt.id}" onclick="selectOption('${i.id}', '${opt.id}')">${escapeHtml(opt.label)}</button>`;
        }
        html += '</div>';
      }

      html += `<div class="interaction-answer">
        <textarea id="answer-${i.id}" placeholder="输入回答..."></textarea>
        <div style="margin-top:6px;display:flex;gap:6px">
          <button class="btn" onclick="submitAnswer('${i.id}')">提交回答</button>
        </div>
      </div>`;
    } else if (i.answer) {
      html += `<div style="font-size:12px;color:var(--green);margin-top:4px">✓ ${escapeHtml(i.answer)}</div>`;
    }

    html += '</div>';
    return html;
  }).join('');
}

function selectOption(interactionId, optionId) {
  // Visual selection
  const card = document.querySelector(`.interaction-card[data-id="${interactionId}"]`);
  if (!card) return;
  card.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
  card.querySelector(`[data-option-id="${optionId}"]`)?.classList.add('selected');

  // Set answer textarea
  const textarea = document.getElementById(`answer-${interactionId}`);
  if (textarea) textarea.value = optionId;
}

async function submitAnswer(interactionId) {
  const textarea = document.getElementById(`answer-${interactionId}`);
  const answer = textarea?.value?.trim();
  if (!answer) {
    alert('请输入回答');
    return;
  }

  try {
    await API.post(`/interactions/${interactionId}/answer`, { answer });
    setStatus(`已回答 ${interactionId}`);
    await loadAll();
  } catch (err) {
    alert(`提交失败: ${err.message}`);
  }
}

// ============================================================
// Contexts Panel
// ============================================================

function renderContexts() {
  const list = document.getElementById('contexts-list');
  const noEl = document.getElementById('no-contexts');

  if (state.contexts.length === 0) {
    list.innerHTML = '';
    noEl.style.display = '';
    return;
  }

  noEl.style.display = 'none';

  list.innerHTML = state.contexts.map(c => {
    return `<div class="context-card ${c.status}" onclick="showContextDetail('${c.id}')">
      <div class="context-title">${escapeHtml(c.title)}</div>
      <div class="context-meta">
        <span>${c.id}</span> · <span>${c.source}</span> · <span>${c.status}</span>
      </div>
    </div>`;
  }).join('');
}

async function showContextDetail(contextId) {
  try {
    const ctx = await API.get(`/contexts/${contextId}`);
    // Show in node detail panel
    document.getElementById('no-selection').style.display = 'none';
    document.getElementById('node-detail').style.display = '';

    document.getElementById('detail-id').textContent = ctx.id;
    document.getElementById('detail-type').textContent = 'context';
    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = ctx.status;
    statusEl.className = `node-status-tag status-${ctx.status === 'confirmed' ? 'completed' : 'pending'}`;

    document.getElementById('detail-title').textContent = ctx.title;

    const meta = document.getElementById('detail-meta');
    meta.innerHTML = `
      <div>来源: ${ctx.source}</div>
      <div>确认: ${ctx.confirmed_by?.join(', ') || '未确认'}</div>
      <div>创建: ${new Date(ctx.created).toLocaleString()}</div>
    `;

    document.getElementById('detail-content').textContent = ctx.content || '(无内容)';
    switchTab('detail');
  } catch (err) {
    setStatus(`加载上下文失败: ${err.message}`);
  }
}

// ============================================================
// Tab Switching
// ============================================================

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${tabName}`);
  });
}

// Tab click handlers
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ============================================================
// Utilities
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Window resize
window.addEventListener('resize', () => {
  if (state.tree) renderTree();
});

// Make functions available globally for inline onclick handlers
window.selectOption = selectOption;
window.submitAnswer = submitAnswer;
window.showContextDetail = showContextDetail;

// ============================================================
// Init
// ============================================================

(async function init() {
  connectWebSocket();
  await loadAll();
})();
