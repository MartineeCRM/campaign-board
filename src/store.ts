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
