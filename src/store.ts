import { create } from 'zustand'
import type { BoardState, Client, FunnelNode } from './types'
import { uid } from './utils/uid'
import { seed, STAGE_PALETTE as SEED_PALETTE } from './data/seed'
import { defaultCardPosition } from './utils/layout'
import { clampCardPosition, posFromY } from './utils/geometry'
import type { Campaign, CardPos } from './types'

export const STAGE_PALETTE = SEED_PALETTE

// Fills in defaults for fields that might be missing from data saved by an
// older version of the schema, so old localStorage data self-heals on load
// instead of crashing the render (seen once already with a field that got
// added then removed again — keep this cheap safety net for next time).
export function normalizeNode(node: FunnelNode): FunnelNode {
  return {
    ...node,
    campaigns: node.campaigns ?? [],
  }
}

export function normalizeClient(client: Client): Client {
  return {
    ...client,
    stages: client.stages.map((stage) => ({
      ...stage,
      nodes: stage.nodes.map(normalizeNode),
    })),
  }
}

export function loadInitialState(): Pick<BoardState, 'clients' | 'clientId' | 'mode'> {
  try {
    const raw = localStorage.getItem('funnelBoard.v1')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.clients?.length) {
        const clients = (parsed.clients as Client[]).map(normalizeClient)
        return {
          clients,
          clientId: parsed.clientId ?? clients[0].id,
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
  enterEdit: () => void
  confirmEdit: () => void
  cancelEdit: () => void
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
  addCampaign: (nodeId: string, pos: CardPos) => void
  updateCampaign: (campaignId: string, patch: Partial<Campaign>) => void
  moveCampaignTo: (campaignId: string, x: number, y: number, cardW: number, cardH: number, trackW: number) => void
  deleteCampaign: (campaignId: string) => void
  tick: () => void
}

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

// Snapshot of `clients` taken when edit mode is entered, so "취소" can
// discard every change made during the session. Not part of reactive
// state — it never needs to trigger a render, only to be read/written by
// the enter/confirm/cancel actions below.
let editSnapshot: Client[] | null = null

function findCampaignLocation(client: Client, campaignId: string) {
  for (let si = 0; si < client.stages.length; si++) {
    for (let ni = 0; ni < client.stages[si].nodes.length; ni++) {
      const ci = client.stages[si].nodes[ni].campaigns.findIndex((c) => c.id === campaignId)
      if (ci !== -1) return { si, ni, ci }
    }
  }
  return null
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
  enterEdit: () => {
    if (editSnapshot === null) editSnapshot = structuredClone(get().clients)
    set({ edit: true })
  },
  confirmEdit: () => {
    editSnapshot = null
    set({ edit: false })
  },
  cancelEdit: () =>
    set((s) => {
      const clients = editSnapshot ?? s.clients
      editSnapshot = null
      const clientId = clients.some((c) => c.id === s.clientId) ? s.clientId : clients[0].id
      return { clients, clientId, edit: false }
    }),
  selectCampaign: (id) => set({ sel: id }),
  toggleOpen: (id) => set((s) => ({ open: { ...s.open, [id]: !s.open[id] } })),

  setClient: (id) => set({ clientId: id, open: {}, sel: null }),
  addClient: () => {
    if (editSnapshot === null) editSnapshot = structuredClone(get().clients)
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
}))

useBoardStore.subscribe((state) => saveState(state))
