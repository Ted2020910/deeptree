# DeepTree Frontend Layout & Architecture Analysis

## Executive Summary
The DeepTree frontend uses a side-by-side split layout with the canvas on the left and detail panel on the right. The panel is fixed-width (400px), collapsible, but **NOT currently resizable**. The layout uses Flexbox with the panel as a fixed right sidebar.

---

## 1. Layout Structure (App.tsx → Canvas + DetailPanel)

### HTML/React Structure
```
<App>
  ├─ <header className="app-header"> ... </header>
  ├─ <div className="app-body">
  │  ├─ <DtCanvas> (flex: 1, grows to fill)
  │  └─ <DetailPanel> (optional, when selectedNode exists)
  └─ <CommandPalette> (overlay, z-index: 1000)
```

### Key Points:
- **App.tsx (line 435-459)**: The main layout renders:
  - `<DtCanvas>` - Takes `flex: 1` (grows to fill available space)
  - `<DetailPanel>` - Only rendered when `selectedNode` exists
  - Panel conditionally renders based on `selectedId` selection state

- **Selection Model** (App.tsx line 72, 97):
  ```tsx
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedNode = nodes.find(n => n.id === selectedId) ?? null
  ```
  When `selectedId` is null, DetailPanel unmounts entirely.

---

## 2. CSS Layout Classes

### .app-body (tokens.css:171-175)
```css
.app-body {
  flex: 1;              /* Takes remaining vertical space after header */
  display: flex;        /* Flexbox: horizontal by default */
  overflow: hidden;     /* Clip overflow, prevents scrollbars */
}
```
- **Direction**: Row (horizontal, side-by-side)
- **Parent**: `#root` (flex column)
- **Children spacing**: No gap, panels touch directly

### .canvas-wrap (tokens.css:981-985)
```css
.canvas-wrap {
  flex: 1;              /* Grows to fill available space */
  position: relative;   /* Stacking context for canvas elements */
  background: var(--bg);
}
```
- **Size**: Fills remaining space after DetailPanel reserves 400px
- **Overflow**: Not explicitly set (inherits from parent)

### .detail-panel (tokens.css:477-485, 1278-1285)
```css
.detail-panel {
  width: 400px;         /* FIXED WIDTH - not resizable */
  flex-shrink: 0;       /* Never shrinks, always 400px */
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;     /* Clip content, enables scrolling in body */
  transition: width 200ms ease-out; /* Smooth width transition */
}

.detail-panel--collapsed {
  width: 44px !important;  /* Collapsed state: narrow strip */
  align-items: center;
  padding-top: var(--space-md);
}
```

### .detail-panel__body (tokens.css:576-583)
```css
.detail-panel__body {
  flex: 1;              /* Grows to fill after header/footer */
  overflow-y: auto;     /* Scrollable content area */
  padding: var(--space-md) var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
```
- **Scrolling**: Only the body scrolls, header/footer sticky
- **Padding**: `16px 24px` (space-md × space-lg)

---

## 3. Panel Interaction: Overlay vs. Push

### Canvas Behavior:
- **Push Layout** ✅ (Current)
  - Canvas grows/shrinks with `.flex: 1` in `.app-body`
  - When DetailPanel (400px) renders, canvas shrinks to remaining space
  - When DetailPanel hidden, canvas expands to full width
  - No overlay - purely responsive layout

### Example:
```
[Header - 56px]
┌──────────────────────────────────────┐
│ app-body (flex)                      │
├──────────────────────┬────────────────┤
│ canvas-wrap          │ detail-panel   │
│ flex: 1              │ width: 400px   │
│ grows/shrinks        │ flex-shrink: 0 │
│ (responsive)         │ (fixed)        │
├──────────────────────┴────────────────┤
```

---

## 4. Existing Resize/Drag Mechanisms

### Current State: ❌ NO RESIZE HANDLE

**What exists:**
- ✅ Collapse toggle button (`.detail-panel__toggle` at line 1290)
  - Positioned at `left: -12px` (overlaps left border)
  - Toggles between 400px and 44px width
  - Smooth transition: `transition: width 200ms ease-out`
  
- ✅ Node card drag capability (DtCanvas.tsx:136-138)
  - Only for nodes inside the canvas via ReactFlow
  - Not for the panel width itself

**What does NOT exist:**
- ❌ Resizable/draggable panel divider
- ❌ Mouse resize handle
- ❌ Panel width state management
- ❌ localStorage persistence of panel width
- ❌ `react-resizable` or similar library

### Collapse Implementation (App.tsx:76, 454)
```tsx
const [panelCollapsed, setPanelCollapsed] = useState(false)

<DetailPanel
  collapsed={panelCollapsed}
  onToggleCollapse={() => setPanelCollapsed(c => !c)}
/>
```

DetailPanel.tsx:83-91 renders collapsed state:
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

---

## 5. Existing Debounce/Auto-Save Patterns

### Current Pattern: ❌ NO DEBOUNCE

**What exists:**
1. **Manual save on Ctrl+S** (DetailPanel.tsx:63-72)
   ```tsx
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
   ```

2. **Immediate save on blur** (DetailPanel.tsx line 51-61)
   ```tsx
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
   ```

3. **Dirty state tracking** (DetailPanel.tsx:35, 49)
   ```tsx
   const [dirty, setDirty] = useState(false)
   const markDirty = () => { setDirty(true); setSaveStatus('') }
   ```

### No Debounce/Throttle:
- ❌ No debounce on keystroke
- ❌ No auto-save with delay
- ❌ No throttle on network requests
- ❌ No existing debounce utility function
- ❌ No `lodash.debounce` or similar imported

### Network Pattern (useTree.ts):
- Simple fetch + immediate refetch pattern
- Every operation triggers full tree re-fetch
- WebSocket reconnect with 3s retry (line 44)

---

## 6. State Management for Panel Width

### Current State: ❌ NO WIDTH STATE MANAGEMENT

**What exists:**
```tsx
// App.tsx lines 76
const [panelCollapsed, setPanelCollapsed] = useState(false)

// Only boolean: collapsed yes/no
// No numeric width state
```

**What's missing:**
- ❌ `panelWidth` state variable
- ❌ localStorage persistence
- ❌ Config file storage
- ❌ CSS custom property (`--detail-panel-width`)
- ❌ Dynamic width calculations

### Storage Observations:
App.tsx already uses localStorage for theme (lines 11-23):
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
```

**Pattern to follow for panel width**: Same localStorage + state pattern

---

## Visual Layout Tree

```
┌─ html ─────────────────────────────────────────────────────┐
│ ┌─ #root (100dvh, flex column) ─────────────────────────┐ │
│ │ ┌─ .app-header (56px, flex-shrink: 0) ──────────────┐ │ │
│ │ │ [Logo] [ProjectSelector] [Buttons] [Theme]        │ │ │
│ │ └────────────────────────────────────────────────────┘ │ │
│ │ ┌─ .app-body (flex: 1, flex row, overflow: hidden) ─┐ │ │
│ │ │ ┌─ .canvas-wrap (flex: 1) ──────┐ ┌─ .detail-panel (400px) ──┐ │ │
│ │ │ │ [ReactFlow Canvas]            │ │ [Node Details Panel]     │ │ │
│ │ │ │ [Dot Wave Background]         │ │ - Header (sticky)        │ │ │
│ │ │ │ [Nodes + Edges]               │ │ - Body (scrollable)      │ │ │
│ │ │ │ [Controls]                    │ │ - Footer (sticky)        │ │ │
│ │ │ └───────────────────────────────┘ └──────────────────────────┘ │ │
│ │ │                                                                 │ │
│ │ └─────────────────────────────────────────────────────────────────┘ │ │
│ │ [CommandPalette overlay] (z-index: 1000) when open                 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Key Measurements

| Component | Property | Value | Notes |
|-----------|----------|-------|-------|
| header | height | 56px | flex-shrink: 0 |
| app-body | display | flex | direction: row (default) |
| canvas-wrap | flex | 1 | Grows to fill |
| detail-panel | width | 400px | flex-shrink: 0 (fixed) |
| detail-panel (collapsed) | width | 44px | !important override |
| detail-panel | transition | width 200ms | ease-out |
| detail-panel__toggle | position | left: -12px | Overlaps border |

---

## Implementation Recommendations for Resizable Panel

### Option 1: React Resizable Hooks (Recommended)
- Use `mouse events` + `useRef` to track divide position
- Store width in state + localStorage
- Add resize handle element between canvas and panel

### Option 2: CSS Grid + resize Property
```css
.app-body {
  display: grid;
  grid-template-columns: 1fr minmax(300px, 600px);
  resize: horizontal;
}
```
Less control, but simpler

### Option 3: React Library
- `react-resizable`
- `react-split-pane`
- `react-grid-layout`

---

## Auto-Save Implementation Path

### Current save workflow:
1. User edits field
2. `dirty` flag set to true
3. User presses Ctrl+S OR exits field
4. `handleSave()` triggers API call
5. Full tree refetch

### Recommended debounce pattern:
```tsx
const debouncedSave = useRef<NodeJS.Timeout | null>(null)

const handleFieldChange = useCallback((value: string) => {
  setContent(value)
  markDirty()
  
  if (debouncedSave.current) clearTimeout(debouncedSave.current)
  
  debouncedSave.current = setTimeout(() => {
    handleSave() // Auto-save after 2 seconds of inactivity
  }, 2000)
}, [])

useEffect(() => {
  return () => {
    if (debouncedSave.current) clearTimeout(debouncedSave.current)
  }
}, [])
```

---

## Summary Table

| Aspect | Status | Implementation |
|--------|--------|-----------------|
| **Layout Type** | ✅ Complete | Flexbox side-by-side |
| **Canvas/Panel Positioning** | ✅ Complete | Push layout (responsive) |
| **Overlay vs Push** | ✅ Complete | Push (canvas shrinks) |
| **Collapse/Expand** | ✅ Complete | Toggle button exists |
| **Resize Handle** | ❌ Missing | Could use mouse drag |
| **Resize State** | ❌ Missing | Only collapsed bool exists |
| **Debounce Utility** | ❌ Missing | No shared utility |
| **Auto-Save** | ❌ Missing | Manual Ctrl+S only |
| **localStorage Persistence** | ⚠️ Partial | Theme only, not panel width |

---

## File References

- **Layout container**: `App.tsx:435-459`
- **CSS layout**: `tokens.css:171-175` (app-body), `476-485` (detail-panel)
- **Collapse state**: `App.tsx:76, 454` + `DetailPanel.tsx:83-91`
- **Save handling**: `DetailPanel.tsx:51-72`
- **Dirty tracking**: `DetailPanel.tsx:35, 49`
- **Theme pattern** (to follow for width): `App.tsx:11-26`
- **Canvas layout**: `DtCanvas.tsx:238-291`

