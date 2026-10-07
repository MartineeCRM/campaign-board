# Campaign Funnel Board Implementation Plan

**Goal:** Build a Vite + React + TypeScript single-page app that recreates the "Campaign Funnel Board" design handoff (`/Users/aimed/Downloads/Campaign Funnel Board.zip`) pixel-for-pixel, with one deliberate deviation: campaign cards are freely drag-positioned (x/y) within their node's track instead of button-only top/bottom ordering.

**Architecture:** A single Zustand store (`src/store.ts`) owns all board data (clients → stages → nodes → campaigns) and view state (mode, edit, selection), persisted to `localStorage`. Presentational components read from the store via hooks and call store actions; none of them hold board data themselves. Business logic (formatting, card sizing, drag-position math, the live-data simulator) lives in small pure functions under `src/utils/`, each covered by a unit test. Presentational components (`Header`, `CampaignCard`, `NodeColumn`, etc.) are verified by rendering them with `npm run dev` and a short manual QA pass (listed in the final task) rather than exhaustive unit tests per visual branch — UI layout/drag feel is faster and more reliably checked by eye than by jsdom assertions.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Zustand 4, Vitest + @testing-library/react for tests. No backend, no auth, no real Braze API call in this phase — data is seeded, then simulated client-side on a timer, and persisted to `localStorage` under the key `funnelBoard.v1`, exactly as the design handoff's README specifies for the prototype. Wiring this to a real backend (Supabase, an authenticated multi-tenant store, a Braze-proxying sync job) is an explicit follow-up, not part of this plan.

**Out of scope (explicitly deferred, do not build in this plan):**
- Login / master account / multi-user access
- Any backend, database, or hosting
- Real Braze API calls (the "LIVE" data stays simulated, per the handoff README)
- Image upload via drag-and-drop/paste onto a card (the handoff's edit strip only has an image-URL text field — keep it that way for now)

---

## File Structure

```
campaign-board/
  index.html
  package.json
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    styles.css
    types.ts
    store.ts
    data/
      seed.ts
      seed.test.ts
    utils/
      uid.ts
      format.ts
      format.test.ts
      geometry.ts
      geometry.test.ts
      layout.ts
      layout.test.ts
    hooks/
      useCardDrag.ts
    components/
      Header.tsx
      Legend.tsx
      CampaignCard.tsx
      NodeColumn.tsx
      StageColumn.tsx
      AddStageButton.tsx
      FunnelBoard.tsx
      DetailPanel.tsx
```

Each component file owns exactly one of the regions described in the handoff README (Header = client block + stats + controls; FunnelBoard = the scrolling grid; NodeColumn = one node's spine segment + its two card tracks; CampaignCard = the card itself in all three visual states).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/styles.css`
- Create: `.gitignore`

> **Correction (found while verifying Task 7's build):** the original single `tsconfig.json` combined its own `compilerOptions` (including `noEmit: true`) with `references` to `tsconfig.node.json`. Running `tsc -b` on that shape fails with `TS6310: Referenced project '.../tsconfig.node.json' may not disable emit` — a project that both sets its own compiler options *and* references another project this way isn't valid in TS's build-mode graph. The fix (matching Vite's own official template) is to make `tsconfig.json` a pure solution file with no compiler options of its own, and move the app's real options into a new `tsconfig.app.json`. Steps 2–4 below already reflect the corrected three-file shape — build this task from them as written, not from the single-file version described anywhere else.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "campaign-funnel-board",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "eslint": "^9.12.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`** (a pure solution file — no compiler options of its own, just points `tsc -b` at the two real project configs)

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2b: Write `tsconfig.app.json`** (the real app config — composite, so it's a valid build target when referenced)

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Campaign Funnel Board</title>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `src/styles.css`**

```css
body {
  margin: 0;
  background: #f2f4f6;
  font-family: Pretendard, -apple-system, 'Apple SD Gothic Neo', sans-serif;
  color: #191f28;
}

a {
  color: #1a8a44;
}
a:hover {
  color: #126b33;
}

input,
select,
button {
  font-family: inherit;
}

@keyframes livePulse {
  0% {
    box-shadow: 0 0 0 0 rgba(26, 154, 74, 0.55);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(26, 154, 74, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(26, 154, 74, 0);
  }
}
```

- [ ] **Step 7: Write `src/main.tsx`** (placeholder `App` import; `App.tsx` is created in Task 8)

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 8: Write `.gitignore`**

```
node_modules
dist
.DS_Store
*.tsbuildinfo
vite.config.js
vite.config.d.ts
```

- [ ] **Step 9: Install dependencies**

Run: `cd /Users/aimed/Projects/campaign-board && npm install`
Expected: installs without error, creates `package-lock.json` and `node_modules/`.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html src/main.tsx src/styles.css .gitignore package-lock.json
git commit -m "chore: scaffold Vite + React + TypeScript + Vitest project"
```

---

### Task 2: Types and geometry utilities

**Files:**
- Create: `src/types.ts`
- Create: `src/utils/geometry.ts`
- Test: `src/utils/geometry.test.ts`

- [ ] **Step 1: Write `src/types.ts`**

```ts
export type LineStyle = 'solid' | 'dashed' | 'dotted'
export type Status = 'alwayson' | 'experiment' | 'stopped'
export type Channel = 'Push' | 'Kakao' | 'Email' | 'In-app' | 'SMS'
export type CardPos = 'top' | 'bottom'
export type Mode = 'full' | 'click'

export interface Campaign {
  id: string
  name: string
  channel: Channel
  status: Status
  pos: CardPos
  x: number
  y: number
  sent: number
  opens: number
  clicks: number
  convs: number
  rate: { o: number; c: number; v: number }
  period: string
  img?: string
  delivery: string
  trigger: string
  audience: string
  convEvent: string
  cap: string
  link: string
  brazeId?: string
}

export interface FunnelNode {
  id: string
  label: string
  sub: string
  line: LineStyle
  campaigns: Campaign[]
}

export interface Stage {
  id: string
  name: string
  color: string
  nodes: FunnelNode[]
}

export interface Client {
  id: string
  name: string
  stages: Stage[]
}

export interface BoardState {
  clients: Client[]
  clientId: string
  mode: Mode
  edit: boolean
  open: Record<string, boolean>
  sel: string | null
  sync: number
}
```

- [ ] **Step 2: Write the failing test for geometry helpers**

```ts
// src/utils/geometry.test.ts
import { describe, expect, it } from 'vitest'
import { clamp, clampCardPosition, posFromY, SPINE_Y, TRACK_HEIGHT, TRACK_WIDTH } from './geometry'

describe('clamp', () => {
  it('returns the value when inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })
  it('clamps below the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })
  it('clamps above the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('clampCardPosition', () => {
  it('keeps a position that fits inside the track', () => {
    const result = clampCardPosition(50, 50, 260, 160, TRACK_WIDTH)
    expect(result).toEqual({ x: 50, y: 50 })
  })
  it('clamps x so the card cannot leave the right edge', () => {
    const result = clampCardPosition(10000, 50, 260, 160, TRACK_WIDTH)
    expect(result.x).toBe(TRACK_WIDTH - 260)
  })
  it('clamps x to 0 on the left edge', () => {
    const result = clampCardPosition(-500, 50, 260, 160, TRACK_WIDTH)
    expect(result.x).toBe(0)
  })
  it('clamps y so the card cannot leave the bottom edge', () => {
    const result = clampCardPosition(10, 10000, 260, 160, TRACK_WIDTH)
    expect(result.y).toBe(TRACK_HEIGHT - 160)
  })
  it('clamps y to 0 on the top edge', () => {
    const result = clampCardPosition(10, -500, 260, 160, TRACK_WIDTH)
    expect(result.y).toBe(0)
  })
})

describe('posFromY', () => {
  it('is "top" when the card center sits above the spine', () => {
    expect(posFromY(SPINE_Y - 200, 160)).toBe('top')
  })
  it('is "bottom" when the card center sits below the spine', () => {
    expect(posFromY(SPINE_Y + 40, 160)).toBe('bottom')
  })
  it('is "bottom" exactly at the spine (center == SPINE_Y)', () => {
    expect(posFromY(SPINE_Y - 80, 160)).toBe('bottom')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/utils/geometry.test.ts`
Expected: FAIL — `Cannot find module './geometry'` (file does not exist yet).

- [ ] **Step 4: Write `src/utils/geometry.ts`**

```ts
// Node track geometry. Each node column renders one continuous vertical
// track; the spine sits at a fixed y inside it, and campaign cards are
// absolutely positioned (x, y) inside the track instead of the handoff's
// button-ordered top/bottom lists, per the "freeform placement" requirement.
export const TRACK_WIDTH = 400
export const TRACK_HEIGHT = 460
export const SPINE_Y = 230

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function clampCardPosition(
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  trackW: number
): { x: number; y: number } {
  return {
    x: clamp(x, 0, Math.max(0, trackW - cardW)),
    y: clamp(y, 0, Math.max(0, TRACK_HEIGHT - cardH)),
  }
}

export function posFromY(y: number, cardH: number): 'top' | 'bottom' {
  return y + cardH / 2 < SPINE_Y ? 'top' : 'bottom'
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/utils/geometry.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/utils/geometry.ts src/utils/geometry.test.ts
git commit -m "feat: add board types and node-track geometry helpers"
```

---

### Task 3: Formatting and card-width utilities

**Files:**
- Create: `src/utils/format.ts`
- Test: `src/utils/format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/format.test.ts
import { describe, expect, it } from 'vitest'
import { cardWidth, formatCount, pct } from './format'

describe('pct', () => {
  it('returns an em dash when the denominator is 0', () => {
    expect(pct(0, 0)).toBe('—')
  })
  it('formats a percentage to one decimal place', () => {
    expect(pct(50, 200)).toBe('25.0%')
  })
  it('rounds to one decimal place', () => {
    expect(pct(1, 3)).toBe('33.3%')
  })
})

describe('formatCount', () => {
  it('returns an em dash for 0', () => {
    expect(formatCount(0)).toBe('—')
  })
  it('formats with Korean locale thousands separators', () => {
    expect(formatCount(12480)).toBe('12,480')
  })
})

describe('cardWidth', () => {
  const base = { channel: 'Push', period: '상시', name: '가입 유도' }

  it('is a fixed 252px when collapsed, regardless of content', () => {
    expect(cardWidth(base, false)).toBe(252)
    expect(cardWidth({ channel: 'Email', period: '09.01–09.30', name: '아주 긴 캠페인 이름입니다 테스트' }, false)).toBe(252)
  })

  it('clamps to the 260px minimum for very short content', () => {
    expect(cardWidth({ channel: '', period: '상시', name: '가' }, true)).toBe(260)
  })

  it('clamps to the 380px maximum for very long content', () => {
    const longName = '아주 아주 아주 아주 아주 아주 긴 캠페인 이름 테스트 문자열입니다'
    expect(cardWidth({ channel: 'In-app', period: '09.01–12.31', name: longName }, true)).toBe(380)
  })

  it('does not count "상시" toward the period length', () => {
    const withShi = cardWidth({ channel: 'Push', period: '상시', name: '테스트 캠페인' }, true)
    const withoutPeriod = cardWidth({ channel: 'Push', period: '', name: '테스트 캠페인' }, true)
    expect(withShi).toBe(withoutPeriod)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/format.test.ts`
Expected: FAIL — `Cannot find module './format'`.

- [ ] **Step 3: Write `src/utils/format.ts`**

```ts
const HANGUL = /[ㄱ-힝]/

export function pct(count: number, total: number): string {
  return total ? (count / total * 100).toFixed(1) + '%' : '—'
}

export function formatCount(n: number): string {
  return n ? n.toLocaleString('ko-KR') : '—'
}

export function cardWidth(
  params: { channel: string; period: string; name: string },
  expanded: boolean
): number {
  if (!expanded) return 252
  const periodLen = params.period === '상시' ? 0 : params.period.length
  const nameWeight = [...params.name].reduce(
    (sum, ch) => sum + (HANGUL.test(ch) ? 15 : 8.5),
    0
  )
  const raw = 52 + params.channel.length * 7 + periodLen * 7 + nameWeight
  return Math.round(Math.min(380, Math.max(260, raw)))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/format.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/format.ts src/utils/format.test.ts
git commit -m "feat: add pct/formatCount/cardWidth formatting helpers"
```

---

### Task 4: Default card placement + uid

**Files:**
- Create: `src/utils/uid.ts`
- Create: `src/utils/layout.ts`
- Test: `src/utils/layout.test.ts`

- [ ] **Step 1: Write `src/utils/uid.ts`** (no test — trivial wrapper, exercised indirectly by every store test that creates an entity)

```ts
export function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}
```

- [ ] **Step 2: Write the failing test for default placement**

```ts
// src/utils/layout.test.ts
import { describe, expect, it } from 'vitest'
import { defaultCardPosition } from './layout'
import { SPINE_Y } from './geometry'

describe('defaultCardPosition', () => {
  it('places the first top card just above the spine', () => {
    const { y } = defaultCardPosition('top', 0)
    expect(y).toBeLessThan(SPINE_Y)
  })

  it('places the first bottom card just below the spine', () => {
    const { y } = defaultCardPosition('bottom', 0)
    expect(y).toBeGreaterThan(SPINE_Y)
  })

  it('stacks later top cards further from the spine (smaller y)', () => {
    const first = defaultCardPosition('top', 0)
    const second = defaultCardPosition('top', 1)
    expect(second.y).toBeLessThan(first.y)
  })

  it('stacks later bottom cards further from the spine (larger y)', () => {
    const first = defaultCardPosition('bottom', 0)
    const second = defaultCardPosition('bottom', 1)
    expect(second.y).toBeGreaterThan(first.y)
  })

  it('never returns a negative y', () => {
    const { y } = defaultCardPosition('top', 5)
    expect(y).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/utils/layout.test.ts`
Expected: FAIL — `Cannot find module './layout'`.

- [ ] **Step 4: Write `src/utils/layout.ts`**

```ts
import { SPINE_Y, TRACK_HEIGHT } from './geometry'
import type { CardPos } from '../types'

const GAP = 14
const CARD_HEIGHT_ESTIMATE = 160

/** Default (x, y) for a newly created card, stacking outward from the spine
 * so cards added one after another don't overlap. The user can drag the
 * card anywhere afterward. */
export function defaultCardPosition(pos: CardPos, indexInZone: number): { x: number; y: number } {
  const x = 16 + (indexInZone % 2) * 10
  if (pos === 'top') {
    const y = SPINE_Y - 30 - (indexInZone + 1) * (CARD_HEIGHT_ESTIMATE + GAP)
    return { x, y: Math.max(0, y) }
  }
  const y = SPINE_Y + 30 + indexInZone * (CARD_HEIGHT_ESTIMATE + GAP)
  return { x, y: Math.min(TRACK_HEIGHT - CARD_HEIGHT_ESTIMATE, y) }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/utils/layout.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/uid.ts src/utils/layout.ts src/utils/layout.test.ts
git commit -m "feat: add uid and default card placement helper"
```

---

### Task 5: Seed data

**Files:**
- Create: `src/data/seed.ts`
- Test: `src/data/seed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/data/seed.test.ts
import { describe, expect, it } from 'vitest'
import { seed } from './seed'

describe('seed', () => {
  it('returns two clients', () => {
    expect(seed()).toHaveLength(2)
  })

  it('gives every client, stage, node and campaign a unique id', () => {
    const ids = new Set<string>()
    const clients = seed()
    for (const client of clients) {
      ids.add(client.id)
      for (const stage of client.stages) {
        ids.add(stage.id)
        for (const node of stage.nodes) {
          ids.add(node.id)
          for (const campaign of node.campaigns) ids.add(campaign.id)
        }
      }
    }
    const total =
      clients.length +
      clients.reduce((a, c) => a + c.stages.length, 0) +
      clients.reduce((a, c) => a + c.stages.reduce((b, s) => b + s.nodes.length, 0), 0) +
      clients.reduce(
        (a, c) => a + c.stages.reduce((b, s) => b + s.nodes.reduce((d, n) => d + n.campaigns.length, 0), 0),
        0
      )
    expect(ids.size).toBe(total)
  })

  it('gives every campaign a pos consistent with its seeded x/y', () => {
    const clients = seed()
    for (const client of clients) {
      for (const stage of client.stages) {
        for (const node of stage.nodes) {
          for (const campaign of node.campaigns) {
            if (campaign.pos === 'top') expect(campaign.y).toBeLessThan(230)
            else expect(campaign.y).toBeGreaterThanOrEqual(230)
          }
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/seed.test.ts`
Expected: FAIL — `Cannot find module './seed'`.

- [ ] **Step 3: Write `src/data/seed.ts`**

```ts
import { uid } from '../utils/uid'
import { defaultCardPosition } from '../utils/layout'
import type { Campaign, Channel, Client, FunnelNode, LineStyle, Stage, Status } from '../types'

export const STAGE_PALETTE = [
  'oklch(0.56 0.14 150)',
  'oklch(0.56 0.14 240)',
  'oklch(0.56 0.14 295)',
  'oklch(0.56 0.14 190)',
  'oklch(0.58 0.15 10)',
  'oklch(0.56 0.14 340)',
]

interface CampaignSeed {
  name: string
  channel: Channel
  status: Status
  pos: 'top' | 'bottom'
  sent: number
  o: number
  c: number
  v: number
  period: string
  delivery: string
  trigger: string
  audience: string
  convEvent: string
  cap: string
  link: string
}

function campaign(seedData: CampaignSeed, indexInZone: number): Campaign {
  const { x, y } = defaultCardPosition(seedData.pos, indexInZone)
  return {
    id: uid(),
    name: seedData.name,
    channel: seedData.channel,
    status: seedData.status,
    pos: seedData.pos,
    x,
    y,
    sent: seedData.sent,
    opens: Math.round(seedData.sent * seedData.o),
    clicks: Math.round(seedData.sent * seedData.c),
    convs: Math.round(seedData.sent * seedData.v),
    rate: { o: seedData.o, c: seedData.c, v: seedData.v },
    period: seedData.period,
    delivery: seedData.delivery,
    trigger: seedData.trigger,
    audience: seedData.audience,
    convEvent: seedData.convEvent,
    cap: seedData.cap,
    link: seedData.link,
  }
}

function node(label: string, sub: string, line: LineStyle, campaigns: CampaignSeed[]): FunnelNode {
  const zoneCounts: Record<'top' | 'bottom', number> = { top: 0, bottom: 0 }
  return {
    id: uid(),
    label,
    sub,
    line,
    campaigns: campaigns.map((c) => campaign(c, zoneCounts[c.pos]++)),
  }
}

function stage(name: string, colorIndex: number, nodes: FunnelNode[]): Stage {
  return { id: uid(), name, color: STAGE_PALETTE[colorIndex % STAGE_PALETTE.length], nodes }
}

export function seed(): Client[] {
  const homeniq: Client = {
    id: uid(),
    name: '홈닉',
    stages: [
      stage('획득', 0, [
        node('앱 설치', 'app_install', 'solid', [
          {
            name: '설치 후 가입 유도 푸시',
            channel: 'Push',
            status: 'alwayson',
            pos: 'top',
            sent: 48210,
            o: 0.31,
            c: 0.09,
            v: 0.042,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '설치 후 24시간 내 미가입',
            audience: '설치 후 24시간 내 미가입',
            convEvent: 'sign_up',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
        node('회원가입', 'sign_up', 'solid', [
          {
            name: '가입 미완료 리마인드',
            channel: 'SMS',
            status: 'stopped',
            pos: 'top',
            sent: 9320,
            o: 0.41,
            c: 0.07,
            v: 0.03,
            period: '09.15–',
            delivery: 'Scheduled',
            trigger: '가입 시작 후 이탈',
            audience: '가입 시작 후 이탈',
            convEvent: 'verify_complex',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '가입 웰컴 메시지 D+0',
            channel: 'Kakao',
            status: 'alwayson',
            pos: 'bottom',
            sent: 21840,
            o: 0.62,
            c: 0.18,
            v: 0.11,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '신규 가입자',
            audience: '신규 가입자',
            convEvent: 'verify_complex',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('활성화', 1, [
        node('단지 인증', 'verify_complex', 'solid', [
          {
            name: '단지 인증 리마인드 D+1·D+3',
            channel: 'Push',
            status: 'alwayson',
            pos: 'top',
            sent: 15402,
            o: 0.28,
            c: 0.12,
            v: 0.064,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '가입 후 단지 미인증',
            audience: '가입 후 단지 미인증',
            convEvent: 'first_service',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '인증 혜택 안내 인앱',
            channel: 'In-app',
            status: 'experiment',
            pos: 'bottom',
            sent: 0,
            o: 0.3,
            c: 0.1,
            v: 0.05,
            period: '10.14 시작',
            delivery: 'Scheduled',
            trigger: '10.14 09:00 1회',
            audience: '단지 인증 완료 유저',
            convEvent: 'first_service',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
        node('첫 서비스 이용', 'first_service', 'solid', [
          {
            name: '첫 이용 가이드 이메일',
            channel: 'Email',
            status: 'alwayson',
            pos: 'bottom',
            sent: 11203,
            o: 0.24,
            c: 0.05,
            v: 0.021,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '인증 후 서비스 미이용',
            audience: '인증 후 서비스 미이용',
            convEvent: 'autopay_register',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('전환', 2, [
        node('관리비 자동납부 등록', 'autopay_register', 'solid', [
          {
            name: '자동납부 등록 혜택 안내',
            channel: 'Kakao',
            status: 'alwayson',
            pos: 'top',
            sent: 8840,
            o: 0.55,
            c: 0.14,
            v: 0.087,
            period: '10.01–10.31',
            delivery: 'Scheduled',
            trigger: '매월 고지일 10:00',
            audience: '관리비 고지 수신 · 자동납부 미등록',
            convEvent: 'facility_booking',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '관리비 고지 연계 푸시',
            channel: 'Push',
            status: 'stopped',
            pos: 'bottom',
            sent: 30110,
            o: 0.33,
            c: 0.11,
            v: 0.052,
            period: '09.01–09.30',
            delivery: 'Scheduled',
            trigger: '매월 고지일 10:00',
            audience: '관리비 고지 수신 유저',
            convEvent: 'facility_booking',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
        node('커뮤니티 시설 예약', 'facility_booking', 'dashed', [
          {
            name: '피트니스 예약 오픈 알림',
            channel: 'Push',
            status: 'experiment',
            pos: 'top',
            sent: 0,
            o: 0.3,
            c: 0.1,
            v: 0.05,
            period: '10.20 시작',
            delivery: 'Scheduled',
            trigger: '10.20 09:00 1회',
            audience: '피트니스 보유 단지 거주자',
            convEvent: 'monthly_active',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('유지', 3, [
        node('월간 재방문', 'monthly_active', 'solid', [
          {
            name: '월간 단지 소식 뉴스레터',
            channel: 'Email',
            status: 'alwayson',
            pos: 'bottom',
            sent: 40220,
            o: 0.21,
            c: 0.04,
            v: 0.015,
            period: '매월 1일',
            delivery: 'Scheduled',
            trigger: '매월 1일 10:00',
            audience: '전체 인증 유저',
            convEvent: 'dormant_30d',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('복귀', 4, [
        node('휴면 30일', 'dormant_30d', 'dotted', [
          {
            name: '휴면 복귀 쿠폰',
            channel: 'Kakao',
            status: 'alwayson',
            pos: 'top',
            sent: 6120,
            o: 0.48,
            c: 0.1,
            v: 0.038,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '30일 미접속',
            audience: '30일 미접속',
            convEvent: '',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '재방문 인앱 서베이',
            channel: 'In-app',
            status: 'stopped',
            pos: 'bottom',
            sent: 2210,
            o: 0.6,
            c: 0.2,
            v: 0.05,
            period: '09.20–',
            delivery: 'Scheduled',
            trigger: '휴면 후 복귀',
            audience: '휴면 후 복귀 유저',
            convEvent: '',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
    ],
  }

  const commerce: Client = {
    id: uid(),
    name: '샘플 커머스',
    stages: [
      stage('유입', 0, [
        node('첫 방문', 'first_visit', 'solid', [
          {
            name: '첫 방문 웰컴 쿠폰',
            channel: 'In-app',
            status: 'alwayson',
            pos: 'top',
            sent: 52300,
            o: 0.7,
            c: 0.22,
            v: 0.06,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '첫 방문',
            audience: '첫 방문',
            convEvent: 'view_item',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('탐색', 1, [
        node('상품 상세 조회', 'view_item', 'solid', []),
        node('장바구니 담기', 'add_to_cart', 'solid', [
          {
            name: '찜 상품 가격 인하 알림',
            channel: 'Push',
            status: 'alwayson',
            pos: 'bottom',
            sent: 18400,
            o: 0.35,
            c: 0.14,
            v: 0.07,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '찜 상품 가격 인하',
            audience: '찜 상품 가격 인하',
            convEvent: 'first_purchase',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('구매', 2, [
        node('첫 구매', 'first_purchase', 'solid', [
          {
            name: '첫 구매 감사 + 리뷰 요청',
            channel: 'Kakao',
            status: 'alwayson',
            pos: 'top',
            sent: 7200,
            o: 0.58,
            c: 0.2,
            v: 0.09,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '첫 구매 완료',
            audience: '첫 구매 완료',
            convEvent: 'second_purchase',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
      stage('재구매', 3, [
        node('2회 구매', 'second_purchase', 'solid', [
          {
            name: 'D+14 재구매 쿠폰',
            channel: 'SMS',
            status: 'experiment',
            pos: 'bottom',
            sent: 0,
            o: 0.4,
            c: 0.1,
            v: 0.05,
            period: '10.10 시작',
            delivery: 'Scheduled',
            trigger: '첫 구매 후 14일',
            audience: '첫 구매 후 14일 미재구매',
            convEvent: 'vip_tier',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
        node('VIP', 'vip_tier', 'dashed', []),
      ]),
      stage('이탈', 4, [
        node('장바구니 이탈', 'cart_abandon', 'dotted', [
          {
            name: '장바구니 이탈 리마인드 1h',
            channel: 'Push',
            status: 'alwayson',
            pos: 'top',
            sent: 12900,
            o: 0.3,
            c: 0.12,
            v: 0.08,
            period: '상시',
            delivery: 'Action-Based',
            trigger: '장바구니 담고 1시간 미구매',
            audience: '장바구니 담고 1시간 미구매',
            convEvent: 'first_purchase',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
          {
            name: '이탈 고객 이메일 D+1',
            channel: 'Email',
            status: 'stopped',
            pos: 'bottom',
            sent: 8800,
            o: 0.22,
            c: 0.06,
            v: 0.03,
            period: '08.01–09.30',
            delivery: 'Scheduled',
            trigger: '이탈 후 1일',
            audience: '이탈 고객',
            convEvent: 'first_purchase',
            cap: '7일 1회',
            link: 'https://dashboard.braze.com/',
          },
        ]),
      ]),
    ],
  }

  return [homeniq, commerce]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/data/seed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.ts src/data/seed.test.ts
git commit -m "feat: add seed data for two sample clients"
```

---

### Task 6: Store — client, stage and node actions

**Files:**
- Create: `src/store.ts`
- Test: `src/store.test.ts`

- [ ] **Step 1: Write the failing test (client/stage/node actions)**

```ts
// src/store.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore, STAGE_PALETTE } from './store'
import type { Client } from './types'

function fixtureClient(): Client {
  return {
    id: 'c1',
    name: 'Test Client',
    stages: [
      {
        id: 's1',
        name: 'Stage 1',
        color: STAGE_PALETTE[0],
        nodes: [
          {
            id: 'n1',
            label: 'Node 1',
            sub: 'evt_1',
            line: 'solid',
            campaigns: [
              {
                id: 'k1',
                name: 'Campaign 1',
                channel: 'Push',
                status: 'alwayson',
                pos: 'top',
                x: 10,
                y: 10,
                sent: 100,
                opens: 10,
                clicks: 5,
                convs: 1,
                rate: { o: 0.3, c: 0.1, v: 0.05 },
                period: '상시',
                delivery: 'Action-Based',
                trigger: 'evt_1',
                audience: '',
                convEvent: '',
                cap: '',
                link: '',
              },
            ],
          },
        ],
      },
      {
        id: 's2',
        name: 'Stage 2',
        color: STAGE_PALETTE[1],
        nodes: [{ id: 'n2', label: 'Node 2', sub: 'evt_2', line: 'solid', campaigns: [] }],
      },
    ],
  }
}

function resetStore() {
  useBoardStore.setState({
    clients: [fixtureClient()],
    clientId: 'c1',
    mode: 'full',
    edit: false,
    open: {},
    sel: null,
    sync: 0,
  })
}

beforeEach(resetStore)

describe('client actions', () => {
  it('currentClient returns the client matching clientId', () => {
    expect(useBoardStore.getState().currentClient().id).toBe('c1')
  })

  it('renameClient updates the current client name', () => {
    useBoardStore.getState().renameClient('New Name')
    expect(useBoardStore.getState().currentClient().name).toBe('New Name')
  })

  it('addClient appends a new client and switches to it in edit mode', () => {
    useBoardStore.getState().addClient()
    const state = useBoardStore.getState()
    expect(state.clients).toHaveLength(2)
    expect(state.clientId).toBe(state.clients[1].id)
    expect(state.edit).toBe(true)
  })

  it('deleteClient removes the current client and switches to the first remaining one', () => {
    useBoardStore.setState((s) => ({ clients: [...s.clients, { ...fixtureClient(), id: 'c2', name: 'Other' }] }))
    useBoardStore.getState().deleteClient()
    const state = useBoardStore.getState()
    expect(state.clients).toHaveLength(1)
    expect(state.clientId).toBe('c2')
  })

  it('deleteClient is a no-op when there is only one client', () => {
    useBoardStore.getState().deleteClient()
    expect(useBoardStore.getState().clients).toHaveLength(1)
  })
})

describe('stage actions', () => {
  it('addStage appends a stage with one empty node', () => {
    useBoardStore.getState().addStage()
    const stages = useBoardStore.getState().currentClient().stages
    expect(stages).toHaveLength(3)
    expect(stages[2].nodes).toHaveLength(1)
  })

  it('renameStage updates only the targeted stage', () => {
    useBoardStore.getState().renameStage('s1', 'Renamed')
    const stages = useBoardStore.getState().currentClient().stages
    expect(stages[0].name).toBe('Renamed')
    expect(stages[1].name).toBe('Stage 2')
  })

  it('cycleStageColor advances to the next palette color and wraps around', () => {
    useBoardStore.getState().cycleStageColor('s1')
    expect(useBoardStore.getState().currentClient().stages[0].color).toBe(STAGE_PALETTE[1])
    // one call already landed on index 1; five more (indices 2,3,4,5,0) completes the wrap
    STAGE_PALETTE.slice(1).forEach(() => useBoardStore.getState().cycleStageColor('s1'))
    expect(useBoardStore.getState().currentClient().stages[0].color).toBe(STAGE_PALETTE[0])
  })

  it('moveStage swaps a stage with its right neighbor', () => {
    useBoardStore.getState().moveStage('s1', 1)
    const stages = useBoardStore.getState().currentClient().stages
    expect(stages[0].id).toBe('s2')
    expect(stages[1].id).toBe('s1')
  })

  it('moveStage is a no-op past the last stage', () => {
    useBoardStore.getState().moveStage('s2', 1)
    const stages = useBoardStore.getState().currentClient().stages
    expect(stages.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('deleteStage removes the targeted stage', () => {
    useBoardStore.getState().deleteStage('s2')
    expect(useBoardStore.getState().currentClient().stages).toHaveLength(1)
  })
})

describe('node actions', () => {
  it('addNode unshifts a new node onto the targeted stage', () => {
    useBoardStore.getState().addNode('s1')
    const nodes = useBoardStore.getState().currentClient().stages[0].nodes
    expect(nodes).toHaveLength(2)
    expect(nodes[0].label).toBe('새 노드')
  })

  it('renameNode patches label and sub', () => {
    useBoardStore.getState().renameNode('n1', { label: 'New Label', sub: 'new_evt' })
    const node = useBoardStore.getState().currentClient().stages[0].nodes[0]
    expect(node.label).toBe('New Label')
    expect(node.sub).toBe('new_evt')
  })

  it('setNodeLine updates the line style', () => {
    useBoardStore.getState().setNodeLine('n1', 'dotted')
    expect(useBoardStore.getState().currentClient().stages[0].nodes[0].line).toBe('dotted')
  })

  it('insertNodeAfter inserts immediately after the targeted node', () => {
    useBoardStore.getState().insertNodeAfter('n1')
    const nodes = useBoardStore.getState().currentClient().stages[0].nodes
    expect(nodes).toHaveLength(2)
    expect(nodes[0].id).toBe('n1')
    expect(nodes[1].label).toBe('새 노드')
  })

  it('deleteNode removes the targeted node', () => {
    useBoardStore.getState().deleteNode('n1')
    expect(useBoardStore.getState().currentClient().stages[0].nodes).toHaveLength(0)
  })

  it('moveNode within a stage reorders nodes', () => {
    useBoardStore.getState().addNode('s1')
    const nodes = useBoardStore.getState().currentClient().stages[0].nodes
    const newNodeId = nodes[0].id // unshifted, now first
    useBoardStore.getState().moveNode('s1', newNodeId, 1)
    const after = useBoardStore.getState().currentClient().stages[0].nodes
    expect(after[1].id).toBe(newNodeId)
  })

  it('moveNode crosses into the previous stage when moved left past the first node', () => {
    useBoardStore.getState().moveNode('s2', 'n2', -1)
    const stages = useBoardStore.getState().currentClient().stages
    expect(stages[0].nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(stages[1].nodes).toHaveLength(0)
  })

  it('moveNode crosses into the next stage when moved right past the last node', () => {
    useBoardStore.getState().moveNode('s1', 'n1', 1)
    const stages = useBoardStore.getState().currentClient().stages
    expect(stages[0].nodes).toHaveLength(0)
    // crossing right lands the node at the START of the next stage (unshift) —
    // the mirror of crossing left landing it at the END of the previous stage (push)
    expect(stages[1].nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store.test.ts`
Expected: FAIL — `Cannot find module './store'`.

- [ ] **Step 3: Write `src/store.ts`** (client/stage/node section — campaign actions and persistence are added in Task 7)

```ts
import { create } from 'zustand'
import type { BoardState, Client, FunnelNode } from './types'
import { uid } from './utils/uid'
import { seed, STAGE_PALETTE as SEED_PALETTE } from './data/seed'

export const STAGE_PALETTE = SEED_PALETTE

export function loadInitialState(): Pick<BoardState, 'clients' | 'clientId' | 'mode'> {
  try {
    const raw = localStorage.getItem('funnelBoard.v1')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.clients?.length) {
        return {
          clients: parsed.clients,
          clientId: parsed.clientId ?? parsed.clients[0].id,
          mode: parsed.mode ?? 'full',
        }
      }
    }
  } catch {
    // corrupt or unavailable storage — fall through to seed data
  }
  const clients = seed()
  return { clients, clientId: clients[0].id, mode: 'full' }
}

function emptyNode(): FunnelNode {
  return { id: uid(), label: '새 노드', sub: 'event_name', line: 'solid', campaigns: [] }
}

function withClient(state: BoardState, fn: (client: Client) => void): Pick<BoardState, 'clients'> {
  const clients = state.clients.map((c) => {
    if (c.id !== state.clientId) return c
    const copy: Client = structuredClone(c)
    fn(copy)
    return copy
  })
  return { clients }
}

export interface BoardStore extends BoardState {
  currentClient: () => Client
  setMode: (mode: BoardState['mode']) => void
  toggleEdit: () => void
  selectCampaign: (id: string | null) => void
  toggleOpen: (id: string) => void
  setClient: (id: string) => void
  addClient: () => void
  deleteClient: () => void
  renameClient: (name: string) => void
  addStage: () => void
  renameStage: (stageId: string, name: string) => void
  cycleStageColor: (stageId: string) => void
  moveStage: (stageId: string, dir: -1 | 1) => void
  deleteStage: (stageId: string) => void
  addNode: (stageId: string) => void
  renameNode: (nodeId: string, patch: Partial<Pick<FunnelNode, 'label' | 'sub'>>) => void
  setNodeLine: (nodeId: string, line: FunnelNode['line']) => void
  moveNode: (stageId: string, nodeId: string, dir: -1 | 1) => void
  insertNodeAfter: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
}

const initial = loadInitialState()

export const useBoardStore = create<BoardStore>((set, get) => ({
  clients: initial.clients,
  clientId: initial.clientId,
  mode: initial.mode,
  edit: false,
  open: {},
  sel: null,
  sync: Date.now(),

  currentClient: () => {
    const s = get()
    return s.clients.find((c) => c.id === s.clientId) ?? s.clients[0]
  },

  setMode: (mode) => set({ mode, open: {} }),
  toggleEdit: () => set((s) => ({ edit: !s.edit })),
  selectCampaign: (id) => set({ sel: id }),
  toggleOpen: (id) => set((s) => ({ open: { ...s.open, [id]: !s.open[id] } })),

  setClient: (id) => set({ clientId: id, open: {}, sel: null }),
  addClient: () => {
    const id = uid()
    const client: Client = {
      id,
      name: '새 고객사',
      stages: [{ id: uid(), name: '획득', color: STAGE_PALETTE[0], nodes: [emptyNode()] }],
    }
    set((s) => ({ clients: [...s.clients, client], clientId: id, edit: true }))
  },
  deleteClient: () =>
    set((s) => {
      if (s.clients.length <= 1) return s
      const clients = s.clients.filter((c) => c.id !== s.clientId)
      return { clients, clientId: clients[0].id }
    }),
  renameClient: (name) => set((s) => withClient(s, (c) => { c.name = name })),

  addStage: () =>
    set((s) =>
      withClient(s, (c) => {
        c.stages.push({
          id: uid(),
          name: '새 단계',
          color: STAGE_PALETTE[c.stages.length % STAGE_PALETTE.length],
          nodes: [emptyNode()],
        })
      })
    ),
  renameStage: (stageId, name) =>
    set((s) =>
      withClient(s, (c) => {
        const st = c.stages.find((x) => x.id === stageId)
        if (st) st.name = name
      })
    ),
  cycleStageColor: (stageId) =>
    set((s) =>
      withClient(s, (c) => {
        const st = c.stages.find((x) => x.id === stageId)
        if (!st) return
        const i = STAGE_PALETTE.indexOf(st.color)
        st.color = STAGE_PALETTE[(i + 1) % STAGE_PALETTE.length]
      })
    ),
  moveStage: (stageId, dir) =>
    set((s) =>
      withClient(s, (c) => {
        const i = c.stages.findIndex((x) => x.id === stageId)
        const j = i + dir
        if (i === -1 || j < 0 || j >= c.stages.length) return
        const [st] = c.stages.splice(i, 1)
        c.stages.splice(j, 0, st)
      })
    ),
  deleteStage: (stageId) =>
    set((s) =>
      withClient(s, (c) => {
        c.stages = c.stages.filter((x) => x.id !== stageId)
      })
    ),

  addNode: (stageId) =>
    set((s) =>
      withClient(s, (c) => {
        const st = c.stages.find((x) => x.id === stageId)
        if (st) st.nodes.unshift(emptyNode())
      })
    ),
  renameNode: (nodeId, patch) =>
    set((s) =>
      withClient(s, (c) => {
        for (const st of c.stages) {
          const n = st.nodes.find((x) => x.id === nodeId)
          if (n) {
            Object.assign(n, patch)
            return
          }
        }
      })
    ),
  setNodeLine: (nodeId, line) =>
    set((s) =>
      withClient(s, (c) => {
        for (const st of c.stages) {
          const n = st.nodes.find((x) => x.id === nodeId)
          if (n) {
            n.line = line
            return
          }
        }
      })
    ),
  moveNode: (stageId, nodeId, dir) =>
    set((s) =>
      withClient(s, (c) => {
        const si = c.stages.findIndex((x) => x.id === stageId)
        if (si === -1) return
        const st = c.stages[si]
        const ni = st.nodes.findIndex((x) => x.id === nodeId)
        if (ni === -1) return
        const [node] = st.nodes.splice(ni, 1)
        let target = ni + dir
        if (target < 0) {
          if (si > 0) {
            c.stages[si - 1].nodes.push(node)
            return
          }
          target = 0
        }
        if (target > st.nodes.length) {
          if (si < c.stages.length - 1) {
            c.stages[si + 1].nodes.unshift(node)
            return
          }
          target = st.nodes.length
        }
        st.nodes.splice(target, 0, node)
      })
    ),
  insertNodeAfter: (nodeId) =>
    set((s) =>
      withClient(s, (c) => {
        for (const st of c.stages) {
          const ni = st.nodes.findIndex((x) => x.id === nodeId)
          if (ni !== -1) {
            st.nodes.splice(ni + 1, 0, emptyNode())
            return
          }
        }
      })
    ),
  deleteNode: (nodeId) =>
    set((s) =>
      withClient(s, (c) => {
        for (const st of c.stages) {
          const ni = st.nodes.findIndex((x) => x.id === nodeId)
          if (ni !== -1) {
            st.nodes.splice(ni, 1)
            return
          }
        }
      })
    ),
}))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/store.test.ts`
Expected: PASS (19 tests). Note: `structuredClone` requires Node 17+ or a modern browser; both the Vite dev server's browser target and Vitest's Node runtime satisfy this.

- [ ] **Step 5: Commit**

```bash
git add src/store.ts src/store.test.ts
git commit -m "feat: add board store with client, stage and node actions"
```

---

### Task 7: Store — campaign actions, live simulation, persistence

**Files:**
- Modify: `src/store.ts`
- Modify: `src/store.test.ts`

- [ ] **Step 1: Append the failing tests for campaign actions, `simulateTick` and persistence**

```ts
// append to src/store.test.ts
import { saveState, simulateTick } from './store'

describe('campaign actions', () => {
  it('addCampaign appends a campaign positioned in the requested zone', () => {
    useBoardStore.getState().addCampaign('n1', 'bottom')
    const node = useBoardStore.getState().currentClient().stages[0].nodes[0]
    expect(node.campaigns).toHaveLength(2)
    const added = node.campaigns[1]
    expect(added.pos).toBe('bottom')
    expect(added.y).toBeGreaterThanOrEqual(230)
  })

  it('updateCampaign patches fields by id, regardless of which stage/node it is in', () => {
    useBoardStore.getState().updateCampaign('k1', { name: 'Renamed Campaign', status: 'stopped' })
    const campaign = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(campaign.name).toBe('Renamed Campaign')
    expect(campaign.status).toBe('stopped')
  })

  it('moveCampaignTo clamps position and flips pos to bottom when dragged past the spine', () => {
    useBoardStore.getState().moveCampaignTo('k1', 20, 300, 260, 160, 400)
    const campaign = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(campaign.pos).toBe('bottom')
    expect(campaign.x).toBe(20)
    expect(campaign.y).toBe(300)
  })

  it('moveCampaignTo clamps x/y to the track bounds', () => {
    useBoardStore.getState().moveCampaignTo('k1', 99999, -500, 260, 160, 400)
    const campaign = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(campaign.x).toBe(400 - 260)
    expect(campaign.y).toBe(0)
  })

  it('deleteCampaign removes the campaign by id', () => {
    useBoardStore.getState().deleteCampaign('k1')
    expect(useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns).toHaveLength(0)
  })
})

describe('simulateTick', () => {
  it('leaves a stopped campaign untouched', () => {
    const stopped = fixtureClient().stages[0].nodes[0].campaigns[0]
    stopped.status = 'stopped'
    expect(simulateTick(stopped)).toEqual(stopped)
  })

  it('increases sent by between 3 and 38 for a non-stopped campaign', () => {
    const campaign = fixtureClient().stages[0].nodes[0].campaigns[0]
    const result = simulateTick(campaign)
    const delta = result.sent - campaign.sent
    expect(delta).toBeGreaterThanOrEqual(3)
    expect(delta).toBeLessThanOrEqual(38)
  })

  it('never decreases opens, clicks or convs', () => {
    const campaign = fixtureClient().stages[0].nodes[0].campaigns[0]
    const result = simulateTick(campaign)
    expect(result.opens).toBeGreaterThanOrEqual(campaign.opens)
    expect(result.clicks).toBeGreaterThanOrEqual(campaign.clicks)
    expect(result.convs).toBeGreaterThanOrEqual(campaign.convs)
  })
})

describe('tick action', () => {
  it('advances sync and increments sent for the current client only', () => {
    useBoardStore.setState((s) => ({
      clients: [...s.clients, { ...fixtureClient(), id: 'c2', name: 'Other' }],
    }))
    const before = useBoardStore.getState().clients[1].stages[0].nodes[0].campaigns[0].sent
    useBoardStore.getState().tick()
    const state = useBoardStore.getState()
    expect(state.sync).toBeGreaterThan(0)
    expect(state.currentClient().stages[0].nodes[0].campaigns[0].sent).toBeGreaterThan(100)
    // the client that is NOT selected must be untouched
    expect(state.clients[1].stages[0].nodes[0].campaigns[0].sent).toBe(before)
  })
})

describe('persistence', () => {
  it('saveState writes clients, clientId and mode under funnelBoard.v1', () => {
    const state = useBoardStore.getState()
    saveState(state)
    const raw = JSON.parse(localStorage.getItem('funnelBoard.v1')!)
    expect(raw.clientId).toBe(state.clientId)
    expect(raw.mode).toBe(state.mode)
    expect(raw.clients).toHaveLength(state.clients.length)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store.test.ts`
Expected: FAIL — `addCampaign is not a function` (and friends; `saveState`/`simulateTick` not exported yet).

- [ ] **Step 3: Extend `src/store.ts`** — add the imports, the two new exported functions, the campaign actions and the `tick` action, and wire up persistence.

Add these imports at the top (next to the existing ones):

```ts
import { defaultCardPosition } from './utils/layout'
import { clampCardPosition, posFromY } from './utils/geometry'
import type { Campaign, CardPos } from './types'
```

Add these two exported functions above `const initial = loadInitialState()`:

```ts
export function saveState(state: Pick<BoardState, 'clients' | 'clientId' | 'mode'>): void {
  try {
    localStorage.setItem(
      'funnelBoard.v1',
      JSON.stringify({ clients: state.clients, clientId: state.clientId, mode: state.mode })
    )
  } catch {
    // storage unavailable (private browsing, quota) — simulated data just won't persist
  }
}

export function simulateTick(campaign: Campaign): Campaign {
  if (campaign.status === 'stopped') return campaign
  const add = 3 + Math.floor(Math.random() * 36)
  const jitter = (rate: number) => Math.max(0, Math.round(add * rate * (0.6 + Math.random() * 0.8)))
  return {
    ...campaign,
    sent: campaign.sent + add,
    opens: campaign.opens + jitter(campaign.rate.o),
    clicks: campaign.clicks + jitter(campaign.rate.c),
    convs: campaign.convs + jitter(campaign.rate.v),
  }
}

function findCampaignLocation(client: Client, campaignId: string) {
  for (let si = 0; si < client.stages.length; si++) {
    for (let ni = 0; ni < client.stages[si].nodes.length; ni++) {
      const ci = client.stages[si].nodes[ni].campaigns.findIndex((c) => c.id === campaignId)
      if (ci !== -1) return { si, ni, ci }
    }
  }
  return null
}
```

Add these fields to the `BoardStore` interface, after `deleteNode`:

```ts
  addCampaign: (nodeId: string, pos: CardPos) => void
  updateCampaign: (campaignId: string, patch: Partial<Campaign>) => void
  moveCampaignTo: (campaignId: string, x: number, y: number, cardW: number, cardH: number, trackW: number) => void
  deleteCampaign: (campaignId: string) => void
  tick: () => void
```

Add these actions to the `create<BoardStore>((set, get) => ({ ... }))` object, after `deleteNode`:

```ts
  addCampaign: (nodeId, pos) =>
    set((s) =>
      withClient(s, (c) => {
        for (const st of c.stages) {
          const node = st.nodes.find((x) => x.id === nodeId)
          if (!node) continue
          const indexInZone = node.campaigns.filter((k) => k.pos === pos).length
          const { x, y } = defaultCardPosition(pos, indexInZone)
          node.campaigns.push({
            id: uid(),
            name: '새 캠페인',
            channel: 'Push',
            status: 'experiment',
            pos,
            x,
            y,
            sent: 0,
            opens: 0,
            clicks: 0,
            convs: 0,
            rate: { o: 0.3, c: 0.1, v: 0.05 },
            period: '',
            delivery: 'Action-Based',
            trigger: node.sub,
            audience: '',
            convEvent: '',
            cap: '',
            link: '',
          })
          return
        }
      })
    ),
  updateCampaign: (campaignId, patch) =>
    set((s) =>
      withClient(s, (c) => {
        const loc = findCampaignLocation(c, campaignId)
        if (!loc) return
        Object.assign(c.stages[loc.si].nodes[loc.ni].campaigns[loc.ci], patch)
      })
    ),
  moveCampaignTo: (campaignId, x, y, cardW, cardH, trackW) =>
    set((s) =>
      withClient(s, (c) => {
        const loc = findCampaignLocation(c, campaignId)
        if (!loc) return
        const campaign = c.stages[loc.si].nodes[loc.ni].campaigns[loc.ci]
        const clamped = clampCardPosition(x, y, cardW, cardH, trackW)
        campaign.x = clamped.x
        campaign.y = clamped.y
        campaign.pos = posFromY(clamped.y, cardH)
      })
    ),
  deleteCampaign: (campaignId) =>
    set((s) =>
      withClient(s, (c) => {
        const loc = findCampaignLocation(c, campaignId)
        if (!loc) return
        c.stages[loc.si].nodes[loc.ni].campaigns.splice(loc.ci, 1)
      })
    ),
  tick: () =>
    set((s) => ({
      sync: Date.now(),
      ...withClient(s, (c) => {
        for (const st of c.stages) {
          for (const n of st.nodes) {
            n.campaigns = n.campaigns.map(simulateTick)
          }
        }
      }),
    })),
```

Finally, at the very bottom of the file, after the `create<BoardStore>(...)` call, subscribe to persist every change:

```ts
useBoardStore.subscribe((state) => saveState(state))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/store.test.ts`
Expected: PASS (29 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/store.ts src/store.test.ts
git commit -m "feat: add campaign actions, live-data simulation and localStorage persistence"
```

---

### Task 8: App shell

From here on, components are verified by running the dev server and checking them against the handoff's `design/Campaign Funnel Board.dc.html` (open it directly in a browser — it's a working HTML file) rather than by unit test, per the testing strategy in the Architecture section above.

**Files:**
- Create: `src/App.tsx`

- [ ] **Step 1: Write `src/App.tsx`** (renders only a placeholder for now; filled in across Tasks 9–13)

```tsx
import { useEffect } from 'react'
import { useBoardStore } from './store'

export default function App() {
  const tick = useBoardStore((s) => s.tick)

  useEffect(() => {
    const id = setInterval(tick, 2500)
    return () => clearInterval(id)
  }, [tick])

  return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>Loading board…</div>
}
```

- [ ] **Step 2: Verify it runs**

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`); opening it shows "Loading board…" with no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add App shell with the live-data tick interval"
```

---

### Task 9: Header and Legend components

**Files:**
- Create: `src/components/Header.tsx`
- Create: `src/components/Legend.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write `src/components/Header.tsx`**

```tsx
import { useBoardStore } from '../store'
import type { Status } from '../types'

const STATUS_META: Record<Status, { label: string; color: string }> = {
  alwayson: { label: 'Always-On', color: '#1a9a4a' },
  experiment: { label: 'Experiment', color: '#3182f6' },
  stopped: { label: 'Stopped', color: '#8b95a1' },
}

export default function Header() {
  const edit = useBoardStore((s) => s.edit)
  const mode = useBoardStore((s) => s.mode)
  const sync = useBoardStore((s) => s.sync)
  const clients = useBoardStore((s) => s.clients)
  const clientId = useBoardStore((s) => s.clientId)
  const client = useBoardStore((s) => s.currentClient())
  const renameClient = useBoardStore((s) => s.renameClient)
  const setClient = useBoardStore((s) => s.setClient)
  const addClient = useBoardStore((s) => s.addClient)
  const deleteClient = useBoardStore((s) => s.deleteClient)
  const setMode = useBoardStore((s) => s.setMode)
  const toggleEdit = useBoardStore((s) => s.toggleEdit)

  const counts: Record<Status, number> = { alwayson: 0, experiment: 0, stopped: 0 }
  for (const stage of client.stages) {
    for (const node of stage.nodes) {
      for (const campaign of node.campaigns) counts[campaign.status]++
    }
  }

  const syncTime = new Date(sync).toLocaleTimeString('ko-KR', { hour12: false })
  const segBtn = (active: boolean) => ({
    fontSize: 12,
    fontWeight: 600 as const,
    padding: '7px 12px',
    border: 0,
    borderRadius: 8,
    cursor: 'pointer' as const,
    background: active ? '#fff' : 'transparent',
    boxShadow: active ? '0 1px 4px rgba(0,20,60,.1)' : 'none',
    color: active ? '#191f28' : '#8b95a1',
  })

  return (
    <header
      style={{
        background: '#fff',
        padding: '28px 40px 24px',
        boxShadow: '0 1px 0 rgba(0,20,60,.05)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px 48px',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {edit ? (
          <input
            value={client.name}
            onChange={(e) => renameClient(e.target.value)}
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '-.03em',
              padding: '2px 8px',
              border: '1px solid #e5e8eb',
              borderRadius: 8,
              width: 220,
              color: '#191f28',
            }}
          />
        ) : (
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.2 }}>
            {client.name}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#8b95a1' }}>
          <span>동기화 {syncTime}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 36px', alignItems: 'baseline' }}>
        {(Object.keys(STATUS_META) as Status[]).map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                alignSelf: 'center',
                background: STATUS_META[key].color,
              }}
            />
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {counts[key]}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#4e5968' }}>{STATUS_META[key].label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select
          value={clientId}
          onChange={(e) => (e.target.value === '__new' ? addClient() : setClient(e.target.value))}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 14px',
            border: 0,
            borderRadius: 10,
            background: '#f2f4f6',
            color: '#191f28',
            cursor: 'pointer',
          }}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__new">+ 새 고객사</option>
        </select>

        <div style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 12, background: '#f2f4f6' }}>
          <button onClick={() => setMode('full')} style={segBtn(mode === 'full')}>
            전체 노출
          </button>
          <button onClick={() => setMode('click')} style={segBtn(mode === 'click')}>
            클릭 노출
          </button>
        </div>

        <button
          onClick={toggleEdit}
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: '10px 18px',
            border: 0,
            borderRadius: 10,
            color: '#fff',
            cursor: 'pointer',
            background: edit ? '#3182f6' : '#191f28',
          }}
        >
          {edit ? '편집 완료' : '편집'}
        </button>

        {edit && clients.length > 1 && (
          <button
            onClick={deleteClient}
            style={{
              fontSize: 12,
              padding: '7px 10px',
              border: 0,
              color: '#f04452',
              background: '#fff0f1',
              fontWeight: 600,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            고객사 삭제
          </button>
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Write `src/components/Legend.tsx`**

```tsx
const ITEMS: { style: React.CSSProperties; label: string }[] = [
  { style: { borderTop: '2px solid #b0b8c1' }, label: '실선 · 핵심 경로' },
  { style: { borderTop: '2px dashed #b0b8c1' }, label: '점선 · 선택 경로' },
  { style: { borderTop: '3px dotted #b0b8c1' }, label: '점점선 · 이탈/복귀' },
]

export default function Legend() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px 28px',
        alignItems: 'center',
        padding: '24px 48px 0',
        fontSize: 12,
        color: '#8b95a1',
      }}
    >
      {ITEMS.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, ...item.style }} />
          {item.label}
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginLeft: 'auto',
          fontWeight: 600,
          color: '#1a8a44',
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#1a9a4a',
            animation: 'livePulse 1.6s infinite',
          }}
        />
        캠페인 데이터 실시간 연동
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire both into `src/App.tsx`**

```tsx
import { useEffect } from 'react'
import { useBoardStore } from './store'
import Header from './components/Header'
import Legend from './components/Legend'

export default function App() {
  const tick = useBoardStore((s) => s.tick)

  useEffect(() => {
    const id = setInterval(tick, 2500)
    return () => clearInterval(id)
  }, [tick])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <Legend />
    </div>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev` (if not already running)
Expected, comparing against `design/Campaign Funnel Board.dc.html`: client name "홈닉", three status counts, client select with "+ 새 고객사", the "전체 노출 / 클릭 노출" segmented control, "편집" button, and the three-line-style legend with the pulsing green "실시간 연동" indicator on the right. Clicking "편집" turns it into "편집 완료" (blue) and turns the client name into an editable input.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/Legend.tsx src/App.tsx
git commit -m "feat: add Header and Legend components"
```

---

### Task 10: CampaignCard component

**Files:**
- Create: `src/components/CampaignCard.tsx`

- [ ] **Step 1: Write `src/components/CampaignCard.tsx`**

```tsx
import { useBoardStore } from '../store'
import { cardWidth, formatCount, pct } from '../utils/format'
import type { Campaign, Channel, Status } from '../types'

const STATUS_META: Record<Status, { label: string; color: string }> = {
  alwayson: { label: 'Always-On', color: '#1a9a4a' },
  experiment: { label: 'Experiment', color: '#3182f6' },
  stopped: { label: 'Stopped', color: '#8b95a1' },
}
const CHANNELS: Channel[] = ['Push', 'Kakao', 'Email', 'In-app', 'SMS']

interface Props {
  campaign: Campaign
  expanded: boolean
  notchTop: boolean
  notchBottom: boolean
}

export default function CampaignCard({ campaign: k, expanded, notchTop, notchBottom }: Props) {
  const edit = useBoardStore((s) => s.edit)
  const mode = useBoardStore((s) => s.mode)
  const toggleOpen = useBoardStore((s) => s.toggleOpen)
  const selectCampaign = useBoardStore((s) => s.selectCampaign)
  const updateCampaign = useBoardStore((s) => s.updateCampaign)
  const deleteCampaign = useBoardStore((s) => s.deleteCampaign)

  const status = STATUS_META[k.status]
  const isLive = k.status !== 'stopped'
  const width = cardWidth({ channel: k.channel, period: k.period, name: k.name }, expanded)

  const open = () => {
    if (mode === 'click' && !expanded) toggleOpen(k.id)
    else selectCampaign(k.id)
  }

  const collapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleOpen(k.id)
  }

  const notch = (
    <>
      {notchBottom && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -6,
            width: 11,
            height: 11,
            marginLeft: -6,
            background: '#fff',
            transform: 'rotate(45deg)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}
      {notchTop && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -6,
            width: 11,
            height: 11,
            marginLeft: -6,
            background: '#fff',
            transform: 'rotate(45deg)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  )

  if (!expanded) {
    return (
      <div style={{ position: 'relative', width }}>
        <div
          onClick={open}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            borderRadius: 14,
            padding: '12px 14px',
            cursor: 'pointer',
            boxSizing: 'border-box',
            boxShadow: '0 2px 10px rgba(0,20,60,.06)',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: status.color }} />
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {k.name}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {pct(k.convs, k.sent)}
          </div>
          <div style={{ fontSize: 10.5, color: '#6f6f6d' }}>{k.channel}</div>
        </div>
        {notch}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width }}>
      <div
        onClick={open}
        style={{
          background: '#fff',
          borderRadius: 18,
          padding: '16px 18px 14px',
          boxShadow: '0 4px 18px rgba(0,20,60,.06)',
          boxSizing: 'border-box',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          {isLive && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px 3px 7px',
                borderRadius: 999,
                background: '#e9f7ef',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.04em',
                color: '#1a8a44',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#1a9a4a',
                  animation: 'livePulse 1.6s infinite',
                }}
              />
              LIVE
            </div>
          )}
          <div
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              background: '#f2f4f6',
              fontSize: 10,
              fontWeight: 700,
              color: status.color,
            }}
          >
            {status.label}
          </div>
          {mode === 'click' && (
            <button
              onClick={collapse}
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                border: 0,
                borderRadius: 999,
                background: '#f2f4f6',
                color: '#8b95a1',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              접기
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div
            style={{
              flex: 'none',
              marginTop: 1,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '.04em',
              padding: '3px 7px',
              borderRadius: 6,
              background: '#f2f4f6',
              color: '#4e5968',
            }}
          >
            {k.channel}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-.01em' }}>
            {k.name}
          </div>
          {k.period !== '상시' && (
            <div style={{ flex: 'none', marginTop: 2, fontSize: 11, color: '#8b95a1' }}>{k.period}</div>
          )}
        </div>

        {k.img ? (
          <img
            src={k.img}
            alt=""
            style={{
              display: 'block',
              marginTop: 12,
              width: '100%',
              height: 'auto',
              maxHeight: 360,
              objectFit: 'cover',
              borderRadius: 12,
              background: '#f2f4f6',
            }}
          />
        ) : (
          <div
            style={{
              marginTop: 12,
              height: 112,
              borderRadius: 12,
              background: 'repeating-linear-gradient(135deg,#f5f6f8 0 8px,#eceef1 8px 16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 11,
              color: '#8b95a1',
            }}
          >
            캠페인 이미지
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            background: '#f9fafb',
            display: 'grid',
            gridTemplateColumns: '1.35fr 1fr 1fr 1fr',
            gap: 8,
          }}
        >
          {[
            ['발송', formatCount(k.sent)],
            ['오픈율', pct(k.opens, k.sent)],
            ['클릭률', pct(k.clicks, k.sent)],
            ['전환율', pct(k.convs, k.sent)],
          ].map(([label, value], i) => (
            <div key={label} style={i > 0 ? { borderLeft: '1px solid #e5e8eb', paddingLeft: 8 } : undefined}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
              <div style={{ fontSize: 10.5, color: '#8b95a1', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>

        {edit && (
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid #f2f4f6',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: 'default',
            }}
          >
            <input
              value={k.img ?? ''}
              onChange={(e) => updateCampaign(k.id, { img: e.target.value })}
              placeholder="이미지 URL"
              style={{ fontSize: 12, padding: '5px 7px', border: '1px solid #e5e8eb', borderRadius: 8 }}
            />
            <input
              value={k.name}
              onChange={(e) => updateCampaign(k.id, { name: e.target.value })}
              style={{ fontSize: 12, padding: '5px 7px', border: '1px solid #e5e8eb', borderRadius: 8 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={k.channel}
                onChange={(e) => updateCampaign(k.id, { channel: e.target.value as Channel })}
                style={{ flex: 1, fontSize: 12, padding: 4, border: '1px solid #e5e8eb', borderRadius: 8, background: '#fff' }}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={k.status}
                onChange={(e) => updateCampaign(k.id, { status: e.target.value as Status })}
                style={{ flex: 1, fontSize: 12, padding: 4, border: '1px solid #e5e8eb', borderRadius: 8, background: '#fff' }}
              >
                <option value="alwayson">Always-On</option>
                <option value="experiment">Experiment</option>
                <option value="stopped">Stopped</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={k.period}
                onChange={(e) => updateCampaign(k.id, { period: e.target.value })}
                placeholder="기간"
                style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '5px 7px', border: '1px solid #e5e8eb', borderRadius: 8 }}
              />
              <button
                onClick={() => deleteCampaign(k.id)}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  border: 0,
                  color: '#f04452',
                  background: '#fff0f1',
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </div>
      {notch}
    </div>
  )
}
```

Note: the handoff's edit strip has a "위↕아래" (flip top/bottom) button because cards there only move via buttons. Since cards here are dragged freely (Task 11), that button is dropped — dragging a card across the spine already flips `pos` via `moveCampaignTo`.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no type errors (the component isn't rendered anywhere yet, but it must type-check standalone).

- [ ] **Step 3: Commit**

```bash
git add src/components/CampaignCard.tsx
git commit -m "feat: add CampaignCard component (collapsed, expanded, edit strip, notch)"
```

---

### Task 11: Drag hook and NodeColumn component

**Files:**
- Create: `src/hooks/useCardDrag.ts`
- Create: `src/components/NodeColumn.tsx`

- [ ] **Step 1: Write `src/hooks/useCardDrag.ts`**

> **Correction (found during Task 14's browser QA):** the first version of this hook called `setPointerCapture` unconditionally on every `pointerdown`. That made Chromium retarget the compatibility `click`/`mouseup` events to the capturing wrapper element (which has no `onClick`) instead of letting them bubble from the real hit-tested target through `CampaignCard`'s inner `onClick` — silently breaking every plain click on a card (the detail panel never opened; "클릭 노출" chips never expanded). The version below defers `setPointerCapture` until the pointer has actually moved past a small threshold, so a plain click is never captured at all. It also tracks the live position in a ref (not just React state) so `onPointerUp` can read the final position synchronously without calling `moveCampaignTo` from inside a `setState` functional updater, which previously triggered a "Cannot update a component while rendering a different component" warning. Write this corrected version directly — do not write the naive always-capture version first.

```ts
import { useCallback, useRef, useState } from 'react'
import { useBoardStore } from '../store'

interface DragPosition {
  dragging: boolean
  x: number
  y: number
}

// Pixels of pointer movement required before a press is treated as a drag
// rather than a plain click.
const DRAG_THRESHOLD = 4

/** Lets a campaign card be picked up and dropped anywhere inside its node's
 * track. Position updates live in local state while dragging (for a smooth
 * 60fps feel) and commit to the store on release.
 *
 * Pointer capture is deferred until the pointer actually moves past
 * DRAG_THRESHOLD, rather than being engaged on every pointerdown — see the
 * note above this code block for why.
 */
export function useCardDrag(
  campaignId: string,
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  trackW: number
) {
  const moveCampaignTo = useBoardStore((s) => s.moveCampaignTo)
  const [drag, setDrag] = useState<DragPosition>({ dragging: false, x, y })
  const origin = useRef({ pointerX: 0, pointerY: 0, cardX: x, cardY: y })
  // Mirrors `drag` outside React state so onPointerUp/onPointerMove can read
  // and update the latest position synchronously, without calling the
  // store's moveCampaignTo action from inside a setState functional updater.
  const live = useRef({ dragging: false, x, y })
  const pressed = useRef(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      pressed.current = true
      origin.current = { pointerX: e.clientX, pointerY: e.clientY, cardX: x, cardY: y }
    },
    [x, y]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pressed.current) return
      const dx = e.clientX - origin.current.pointerX
      const dy = e.clientY - origin.current.pointerY
      if (!live.current.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }
      const next = { dragging: true, x: origin.current.cardX + dx, y: origin.current.cardY + dy }
      live.current = next
      setDrag(next)
    },
    []
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const wasDragging = live.current.dragging
      const { x: finalX, y: finalY } = live.current
      pressed.current = false
      live.current = { ...live.current, dragging: false }
      if (wasDragging) {
        setDrag((d) => ({ ...d, dragging: false }))
        moveCampaignTo(campaignId, finalX, finalY, cardW, cardH, trackW)
        const el = e.currentTarget as HTMLElement
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      }
    },
    [campaignId, cardW, cardH, trackW, moveCampaignTo]
  )

  const liveX = drag.dragging ? drag.x : x
  const liveY = drag.dragging ? drag.y : y

  return { x: liveX, y: liveY, dragging: drag.dragging, onPointerDown, onPointerMove, onPointerUp }
}
```

Note: `onPointerDown`, `onPointerMove` and `onPointerUp` all live on the same wrapper `div` (not split between this wrapper and `CampaignCard`'s own root) so that `setPointerCapture`/`releasePointerCapture` are always called on the same element — calling `releasePointerCapture` on an element that never captured the pointer throws. This also means a pointerdown anywhere on the card starts a potential drag; `CampaignCard`'s edit-strip in Task 10 already stops click propagation so it doesn't trigger `open()`, and it also stops pointerdown propagation so typing in its inputs or clicking its buttons doesn't get swallowed by drag-capture.

- [ ] **Step 2: Write `src/components/NodeColumn.tsx`**

```tsx
import { useBoardStore } from '../store'
import { useCardDrag } from '../hooks/useCardDrag'
import { cardWidth } from '../utils/format'
import { SPINE_Y, TRACK_HEIGHT, TRACK_WIDTH } from '../utils/geometry'
import CampaignCard from './CampaignCard'
import type { Campaign, FunnelNode, LineStyle, Stage } from '../types'

const CARD_HEIGHT_ESTIMATE = 160
const LINE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '점선' },
  { value: 'dotted', label: '점점선' },
]

interface DraggableCardProps {
  campaign: Campaign
  expanded: boolean
  notchTop: boolean
  notchBottom: boolean
}

function DraggableCard({ campaign, expanded, notchTop, notchBottom }: DraggableCardProps) {
  const width = cardWidth({ channel: campaign.channel, period: campaign.period, name: campaign.name }, expanded)
  const height = CARD_HEIGHT_ESTIMATE
  const drag = useCardDrag(campaign.id, campaign.x, campaign.y, width, height, TRACK_WIDTH)

  return (
    <div
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      style={{
        position: 'absolute',
        left: drag.x,
        top: drag.y,
        touchAction: 'none',
        cursor: drag.dragging ? 'grabbing' : 'grab',
        zIndex: drag.dragging ? 5 : 1,
      }}
    >
      <CampaignCard campaign={campaign} expanded={expanded} notchTop={notchTop} notchBottom={notchBottom} />
    </div>
  )
}

export default function NodeColumn({ stage, node }: { stage: Stage; node: FunnelNode }) {
  const edit = useBoardStore((s) => s.edit)
  const mode = useBoardStore((s) => s.mode)
  const open = useBoardStore((s) => s.open)
  const renameNode = useBoardStore((s) => s.renameNode)
  const setNodeLine = useBoardStore((s) => s.setNodeLine)
  const moveNode = useBoardStore((s) => s.moveNode)
  const insertNodeAfter = useBoardStore((s) => s.insertNodeAfter)
  const deleteNode = useBoardStore((s) => s.deleteNode)
  const addCampaign = useBoardStore((s) => s.addCampaign)

  const top = node.campaigns.filter((c) => c.pos === 'top')
  const bottom = node.campaigns.filter((c) => c.pos === 'bottom')
  // "closest to the spine" picks the notch target: for top cards that's the
  // largest y (nearest the spine from above); for bottom cards, the smallest y.
  const closestTopId = top.length ? top.reduce((a, b) => (a.y > b.y ? a : b)).id : null
  const closestBottomId = bottom.length ? bottom.reduce((a, b) => (a.y < b.y ? a : b)).id : null

  return (
    <div
      style={{
        gridRow: '1 / 4',
        display: 'grid',
        gridTemplateRows: 'subgrid',
        minWidth: 284,
        padding: '0 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          margin: '0 auto',
        }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, top: SPINE_Y, borderTop: `3px ${node.line} ${stage.color}` }} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: SPINE_Y - 7,
            width: 10,
            height: 10,
            marginLeft: -8,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 0 4px #f2f4f6',
            border: `3px solid ${stage.color}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: SPINE_Y + 17,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            textAlign: 'center',
          }}
        >
          {edit ? (
            <>
              <input
                value={node.label}
                onChange={(e) => renameNode(node.id, { label: e.target.value })}
                style={{
                  width: 200,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '3px 6px',
                  border: '1px solid #e5e8eb',
                  borderRadius: 8,
                }}
              />
              <input
                value={node.sub}
                onChange={(e) => renameNode(node.id, { sub: e.target.value })}
                style={{
                  width: 200,
                  textAlign: 'center',
                  fontSize: 11,
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  padding: '3px 6px',
                  border: '1px solid #e5e8eb',
                  borderRadius: 8,
                  color: '#5a5a58',
                }}
              />
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-.01em' }}>{node.label}</div>
              <div style={{ fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace', color: '#8b95a1' }}>
                {node.sub}
              </div>
            </>
          )}
        </div>

        {edit && (
          <button
            onClick={() => insertNodeAfter(node.id)}
            title="뒤에 노드 추가"
            style={{
              position: 'absolute',
              right: -11,
              top: SPINE_Y - 10,
              zIndex: 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: 0,
              background: '#191f28',
              color: '#fff',
              boxShadow: '0 2px 6px rgba(0,20,60,.2)',
              fontSize: 14,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            +
          </button>
        )}

        {top.map((c) => (
          <DraggableCard
            key={c.id}
            campaign={c}
            expanded={mode === 'full' || !!open[c.id]}
            notchTop={false}
            notchBottom={c.id === closestTopId}
          />
        ))}
        {bottom.map((c) => (
          <DraggableCard
            key={c.id}
            campaign={c}
            expanded={mode === 'full' || !!open[c.id]}
            notchTop={c.id === closestBottomId}
            notchBottom={false}
          />
        ))}
      </div>

      {edit && (
        <div
          style={{
            width: 252,
            boxSizing: 'border-box',
            borderRadius: 14,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: '#fff',
            boxShadow: '0 2px 12px rgba(0,20,60,.06)',
            margin: '8px auto 0',
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {LINE_OPTIONS.map((opt) => {
              const active = node.line === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setNodeLine(node.id, opt.value)}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    padding: 4,
                    border: 0,
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: active ? '#191f28' : '#f2f4f6',
                    color: active ? '#fff' : '#4e5968',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => moveNode(stage.id, node.id, -1)}
              style={{ fontSize: 11, padding: '4px 7px', border: 0, background: '#f2f4f6', color: '#4e5968', fontWeight: 600, borderRadius: 8, cursor: 'pointer' }}
            >
              ◀
            </button>
            <button
              onClick={() => moveNode(stage.id, node.id, 1)}
              style={{ fontSize: 11, padding: '4px 7px', border: 0, background: '#f2f4f6', color: '#4e5968', fontWeight: 600, borderRadius: 8, cursor: 'pointer' }}
            >
              ▶
            </button>
            <button
              onClick={() => addCampaign(node.id, 'top')}
              style={{ flex: 1, fontSize: 11, padding: 4, border: 0, background: '#f2f4f6', color: '#4e5968', fontWeight: 600, borderRadius: 8, cursor: 'pointer' }}
            >
              + 위 캠페인
            </button>
            <button
              onClick={() => addCampaign(node.id, 'bottom')}
              style={{ flex: 1, fontSize: 11, padding: 4, border: 0, background: '#f2f4f6', color: '#4e5968', fontWeight: 600, borderRadius: 8, cursor: 'pointer' }}
            >
              + 아래 캠페인
            </button>
            <button
              onClick={() => deleteNode(node.id)}
              style={{ fontSize: 11, padding: '4px 7px', border: 0, color: '#f04452', background: '#fff0f1', fontWeight: 600, borderRadius: 8, cursor: 'pointer' }}
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCardDrag.ts src/components/NodeColumn.tsx
git commit -m "feat: add drag hook and NodeColumn (spine, dot, label, draggable cards)"
```

---

### Task 12: StageColumn, AddStageButton and FunnelBoard

**Files:**
- Create: `src/components/StageColumn.tsx`
- Create: `src/components/AddStageButton.tsx`
- Create: `src/components/FunnelBoard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write `src/components/StageColumn.tsx`**

```tsx
import { useBoardStore } from '../store'
import type { Stage } from '../types'

export default function StageColumn({ stage }: { stage: Stage }) {
  const edit = useBoardStore((s) => s.edit)
  const renameStage = useBoardStore((s) => s.renameStage)
  const cycleStageColor = useBoardStore((s) => s.cycleStageColor)
  const moveStage = useBoardStore((s) => s.moveStage)
  const addNode = useBoardStore((s) => s.addNode)
  const deleteStage = useBoardStore((s) => s.deleteStage)

  return (
    <div style={{ gridRow: '1 / 4', display: 'grid', gridTemplateRows: 'subgrid', minWidth: 110 }}>
      <div />
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 27, borderTop: `3px solid ${stage.color}` }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 15, display: 'flex', justifyContent: 'center', padding: '0 14px' }}>
          {edit ? (
            <input
              value={stage.name}
              onChange={(e) => renameStage(stage.id, e.target.value)}
              style={{
                width: 96,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                padding: '6px 10px',
                border: 0,
                borderRadius: 999,
                background: stage.color,
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                padding: '7px 16px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                background: stage.color,
              }}
            >
              {stage.name}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
        {edit && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, width: 96 }}>
            <button onClick={() => moveStage(stage.id, -1)} style={smallBtn}>
              ◀
            </button>
            <button onClick={() => moveStage(stage.id, 1)} style={smallBtn}>
              ▶
            </button>
            <button onClick={() => cycleStageColor(stage.id)} style={{ ...smallBtn, gridColumn: '1 / 3' }}>
              색상 변경
            </button>
            <button onClick={() => addNode(stage.id)} style={{ ...smallBtn, gridColumn: '1 / 3' }}>
              + 노드
            </button>
            <button
              onClick={() => deleteStage(stage.id)}
              style={{ ...smallBtn, gridColumn: '1 / 3', color: '#f04452', background: '#fff0f1' }}
            >
              단계 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const smallBtn: React.CSSProperties = {
  fontSize: 11,
  padding: 4,
  border: 0,
  background: '#f2f4f6',
  color: '#4e5968',
  fontWeight: 600,
  borderRadius: 8,
  cursor: 'pointer',
}
```

- [ ] **Step 2: Write `src/components/AddStageButton.tsx`**

```tsx
import { useBoardStore } from '../store'

export default function AddStageButton() {
  const addStage = useBoardStore((s) => s.addStage)

  return (
    <div style={{ gridRow: '1 / 4', display: 'grid', gridTemplateRows: 'subgrid', width: 140 }}>
      <div />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', left: 0, width: 40, top: 27, borderTop: '2px dashed #b0b8c1' }} />
        <button
          onClick={addStage}
          style={{
            position: 'absolute',
            top: 15,
            left: 40,
            fontSize: 12,
            fontWeight: 700,
            padding: '7px 14px',
            border: '1.5px dashed #b0b8c1',
            background: 'transparent',
            color: '#4e5968',
            borderRadius: 999,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + 단계 추가
        </button>
      </div>
      <div />
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/FunnelBoard.tsx`**

```tsx
import { useBoardStore } from '../store'
import StageColumn from './StageColumn'
import NodeColumn from './NodeColumn'
import AddStageButton from './AddStageButton'

export default function FunnelBoard() {
  const edit = useBoardStore((s) => s.edit)
  const client = useBoardStore((s) => s.currentClient())

  return (
    <div style={{ overflowX: 'auto', padding: '28px 48px 72px', flex: 1 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'minmax(150px,auto) 100px minmax(150px,auto)',
          gridAutoFlow: 'column',
          gridAutoColumns: 'max-content',
          width: 'max-content',
          minWidth: '100%',
        }}
      >
        {client.stages.map((stage) => (
          <StageColumn key={stage.id} stage={stage} />
        ))}
        {client.stages.map((stage) =>
          stage.nodes.map((node) => <NodeColumn key={node.id} stage={stage} node={node} />)
        )}
        {edit && <AddStageButton />}
      </div>
    </div>
  )
}
```

> **Note on grid ordering:** the handoff's `cols` array interleaves each stage with its own nodes (`stage, node, node, stage, node, …`) so CSS `grid-auto-flow: column` lays them out left-to-right in funnel order. Mapping stages and then all nodes separately (as above) breaks that order. Fix it by building one interleaved list instead — replace the two `.map` calls above with:

```tsx
        {client.stages.flatMap((stage) => [
          <StageColumn key={stage.id} stage={stage} />,
          ...stage.nodes.map((node) => <NodeColumn key={node.id} stage={stage} node={node} />),
        ])}
```

- [ ] **Step 4: Wire `FunnelBoard` into `src/App.tsx`**

```tsx
import { useEffect } from 'react'
import { useBoardStore } from './store'
import Header from './components/Header'
import Legend from './components/Legend'
import FunnelBoard from './components/FunnelBoard'

export default function App() {
  const tick = useBoardStore((s) => s.tick)

  useEffect(() => {
    const id = setInterval(tick, 2500)
    return () => clearInterval(id)
  }, [tick])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <Legend />
      <FunnelBoard />
    </div>
  )
}
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`
Expected: the full funnel renders left to right — stage pill, then each node's spine segment with cards above/below, in order, for both seeded clients (switch with the client select). Turn on "편집" and confirm: stage ◀/▶/색상 변경/+ 노드/단계 삭제 all work; node line-style buttons, ◀/▶, + 위/아래 캠페인, 삭제 all work; dragging a card around its node track moves it, and dragging it across the spine line flips it from above to below (or back).

- [ ] **Step 6: Commit**

```bash
git add src/components/StageColumn.tsx src/components/AddStageButton.tsx src/components/FunnelBoard.tsx src/App.tsx
git commit -m "feat: add StageColumn, AddStageButton and FunnelBoard, assembling the full grid"
```

---

### Task 13: Detail panel

**Files:**
- Create: `src/components/DetailPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write `src/components/DetailPanel.tsx`**

```tsx
import { useBoardStore } from '../store'
import { formatCount, pct } from '../utils/format'
import type { Campaign, Status } from '../types'

const STATUS_META: Record<Status, { label: string; color: string }> = {
  alwayson: { label: 'Always-On', color: '#1a9a4a' },
  experiment: { label: 'Experiment', color: '#3182f6' },
  stopped: { label: 'Stopped', color: '#8b95a1' },
}

const FIELD_ROWS: { key: keyof Campaign; label: string; mono?: boolean }[] = [
  { key: 'delivery', label: '발송 방식' },
  { key: 'trigger', label: '트리거', mono: true },
  { key: 'audience', label: '대상' },
  { key: 'convEvent', label: '전환 이벤트', mono: true },
  { key: 'cap', label: '재발송 제한' },
  { key: 'period', label: '기간' },
  { key: 'link', label: '캠페인 링크' },
  { key: 'img', label: '이미지 URL' },
]

export default function DetailPanel() {
  const edit = useBoardStore((s) => s.edit)
  const sel = useBoardStore((s) => s.sel)
  const client = useBoardStore((s) => s.currentClient())
  const selectCampaign = useBoardStore((s) => s.selectCampaign)
  const updateCampaign = useBoardStore((s) => s.updateCampaign)

  if (!sel) return null

  let found: { campaign: Campaign; stageName: string; stageColor: string; nodeLabel: string } | null = null
  for (const stage of client.stages) {
    for (const node of stage.nodes) {
      const campaign = node.campaigns.find((c) => c.id === sel)
      if (campaign) {
        found = { campaign, stageName: stage.name, stageColor: stage.color, nodeLabel: node.label }
      }
    }
  }
  if (!found) return null
  const { campaign: k, stageName, stageColor, nodeLabel } = found
  const status = STATUS_META[k.status]
  const isLive = k.status !== 'stopped'

  return (
    <>
      <div
        onClick={() => selectCampaign(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,60,.2)', zIndex: 50 }}
      />
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          bottom: 12,
          width: 420,
          maxWidth: 'calc(100vw - 24px)',
          background: '#fff',
          borderRadius: 22,
          boxShadow: '0 12px 48px rgba(0,20,60,.2)',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '22px 24px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '4px 11px', borderRadius: 999, color: '#fff', fontSize: 12, fontWeight: 700, background: stageColor }}>
              {stageName}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4e5968' }}>{nodeLabel}</div>
            <button
              onClick={() => selectCampaign(null)}
              style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: '50%', border: 0, background: '#f2f4f6', color: '#4e5968', fontSize: 15, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.35 }}>{k.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {isLive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px 4px 8px', borderRadius: 999, background: '#e9f7ef', fontSize: 11, fontWeight: 700, color: '#1a8a44' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a9a4a', animation: 'livePulse 1.6s infinite' }} />
                LIVE
              </div>
            )}
            <div style={{ padding: '4px 9px', borderRadius: 999, background: '#f2f4f6', fontSize: 11, fontWeight: 700, color: status.color }}>
              {status.label}
            </div>
            <div style={{ padding: '4px 9px', borderRadius: 999, background: '#f2f4f6', fontSize: 11, fontWeight: 700, color: '#4e5968' }}>
              {k.channel}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {k.img ? (
            <img src={k.img} alt="" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 420, objectFit: 'cover', borderRadius: 14, background: '#f2f4f6' }} />
          ) : (
            <div
              style={{
                height: 200,
                borderRadius: 14,
                background: 'repeating-linear-gradient(135deg,#f5f6f8 0 8px,#eceef1 8px 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 12,
                color: '#8b95a1',
              }}
            >
              캠페인 이미지
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', padding: '14px 4px', borderRadius: 14, background: '#f9fafb' }}>
            {[
              ['발송', formatCount(k.sent)],
              ['오픈율', pct(k.opens, k.sent)],
              ['클릭률', pct(k.clicks, k.sent)],
              ['전환율', pct(k.convs, k.sent)],
            ].map(([label, value], i) => (
              <div key={label} style={{ padding: '0 10px', ...(i > 0 ? { borderLeft: '1px solid #e5e8eb' } : {}) }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#191f28', marginBottom: 6 }}>캠페인 설정</div>
            {FIELD_ROWS.map((row) => (
              <div
                key={row.key}
                style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr)', gap: 12, alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #f2f4f6' }}
              >
                <div style={{ fontSize: 13, color: '#8b95a1' }}>{row.label}</div>
                {edit ? (
                  <input
                    value={(k[row.key] as string) ?? ''}
                    onChange={(e) => updateCampaign(k.id, { [row.key]: e.target.value } as Partial<Campaign>)}
                    style={{ fontSize: 13, padding: '7px 9px', border: '1px solid #e5e8eb', borderRadius: 8, minWidth: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: '#333d4b',
                      wordBreak: 'break-all',
                      fontFamily: row.mono ? 'ui-monospace, Menlo, monospace' : 'inherit',
                    }}
                  >
                    {(k[row.key] as string) || '—'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px 22px', borderTop: '1px solid #f2f4f6' }}>
          {k.link ? (
            <a
              href={k.link}
              target="_blank"
              rel="noopener"
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 14, borderRadius: 12, background: '#191f28', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
            >
              캠페인 열기 ↗
            </a>
          ) : (
            <div style={{ padding: 14, borderRadius: 12, background: '#f2f4f6', color: '#8b95a1', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              편집 모드에서 캠페인 링크를 입력하세요
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Wire it into `src/App.tsx`**

```tsx
import { useEffect } from 'react'
import { useBoardStore } from './store'
import Header from './components/Header'
import Legend from './components/Legend'
import FunnelBoard from './components/FunnelBoard'
import DetailPanel from './components/DetailPanel'

export default function App() {
  const tick = useBoardStore((s) => s.tick)

  useEffect(() => {
    const id = setInterval(tick, 2500)
    return () => clearInterval(id)
  }, [tick])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <Legend />
      <FunnelBoard />
      <DetailPanel />
    </div>
  )
}
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`
Expected: clicking any card (in "전체 노출" mode) opens the right-side panel with stage pill, node label, campaign name, LIVE/status/channel pills, image or placeholder, the 4-column metrics block, the "캠페인 설정" rows, and the "캠페인 열기 ↗" link (or the gray placeholder note when `link` is empty). Clicking the overlay or the ✕ closes it. In 편집 mode, the rows become inputs and editing them updates the card underneath live.

- [ ] **Step 4: Commit**

```bash
git add src/components/DetailPanel.tsx src/App.tsx
git commit -m "feat: add DetailPanel"
```

---

### Task 14: Full test run and manual QA pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all unit tests pass (geometry, format, layout, seed, store — roughly 55 tests total).

- [ ] **Step 2: Run the TypeScript build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` both succeed with no type errors, producing a `dist/` folder.

- [ ] **Step 3: Manual QA checklist** (run `npm run dev`, work through each item against `design/Campaign Funnel Board.dc.html` open in a second tab for comparison)

- [ ] Header shows client name, sync time, three status counts, client select (switch between "홈닉" and "샘플 커머스"), "+ 새 고객사" creates and switches to an empty client in edit mode.
- [ ] "전체 노출" shows every card expanded; "클릭 노출" collapses all cards to chips, and clicking a chip expands just that one; "접기" on an expanded card (click mode only) collapses it back.
- [ ] "편집" turns blue and label changes to "편집 완료"; client name, stage pills and node labels all become editable inputs; a second client makes "고객사 삭제" appear.
- [ ] Stage: rename, ◀/▶ reorder, "색상 변경" cycles the palette, "+ 노드" adds at the start, "단계 삭제" removes it.
- [ ] Node: rename label/sub, line-style buttons switch 실선/점선/점점선 and the spine segment's style changes immediately, ◀/▶ moves it (and crosses into the neighboring stage at the edges), "+ 위/아래 캠페인" adds a card, "삭제" removes the node, the "+" circle at the node's right edge inserts a new node after it.
- [ ] Campaign card: drag it anywhere inside its node's track; drag it across the spine line and confirm it switches from above to below (or back); the small white notch always points from whichever card is nearest the spine toward the spine.
- [ ] Campaign edit strip: image URL, name, channel, status and period fields all update the card live; "삭제" removes the card.
- [ ] Clicking a card opens the detail panel with matching data; editing a field there updates the card on the board; "캠페인 열기 ↗" opens the link in a new tab when set, otherwise the gray placeholder note shows.
- [ ] Every ~2.5s, non-stopped campaigns' 발송/오픈율/클릭률/전환율 numbers tick upward and the header's 동기화 time advances; Stopped campaigns never change.
- [ ] Reload the page: the board (including any edits made) is restored from `localStorage`.
- [ ] Resize the window narrow: the header wraps, the funnel scrolls horizontally, and the detail panel never exceeds the viewport width.

- [ ] **Step 4: Fix anything found during QA, then commit**

```bash
git add -A
git commit -m "fix: address manual QA findings"
```

(Skip this commit if QA found nothing to fix.)

---

## Post-Task-14 Correction: grid alignment and card-height constants

After Task 14 was marked done, visual inspection in a real browser showed the board badly misaligned — stage pills, node spine lines, and node labels all rendered at different, unrelated heights instead of lining up in one row. Root causes, both introduced by this plan and not caught by `tsc`/`vitest`/curl-based checks:

1. **Subgrid misuse.** `FunnelBoard`'s grid used `grid-template-rows: minmax(150px,auto) 100px minmax(150px,auto)` with each column declaring `gridTemplateRows: 'subgrid'`. `StageColumn` correctly placed 3 separate children (one per row), but `NodeColumn` only ever rendered 1–2 children with no explicit `gridRow`, so its single `TRACK_HEIGHT`-tall track auto-placed entirely into row 1 — which then had to grow to fit it — pushing every stage pill (placed in the now-much-later-starting row 2) far below where the node content actually sat. **Fix:** dropped CSS Grid entirely in favor of a plain flex row (`FunnelBoard`: `display:flex`). Every column (`StageColumn`, `NodeColumn`, `AddStageButton`) is now simply a `flex: '0 0 auto'` box with its OWN internal `position:relative` track of height `TRACK_HEIGHT`, positioning its spine/pill/dot/label at `top: SPINE_Y` relative to its own box. Because every column shares the same `TRACK_HEIGHT` and the same `SPINE_Y` offset, and a flex row aligns all children to the same top by default, every spine/pill now lines up automatically — no row-sharing trick needed, and no subgrid pitfalls. Edit-mode controls (stage buttons, node line/move/add buttons) now render as a normal-flow sibling below each track instead of in a dedicated grid row.

2. **Card height badly underestimated.** `CARD_HEIGHT_ESTIMATE` was set to `160`, but a real expanded card (with the placeholder image block) measures `~266px`. `TRACK_HEIGHT`/`SPINE_Y` were only `460`/`230`, and the default bottom-card offset started just `30px` below the spine — well inside the space the node's own label/sub-text occupies (`SPINE_Y+17` to roughly `SPINE_Y+65`). The combination caused cards to overlap each other and to visually cover node labels. **Fix:** `TRACK_HEIGHT`/`SPINE_Y` raised to `1250`/`600` (room for two realistic-height cards per side, per the seed data's max), `layout.ts`'s `CARD_HEIGHT_ESTIMATE` raised to `270` with explicit `TOP_CLEARANCE`/`BOTTOM_CLEARANCE` constants so default placement never starts inside the label zone, and `NodeColumn.tsx`'s drag-height estimate now distinguishes expanded (`270`) from collapsed (`48`) cards instead of using one flat `160` for both. This remains a static estimate, not a measured one — a card with a real (not placeholder) image can still render taller than assumed; the user can always drag it afterward.

Any test that hardcoded the old constants (`230`, `300`, `400` used as a stand-in for `SPINE_Y`/`TRACK_HEIGHT`) was rewritten to import and use `SPINE_Y`/`TRACK_HEIGHT`/`TRACK_WIDTH` from `src/utils/geometry.ts` symbolically, so it can't silently drift from the real constants again (`src/data/seed.test.ts`, `src/store.test.ts`). All 58 tests, `tsc -b --noEmit`, and `npm run build` pass after this fix; a real-browser screenshot confirmed stage pills, spines, dots, and node labels all align in one row with no card overlapping another element.

**Lesson for future similar work:** `tsc` and `vitest` passing, and a page serving over curl, are necessary but not sufficient evidence that a layout actually looks right — CSS Grid/subgrid interactions and content-size assumptions need an actual rendered screenshot to verify, not just type-checking and functional click/drag testing.

## Self-Review Notes

- **Spec coverage:** every README section (Header, Legend, Funnel area with stage/node columns, CampaignCard in all three states, Detail Panel, edit-mode interactions, live-data simulation, persistence, design tokens) maps to a task above. The one intentional deviation — freeform drag instead of button-ordered top/bottom lists — is called out explicitly in the Architecture section and in Task 10's note, per the user's confirmation that free placement is correct.
- **Known simplification (stated, not a gap):** node tracks use a fixed 400×460px area instead of the handoff's CSS `max-content` column growth, because absolutely-positioned drag targets need an explicit container size. Documented in `src/utils/geometry.ts`'s comment and in the Architecture section.
- **Explicitly deferred (not part of this plan):** auth, backend, real Braze sync, and image drag/paste upload — listed up front so nobody mistakes their absence for an oversight.
