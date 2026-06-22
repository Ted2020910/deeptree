# DeepTree Layout Quick Reference Guide

## TL;DR Answers to Your 6 Questions

### 1. **How the App renders DtCanvas and DetailPanel side by side?**

**File**: `App.tsx` lines 435-459

```jsx
<div className="app-body">
  <DtCanvas
    dtNodes={nodes}
    selectedId={selectedId}
    // ... more props
  />
  {selectedNode && (
    <DetailPanel
      node={selectedNode}
      // ... more props
    />
  )}
</div>
```

**Layout Mechanism**:
- `.app-body` = `display: flex` + `flex-direction: row` (default)
- `<DtCanvas>` = `flex: 1` (grows to fill available space)
- `<DetailPanel>` = `width: 400px` + `flex-shrink: 0` (fixed, never shrinks)
- **Result**: Canvas shrinks when panel renders; expands when panel hidden

---

### 2. **CSS for `.app-body` and layout classes**

**File**: `tokens.css` lines 171-175, 476-485, 981-985

```css
/* Main container */
.app-body {
  flex: 1;
  display: flex;                    /* Row direction by default */
  overflow: hidden;                 /* No scrollbars, clip content */
}

/* Canvas wrapper */
.canvas-wrap {
  flex: 1;                          /* Grows to fill remaining space */
  position: relative;               /* Stacking context for nodes */
  background: var(--bg);
}

/* Detail panel */
.detail-panel {
  width: 400px;                     /* FIXED WIDTH */
  flex-shrink: 0;                   /* Never shrinks */
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;                 /* Body scrolls, not whole panel */
  transition: width 200ms ease-out; /* Smooth collapse animation */
}

/* Collapsed state */
.detail-panel--collapsed {
  width: 44px !important;           /* Narrow strip */
  align-items: center;
  padding-top: var(--space-md);
}

.detail-panel--collapsed .detail-panel__header,
.detail-panel--collapsed .detail-panel__body,
.detail-panel--collapsed .detail-panel__footer {
  display: none;                    /* Hide content when collapsed */
}
```

---

### 3. **Existing drag/resize handle or mechanism?**

**Answer**: ❌ **NO RESIZE HANDLE EXISTS**

**What DOES exist** (line 1290-1313):
```css
.detail-panel__toggle {
  position: absolute;
  top: var(--space-sm);
  left: -12px;                      /* Positioned outside left border */
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--surface-raised);
  border: 1px solid var(--border-visible);
  cursor: pointer;
  /* ... */
}
```

**Toggle Implementation** (App.tsx line 76, 454):
```tsx
const [panelCollapsed, setPanelCollapsed] = useState(false)

<DetailPanel
  collapsed={panelCollapsed}
  onToggleCollapse={() => setPanelCollapsed(c => !c)}
/>
```

**Detail Panel** (DetailPanel.tsx line 83-91):
```tsx
if (collapsed) {
  return (
    <div className="detail-panel detail-panel--collapsed">
      <button className="detail-panel__toggle" onClick={onToggleCollapse}>›</button>
      <span style={{ writingMode: 'vertical-rl' }}>#{node.id}</span>
    </div>
  )
}
```

**What's NOT here**:
- ❌ Draggable/resizable divider
- ❌ Mouse event handlers for resizing
- ❌ Width state management (only boolean `collapsed`)
- ❌ localStorage persistence of width
- ❌ CSS `resize: horizontal` property

---

### 4. **How does panel interact with canvas? Overlay or push?**

**Answer**: 🔷 **PUSH LAYOUT** (Canvas shrinks/grows responsively)

**Mechanism**:

```
Canvas = flex: 1           Detail Panel = width: 400px
                           flex-shrink: 0

When panel visible:
┌──────────────────────┬──────────────────┐
│ Canvas (flex: 1)     │ Panel (400px)    │
│ Width = 100% - 400px │ Width = 400px    │
└──────────────────────┴──────────────────┘

When panel hidden:
┌──────────────────────────────────────┐
│ Canvas (flex: 1)                     │
│ Width = 100%                         │
└──────────────────────────────────────┘

When panel collapsed:
┌────────────────────────────────────┬─────┐
│ Canvas (flex: 1)                   │ 44px│
│ Width = 100% - 44px                │     │
└────────────────────────────────────┴─────┘
```

**NOT an overlay** because:
- ❌ No `position: absolute` or `fixed` on panel
- ❌ No `z-index` stacking of canvas/panel
- ❌ Canvas doesn't have `position: relative` to overlay something
- ✅ Pure flexbox layout: one takes space, other adjusts

---

### 5. **Existing debounce utilities, auto-save patterns?**

**Answer**: ❌ **NO DEBOUNCE, NO AUTO-SAVE**

**Current Save Pattern** (DetailPanel.tsx lines 51-72):

```tsx
/* 1. Manual Ctrl+S handler */
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && dirty) {
      e.preventDefault()
      handleSave()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [dirty, handleSave])

/* 2. Save function */
const handleSave = useCallback(async () => {
  setSaveStatus('保存中…')
  try {
    await saveFns.updateFrontmatter(node.id, { title, summary, type, status })
    await saveFns.updateContent(node.id, content)
    setSaveStatus('已保存')
    setDirty(false)
  } catch {
    setSaveStatus('保存失败')
  }
}, [node.id, title, summary, type, status, content, saveFns])

/* 3. Dirty state tracking */
const [dirty, setDirty] = useState(false)
const markDirty = () => { setDirty(true); setSaveStatus('') }
```

**Workflow**:
1. User edits field → `markDirty()` sets `dirty = true`
2. User saves with `Ctrl+S` → triggers `handleSave()`
3. No auto-save, no debounce, no timeout

**What's imported**:
- ❌ No `lodash.debounce`
- ❌ No custom debounce hook
- ❌ No throttle implementation

**Network Pattern** (useTree.ts):
```tsx
// Every operation does: action → full tree refetch
const updateFrontmatter = useCallback(
  async (id: string, updates: Partial<Pick<DtNode, ...>>) => {
    await fetch(`/api/projects/${projectId}/nodes/${id}/frontmatter`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    await fetchTree()  // ← Full refetch after every change
  },
  [projectId, fetchTree],
)
```

---

### 6. **State management for panel width?**

**Answer**: ❌ **NO WIDTH STATE**

**Only collapsed boolean exists** (App.tsx line 76):
```tsx
const [panelCollapsed, setPanelCollapsed] = useState(false)
```

**Missing**:
- ❌ `panelWidth` number state
- ❌ localStorage persistence
- ❌ CSS custom property tracking
- ❌ Dynamic width calculations

**Theme Pattern Exists** (App.tsx lines 11-26) - *Could be followed for width*:
```tsx
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('dt-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    if (theme === 'light') document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
    localStorage.setItem('dt-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}
```

**Same pattern could work for panel width**:
```tsx
function usePanelWidth() {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem('dt-panel-width')
    return saved ? parseInt(saved, 10) : 400  // Default 400px
  })

  useEffect(() => {
    localStorage.setItem('dt-panel-width', String(width))
  }, [width])

  return [width, setWidth] as const
}
```

---

## Code Location Reference

| Question | File | Lines | Key Class/Function |
|----------|------|-------|-------------------|
| 1. Layout structure | App.tsx | 435-459 | `<div className="app-body">` |
| 2. CSS .app-body | tokens.css | 171-175 | `.app-body { flex: 1; display: flex; }` |
| 2. CSS .detail-panel | tokens.css | 476-485, 1278-1285 | `.detail-panel { width: 400px; }` |
| 2. CSS .canvas-wrap | tokens.css | 981-985 | `.canvas-wrap { flex: 1; position: relative; }` |
| 3. Resize toggle button | tokens.css | 1290-1313 | `.detail-panel__toggle` |
| 3. Collapse state | DetailPanel.tsx | 83-91 | `if (collapsed) { return ... }` |
| 3. Collapse state in App | App.tsx | 76, 454 | `const [panelCollapsed, ...]` |
| 4. Canvas flex property | tokens.css | 981-985 | `.canvas-wrap { flex: 1; }` |
| 4. Panel fixed width | tokens.css | 477-485 | `.detail-panel { width: 400px; flex-shrink: 0; }` |
| 5. Save on Ctrl+S | DetailPanel.tsx | 63-72 | `if ((e.ctrlKey \|\| e.metaKey) && e.key === 's')` |
| 5. Dirty tracking | DetailPanel.tsx | 35, 49 | `const [dirty, setDirty] = useState(false)` |
| 5. Network refetch | useTree.ts | 53-62 | `await fetchTree()` after operations |
| 6. Theme pattern | App.tsx | 11-26 | `function useTheme() { ... localStorage ... }` |
| 6. No panel width state | App.tsx | 76 | Only `panelCollapsed` boolean |

---

## Implementation Priority

**If you were adding a feature, here's the order**:

### Priority 1: Resizable Panel Handle
```tsx
// Add to App.tsx or new hook
const [panelWidth, setPanelWidth] = useState(400)

// Handle mouse drag between canvas and panel
// Store in localStorage via custom hook
```

### Priority 2: Auto-Save with Debounce
```tsx
// Add to DetailPanel.tsx
const debouncedSave = useRef<NodeJS.Timeout | null>(null)

const autoSaveOnChange = useCallback((value) => {
  setValue(value)
  markDirty()
  
  if (debouncedSave.current) clearTimeout(debouncedSave.current)
  
  debouncedSave.current = setTimeout(() => {
    handleSave()  // Auto-save after 2s inactivity
  }, 2000)
}, [])
```

### Priority 3: Responsive Mobile Layout
```css
/* On small screens, stack vertically */
@media (max-width: 768px) {
  .app-body {
    flex-direction: column;
  }
  .detail-panel {
    width: 100%;
    height: auto;
    max-height: 50vh;
  }
}
```

---

## Key Insight

The layout uses **pure Flexbox**, not CSS Grid or overlays. The DetailPanel's `flex-shrink: 0` is the key—it forces the canvas to shrink via `flex: 1` flex-basis calculation. This creates a responsive "push" layout where canvas space adapts to panel width.

The collapse feature (400px ↔ 44px) is just a CSS width change with a smooth 200ms transition—no JavaScript measurement or calculation needed.

