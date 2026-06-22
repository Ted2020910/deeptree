# DeepTree Frontend Layout Documentation Index

## 📚 Overview

This documentation package provides a **comprehensive analysis** of the DeepTree frontend layout structure, answering all 6 investigative questions about how the DtCanvas and DetailPanel interact.

**Total Documentation**: 1,056 lines across 3 files
**Analysis Scope**: Very thorough, covering all layout mechanics, CSS, state management, and patterns

---

## 📄 Document Files

### 1. **LAYOUT_QUICK_REFERENCE.md** ⚡ START HERE
**Best for**: Quick answers, code snippets, implementation references

**Contains**:
- TL;DR answers to all 6 questions
- Inline code snippets with line numbers
- Code location reference table
- Implementation priority suggestions
- Key insight about flexbox design

**When to use**: 
- You need a quick answer right now
- You're implementing a feature and need the pattern
- You want exact file:line references for jumping to code

**Size**: 359 lines | **Time to read**: 5-10 minutes

---

### 2. **LAYOUT_ANALYSIS.md** 📖 COMPREHENSIVE
**Best for**: Deep understanding, design rationale, detailed explanations

**Contains**:
- Executive summary
- Detailed findings for each question (1-6)
- CSS layout classes breakdown with full context
- Flexbox computation mechanics
- Panel internal structure (header, body, footer)
- Visual layout tree (ASCII art)
- Key measurements reference table
- Implementation recommendations (3 options)
- Auto-save implementation code path
- Summary status table
- File references for all points

**When to use**:
- You need to understand the design deeply
- You're implementing a major feature (resize handle, responsive layout)
- You want to see all CSS properties and how they interact
- You need to teach someone else how the layout works

**Size**: 380 lines | **Time to read**: 15-20 minutes

---

### 3. **LAYOUT_VISUAL.txt** 🎨 VISUAL REFERENCE
**Best for**: Visual learners, ASCII diagrams, space calculations

**Contains**:
- Large ASCII viewport diagram
- Space breakdown examples (1440px, 768px, 375px viewports)
- Flexbox computation with annotations
- Detail panel internal structure tree
- Panel collapse state visualization
- Responsive behavior scenarios (4 different screen sizes)
- State flow diagram
- Interaction model (what users can/can't do)
- Animation timing details
- Key takeaways summary

**When to use**:
- You want to see the layout visually before diving into code
- You're explaining the layout to others
- You need to understand spacing calculations
- You're designing responsive breakpoints

**Size**: 317 lines | **Time to read**: 10-15 minutes

---

## 🎯 Quick Navigation by Question

### Q1: How does App.tsx render DtCanvas and DetailPanel side by side?

| Document | Section | Content |
|----------|---------|---------|
| **QUICK_REFERENCE** | Question 1 | JSX structure + mechanism explanation |
| **ANALYSIS** | Section 1 | Detailed layout structure with React hooks |
| **VISUAL** | "CURRENT STATE" diagram | Visual representation of side-by-side layout |

**Key Answer**: Pure Flexbox with responsive push layout
- Container: `.app-body { display: flex }`
- Canvas: `flex: 1` (grows)
- Panel: `width: 400px; flex-shrink: 0` (fixed)

---

### Q2: Look at CSS for `.app-body` and related layout classes

| Document | Section | Content |
|----------|---------|---------|
| **QUICK_REFERENCE** | Question 2 | CSS code blocks with all properties |
| **ANALYSIS** | Section 2 | Detailed explanation of 3 key classes |
| **VISUAL** | "FLEXBOX COMPUTATION" | Calculation explanation with annotations |

**Key Answer**: Three classes manage the layout
- `.app-body` (flex: 1, display: flex, overflow: hidden)
- `.canvas-wrap` (flex: 1, position: relative)
- `.detail-panel` (width: 400px, flex-shrink: 0, transition: 200ms)

---

### Q3: Existing drag/resize handle mechanism?

| Document | Section | Content |
|----------|---------|---------|
| **QUICK_REFERENCE** | Question 3 | Exact CSS + React code for toggle |
| **ANALYSIS** | Section 4 | Collapse vs resize distinction |
| **VISUAL** | "PANEL COLLAPSE STATE" | Visual toggle between 400px and 44px |

**Key Answer**: NO resize handle (only collapse toggle)
- ✓ Toggle button exists (.detail-panel__toggle)
- ✗ No drag/resize capability
- ✗ Only boolean state (collapsed: true/false)

---

### Q4: How does panel interact - overlay or push?

| Document | Section | Content |
|----------|---------|---------|
| **QUICK_REFERENCE** | Question 4 | Mechanism diagram + explanation |
| **ANALYSIS** | Section 3 | Technical "push" vs "overlay" details |
| **VISUAL** | "SPACE BREAKDOWN" | Space allocation visualization |

**Key Answer**: PUSH layout (canvas shrinks responsively)
- Canvas expands/shrinks based on panel presence
- When panel visible: Canvas = 100% - 400px
- When panel collapsed: Canvas = 100% - 44px

---

### Q5: Existing debounce utilities, auto-save patterns?

| Document | Section | Content |
|----------|---------|---------|
| **QUICK_REFERENCE** | Question 5 | Save handler code + what's missing |
| **ANALYSIS** | Section 5 | Current pattern explanation + network flow |
| **VISUAL** | "STATE FLOW" | User interaction → state changes → saves |

**Key Answer**: NO debounce (manual save only)
- ✓ Ctrl+S handler exists
- ✗ No auto-save with delay
- ✗ No debounce/throttle utilities
- ✗ Every operation refetches full tree

---

### Q6: State management for panel width?

| Document | Section | Content |
|----------|---------|---------|
| **QUICK_REFERENCE** | Question 6 | Missing state vs available pattern |
| **ANALYSIS** | Section 6 | Theme pattern example to follow |
| **VISUAL** | (N/A) | Focus on documents 1 & 2 |

**Key Answer**: NO width state (only boolean collapsed)
- Only: `const [panelCollapsed, setPanelCollapsed] = useState(false)`
- Missing: numeric `panelWidth` state, localStorage, CSS custom properties
- Pattern exists: App.tsx:11-26 shows how theme uses localStorage

---

## 🔍 Finding Code References

### By File Path

**App.tsx**:
- Lines 435-459: Main layout rendering
- Line 72: Selection state (selectedId)
- Line 76: Collapse state (panelCollapsed)
- Lines 11-26: Theme pattern (follow for width state)
- Line 454: Pass collapse state to DetailPanel

**DetailPanel.tsx**:
- Lines 51-72: Save handler (Ctrl+S trigger)
- Line 35: Dirty state declaration
- Line 49: markDirty() function
- Lines 83-91: Collapsed rendering

**tokens.css**:
- Lines 171-175: `.app-body` layout
- Lines 476-485: `.detail-panel` styling
- Lines 981-985: `.canvas-wrap` styling
- Lines 1278-1285: `.detail-panel--collapsed` state
- Lines 1290-1313: `.detail-panel__toggle` button

**useTree.ts**:
- Lines 53-75: Network pattern with refetch

### By Feature

**Flexbox Layout**:
- tokens.css: 171-175 (.app-body)
- tokens.css: 981-985 (.canvas-wrap)

**Fixed Panel Width**:
- tokens.css: 477-485, 1278-1285 (.detail-panel)

**Collapse Toggle**:
- tokens.css: 1290-1313 (CSS)
- App.tsx: 76, 454 (State)
- DetailPanel.tsx: 83-91 (Rendering)

**Save Logic**:
- DetailPanel.tsx: 51-72 (Ctrl+S handler)
- DetailPanel.tsx: 35, 49 (Dirty tracking)

**State Patterns**:
- App.tsx: 11-26 (Theme pattern - follow this for width)

---

## 💡 Implementation Guides

If you want to implement features, consult:

**Adding Resizable Panel Handle**:
1. Read: LAYOUT_ANALYSIS.md Section "Implementation Recommendations"
2. Reference: LAYOUT_QUICK_REFERENCE.md "Implementation Priority"
3. Understand: Canvas flex logic (LAYOUT_VISUAL "FLEXBOX COMPUTATION")

**Adding Auto-Save with Debounce**:
1. Read: LAYOUT_ANALYSIS.md "Auto-Save Implementation Path"
2. Reference: DetailPanel.tsx current save handler (lines 51-72)
3. Pattern: useRef + setTimeout debounce pattern shown

**Making Layout Responsive**:
1. Study: LAYOUT_VISUAL.txt "Responsive Behavior Scenarios"
2. Look at: LAYOUT_ANALYSIS.md "Implementation Recommendations" Option 3
3. Reference: App.tsx:11-26 (pattern for new hook)

---

## 🎓 Learning Path

**Beginner (Just need to know what exists)**:
1. Read: LAYOUT_QUICK_REFERENCE.md (5 min)
2. Done! You have all 6 answers

**Intermediate (Need to understand the design)**:
1. Skim: LAYOUT_VISUAL.txt "CURRENT STATE" diagram (2 min)
2. Read: LAYOUT_QUICK_REFERENCE.md (10 min)
3. Reference: LAYOUT_ANALYSIS.md Section 2 (CSS breakdown) (5 min)
4. Done! You understand the mechanics

**Advanced (Need to implement features)**:
1. Read: LAYOUT_VISUAL.txt (entire, 15 min) - understand design first
2. Study: LAYOUT_ANALYSIS.md (entire, 20 min) - detailed context
3. Reference: LAYOUT_QUICK_REFERENCE.md as needed - code locations
4. Jump to code: Use file:line references to examine actual implementation

---

## 📊 Quick Stats

| Aspect | Finding |
|--------|---------|
| **Layout Type** | Flexbox (flex-direction: row) |
| **Canvas Width** | flex: 1 (responsive) |
| **Panel Width** | 400px (fixed, flex-shrink: 0) |
| **Panel Collapsed** | 44px (CSS width transition 200ms) |
| **Overlay?** | No (pure push layout) |
| **Resize Handle** | ❌ Missing |
| **Auto-Save** | ❌ Missing (manual Ctrl+S) |
| **Debounce** | ❌ No utilities |
| **Width State** | ❌ No state (only collapsed boolean) |
| **localStorage** | ✓ Theme only (pattern exists) |

---

## 🔗 External References

- **React Documentation**: For hooks patterns (useState, useEffect, useCallback)
- **Flexbox Guide**: To understand flex: 1, flex-shrink properties
- **CSS Grid**: Alternative layout (not currently used)
- **React Flow**: Canvas library (DtCanvas uses @xyflow/react)

---

## 📝 Notes

- Analysis is **exhaustive** - covers all CSS, JavaScript, React mechanics
- Code references are **precise** - every point includes file:line numbers
- Documentation is **current** as of: May 17, 2026
- Diagrams use **ASCII art** - works in any text editor
- Examples show **actual code** - copy/paste ready where applicable

---

## ✅ Verification Checklist

After reading, you should understand:

- [ ] How Flexbox is used for side-by-side layout
- [ ] Why panel has `flex-shrink: 0`
- [ ] Why canvas has `flex: 1`
- [ ] What `.app-body { display: flex }` does
- [ ] How collapse works (width change, not drag)
- [ ] That there's NO resize handle
- [ ] That there's NO auto-save
- [ ] That there's NO debounce utilities
- [ ] That NO width state exists (only boolean)
- [ ] That localStorage is used for theme (pattern)

---

## 🆘 Quick Lookup Table

Need to find something? Use this:

```
Question about...        → Read First          → Then See
Layout structure         → QUICK_REFERENCE Q1  → VISUAL "CURRENT STATE"
CSS classes             → ANALYSIS Section 2   → tokens.css directly
Resize handle           → QUICK_REFERENCE Q3  → DetailPanel.tsx:83-91
Canvas/panel interaction → ANALYSIS Section 3  → QUICK_REFERENCE Q4
Auto-save patterns      → ANALYSIS Section 5  → DetailPanel.tsx:51-72
State management        → QUICK_REFERENCE Q6  → App.tsx:11-26
Implementation guide    → ANALYSIS "Recommendations" → QUICK_REFERENCE
Space calculations      → VISUAL "SPACE BREAKDOWN" → tokens.css values
Responsive design       → VISUAL "Responsive Behavior" → tokens.css @media
```

---

**📍 Documentation created**: 2026-05-17  
**📊 Files**: 3 markdown/text files, 1,056 total lines  
**🎯 Scope**: Exhaustive analysis of layout, CSS, state, and patterns  
**✨ Ready to use**: Copy paste code, follow patterns, implement features  

