import { create } from 'zustand'
import type { BoardState, Client, FunnelNode } from './types'
import { uid } from './utils/uid'
import { seed, STAGE_PALETTE as SEED_PALETTE } from './data/seed'
import { defaultCardPosition } from './utils/layout'
import { clampCardPosition, posFromY } from './utils/geometry'
import { deleteClientRow, loadAllClients, persistClient } from './persistence'
import type { Campaign, CardPos } from './types'
import { supabase } from './supabase'
import { CAMPAIGN_IMAGE_BUCKET, reorderImageSubset, signedCampaignImageUrl } from './utils/campaign-images'
import { brazeItemKey, getImportedBrazeKeys } from './utils/braze-import'
import type { CampaignImageRecord } from './types'

export const STAGE_PALETTE = SEED_PALETTE

export const ZOOM_MIN = 0.4
export const ZOOM_MAX = 1.5
const ZOOM_STEP = 0.1

// Defensive defaults for fields that might come back missing/null from a
// query (e.g. a node with no campaigns) — cheap insurance, not tied to any
// particular storage backend.
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
  selectedStageId: string | null
  selectStage: (id: string | null) => void
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
  reorderNode: (nodeId: string, targetNodeId: string, insertAfter: boolean) => void
  setNodeLine: (nodeId: string, line: FunnelNode['line']) => void
  moveNode: (stageId: string, nodeId: string, dir: -1 | 1) => void
  insertNodeAfter: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
  addCampaign: (nodeId: string, pos: CardPos) => void
  importBrazeCampaigns: (nodeId: string, pos: CardPos, items: { brazeId: string; brazeType: 'campaign' | 'canvas'; name: string; isActive?: boolean }[]) => void
  updateCampaign: (campaignId: string, patch: Partial<Campaign>) => void
  addCampaignImages: (campaignId: string, files: File[], stepId?: string) => Promise<void>
  removeCampaignImage: (campaignId: string, storagePath: string) => Promise<void>
  reorderCampaignImages: (campaignId: string, storagePaths: string[]) => void
  moveCampaignOnBoard: (campaignId: string, boardX: number, boardY: number) => void
  cardHeights: Record<string, number>
  measureCardHeight: (campaignId: string, height: number) => void
  moveCampaignTo: (campaignId: string, x: number, y: number, cardW: number, cardH: number, trackW: number, trackH?: number) => void
  moveCampaignToNode: (campaignId: string, targetNodeId: string, x: number, y: number, cardW: number, cardH: number, trackW: number, trackH?: number) => void
  deleteCampaign: (campaignId: string) => void
  loadFromSupabase: () => Promise<void>
  zoom: number
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  // Panel resize
  panelWidth: number
  setPanelWidth: (w: number) => void
  // Braze sync
  isSyncing: boolean
  syncError: string | null
  syncBraze: () => Promise<void>
  isSyncingAll: boolean
  syncAllError: string | null
  syncAllMessage: string | null
  syncAll: () => Promise<void>
  // Sheets sync
  isSyncingSheets: boolean
  syncSheetsError: string | null
  updateClientSheetsTab: (tab: string) => void
  updateClientIamClickCount: (count: 'first' | 'both') => void
  updateClientConversionEventIndex: (index: number) => void
  syncSheets: () => Promise<void>
}

// Snapshot of `clients` taken when edit mode is entered, so "취소" can
// discard every change made during the session. Not part of reactive
// state — it never needs to trigger a render, only to be read/written by
// the enter/confirm/cancel actions below.
let editSnapshot: Client[] | null = null
let editUploadedImagePaths = new Set<string>()
let loadInFlight = false
let syncAllRunning = false

function findCampaignLocation(client: Client, campaignId: string) {
  for (let si = 0; si < client.stages.length; si++) {
    for (let ni = 0; ni < client.stages[si].nodes.length; ni++) {
      const ci = client.stages[si].nodes[ni].campaigns.findIndex((c) => c.id === campaignId)
      if (ci !== -1) return { si, ni, ci }
    }
  }
  return null
}

function campaignImagePaths(clients: Client[]): Set<string> {
  const paths = new Set<string>()
  for (const client of clients) for (const stage of client.stages) for (const node of stage.nodes) for (const campaign of node.campaigns) {
    for (const image of campaign.images ?? []) if (image.storagePath) paths.add(image.storagePath)
  }
  return paths
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    try { return { width: bitmap.width, height: bitmap.height } } finally { bitmap.close() }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error(`${file.name}: 이미지 크기를 읽지 못했습니다`))
      image.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}

async function removeStoredImages(paths: string[]) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(CAMPAIGN_IMAGE_BUCKET).remove(paths)
  if (error) throw error
}

async function persistClients(clients: Client[]) {
  await Promise.all(clients.map(persistClient))
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  clients: [],
  clientId: '',
  mode: 'full',
  edit: false,
  open: {},
  sel: null,
  selectedStageId: null,
  sync: Date.now(),
  syncSheetsMessage: null,
  dataLoaded: false,
  cardHeights: {},
  measureCardHeight: (campaignId, height) => set((s) => s.cardHeights[campaignId] === height ? s : { cardHeights: { ...s.cardHeights, [campaignId]: height } }),
  zoom: 1,
  panelWidth: 320,
  setPanelWidth: (w) => set({ panelWidth: w }),
  isSyncing: false,
  syncError: null,
  isSyncingAll: false,
  syncAllError: null,
  syncAllMessage: null,
  isSyncingSheets: false,
  syncSheetsError: null,

  zoomIn: () => set((s) => ({ zoom: Math.min(ZOOM_MAX, Math.round((s.zoom + ZOOM_STEP) * 100) / 100) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(ZOOM_MIN, Math.round((s.zoom - ZOOM_STEP) * 100) / 100) })),
  resetZoom: () => set({ zoom: 1 }),

  syncBraze: async () => {
    const { clientId, isSyncing } = get()
    if (isSyncing || (get().isSyncingAll && !syncAllRunning)) return
    set({ isSyncing: true, syncError: null })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-braze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clientId }),
      })
      const body = await res.json() as { ok?: boolean; error?: string; synced?: number }
      if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`)

      // Reload from DB so synced metrics are reflected immediately
      await get().loadFromSupabase()
    } catch (err) {
      set({ syncError: err instanceof Error ? err.message : String(err) })
    } finally {
      set({ isSyncing: false, sync: Date.now() })
    }
  },

  updateClientSheetsTab: (tab) => {
    const { clientId } = get()
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === clientId ? { ...c, sheetsTab: tab } : c,
      ),
    }))
    const client = get().clients.find((c) => c.id === clientId)
    if (client) void persistClient(client)
  },

  updateClientIamClickCount: (iamClickCount) => {
    const { clientId } = get()
    set((s) => ({
      clients: s.clients.map((c) => c.id === clientId ? { ...c, iamClickCount } : c),
    }))
    const client = get().clients.find((c) => c.id === clientId)
    if (client) void persistClient(client)
  },

  updateClientConversionEventIndex: (conversionEventIndex) => {
    const { clientId } = get()
    set((s) => ({
      clients: s.clients.map((c) => c.id === clientId ? { ...c, conversionEventIndex } : c),
    }))
    const client = get().clients.find((c) => c.id === clientId)
    if (client) void persistClient(client)
  },

  syncSheets: async () => {
    const { clientId, isSyncingSheets } = get()
    if (isSyncingSheets || (get().isSyncingAll && !syncAllRunning)) return
    set({ isSyncingSheets: true, syncSheetsError: null, syncSheetsMessage: null })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clientId }),
      })
      const body = await res.json() as {
        ok?: boolean
        error?: string
        rowsWithBrazeId?: number
        uniqueBrazeIds?: number
        updatedCampaigns?: number
        unmatchedIds?: number
      }
      if (!res.ok || body.error || body.ok !== true) throw new Error(body.error ?? `HTTP ${res.status}`)

      await get().loadFromSupabase()
      const updated = body.updatedCampaigns ?? 0
      const unmatched = body.unmatchedIds ?? 0
      set({
        syncSheetsMessage: updated === 0
          ? `동기화 완료 · 반영된 카드 0개, 보드에 없는 시트 ID ${unmatched}개`
          : `동기화 완료 · 카드 ${updated}개 반영, 보드에 없는 시트 ID ${unmatched}개`,
      })
    } catch (err) {
      set({ syncSheetsError: err instanceof Error ? err.message : String(err) })
    } finally {
      set({ isSyncingSheets: false })
    }
  },

  syncAll: async () => {
    const state = get()
    if (state.isSyncingAll || state.isSyncing || state.isSyncingSheets) return
    syncAllRunning = true
    set({ isSyncingAll: true, syncAllError: null, syncAllMessage: null, syncError: null, syncSheetsError: null })
    try {
      await get().syncSheets()
      const sheetsError = get().syncSheetsError
      await get().syncBraze()
      const brazeError = get().syncError
      const errors = [sheetsError && `Sheets: ${sheetsError}`, brazeError && `Braze: ${brazeError}`].filter(Boolean)
      set({
        syncAllError: errors.length ? errors.join(' · ') : null,
        syncAllMessage: errors.length ? null : 'Sheets와 Braze 동기화 완료',
      })
    } finally {
      syncAllRunning = false
      set({ isSyncingAll: false })
    }
  },

  loadFromSupabase: async () => {
    // Guards against two overlapping calls both seeing an empty table and
    // each inserting their own copy of the seed clients — React StrictMode
    // double-invokes effects in dev, which double-fires this on login.
    if (loadInFlight) return
    loadInFlight = true
    try {
      let clients = await loadAllClients()
      if (clients.length === 0) {
        clients = seed()
        for (const client of clients) await persistClient(client)
      }
      const prevId = get().clientId
      const clientId = clients.some((c) => c.id === prevId) ? prevId : clients[0].id
      set({ clients, clientId, dataLoaded: true, sync: Date.now() })
    } finally {
      loadInFlight = false
    }
  },

  currentClient: () => {
    const s = get()
    return s.clients.find((c) => c.id === s.clientId) ?? s.clients[0]
  },

  setMode: (mode) => set({ mode, open: {} }),
  enterEdit: () => {
    if (editSnapshot === null) {
      editSnapshot = structuredClone(get().clients)
      editUploadedImagePaths = new Set()
    }
    set({ edit: true })
  },
  confirmEdit: () => {
    const oldPaths = campaignImagePaths(editSnapshot ?? [])
    const currentPaths = campaignImagePaths(get().clients)
    const removedPaths = new Set([...oldPaths, ...editUploadedImagePaths])
    const orphanPaths = [...removedPaths].filter((path) => !currentPaths.has(path))
    const clients = get().clients
    editSnapshot = null
    editUploadedImagePaths = new Set()
    set({ edit: false })
    if (orphanPaths.length) void persistClients(clients).then(() => removeStoredImages(orphanPaths)).catch((error) => console.error('이미지 정리 실패', error))
  },
  cancelEdit: () =>
    set((s) => {
      const clients = editSnapshot ?? s.clients
      const oldPaths = campaignImagePaths(clients)
      const newPaths = new Set([...campaignImagePaths(s.clients), ...editUploadedImagePaths])
      const orphanPaths = [...newPaths].filter((path) => !oldPaths.has(path))
      editSnapshot = null
      editUploadedImagePaths = new Set()
      const clientId = clients.some((c) => c.id === s.clientId) ? s.clientId : clients[0].id
      if (orphanPaths.length) void persistClients(clients).then(() => removeStoredImages(orphanPaths)).catch((error) => console.error('이미지 정리 실패', error))
      return { clients, clientId, edit: false }
    }),
  selectCampaign: (id) => set({ sel: id }),
  selectStage: (id) => set({ selectedStageId: id }),
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
  deleteClient: () => {
    const s = get()
    if (s.clients.length <= 1) return
    const removedId = s.clientId
    const clients = s.clients.filter((c) => c.id !== removedId)
    set({ clients, clientId: clients[0].id })
    void deleteClientRow(removedId)
  },
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
  reorderNode: (nodeId, targetNodeId, insertAfter) =>
    set((s) => withClient(s, (c) => {
      if (nodeId === targetNodeId) return
      let sourceStageIndex = -1
      let sourceNodeIndex = -1
      let node: FunnelNode | undefined
      for (let si = 0; si < c.stages.length; si++) {
        const ni = c.stages[si].nodes.findIndex((entry) => entry.id === nodeId)
        if (ni !== -1) {
          sourceStageIndex = si
          sourceNodeIndex = ni
          node = c.stages[si].nodes[ni]
          break
        }
      }
      if (!node) return
      const targetStage = c.stages.find((stage) => stage.nodes.some((entry) => entry.id === targetNodeId))
      if (!targetStage) return

      c.stages[sourceStageIndex].nodes.splice(sourceNodeIndex, 1)
      const targetIndex = targetStage.nodes.findIndex((entry) => entry.id === targetNodeId)
      if (targetIndex === -1) return
      targetStage.nodes.splice(targetIndex + (insertAfter ? 1 : 0), 0, node)
    })),
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
  importBrazeCampaigns: (nodeId, pos, items) =>
    set((s) =>
      withClient(s, (c) => {
        const importedKeys = getImportedBrazeKeys(c)
        for (const st of c.stages) {
          const node = st.nodes.find((x) => x.id === nodeId)
          if (!node) continue
          items.forEach((item) => {
            const key = brazeItemKey(item.brazeType, item.brazeId)
            if (importedKeys.has(key)) return
            importedKeys.add(key)
            const indexInZone = node.campaigns.filter((k) => k.pos === pos).length
            const { x, y } = defaultCardPosition(pos, indexInZone)
            node.campaigns.push({
              id: uid(),
              name: item.name,
              channel: 'Push',
              status: typeof item.isActive === 'boolean'
                ? (item.isActive ? 'alwayson' : 'stopped')
                : 'experiment',
              pos,
              x,
              y,
              brazeId: item.brazeId,
              brazeType: item.brazeType,
              sent: 0,
              opens: 0,
              clicks: 0,
              convs: 0,
              period: '',
              delivery: 'Action-Based',
              trigger: node.sub,
              audience: '',
              convEvent: '',
              cap: '',
              link: '',
            })
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
  addCampaignImages: async (campaignId, files, stepId) => {
    const client = get().currentClient()
    if (!client) return
    const uploaded: string[] = []
    try {
      const records: CampaignImageRecord[] = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        const { width, height } = await imageDimensions(file)
        if (!(width > 0 && height > 0)) throw new Error(`${file.name}: 이미지 크기가 올바르지 않습니다`)
        const safeName = file.name.replace(/[^\w.-]+/g, '_') || 'image'
        const path = `${campaignId}/${crypto.randomUUID()}-${safeName}`
        const { error } = await supabase.storage.from(CAMPAIGN_IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
        if (error) throw error
        uploaded.push(path)
        records.push({ storagePath: path, width, height, ...(stepId ? { stepId } : {}) })
      }
      const location = findCampaignLocation(get().currentClient(), campaignId)
      if (!location || !records.length) { await removeStoredImages(uploaded); return }
      const display = await Promise.all(records.map(async (record) => ({ ...record, key: record.storagePath, url: await signedCampaignImageUrl(record.storagePath) })))
      const latestClient = get().currentClient()
      const latestLocation = findCampaignLocation(latestClient, campaignId)
      if (!latestLocation) { await removeStoredImages(uploaded); return }
      const current = latestClient.stages[latestLocation.si].nodes[latestLocation.ni].campaigns[latestLocation.ci]
      get().updateCampaign(campaignId, { images: [...(current.images ?? (current.img ? [{ key: `legacy:${current.img}`, url: current.img }] : [])), ...display] })
      if (editSnapshot !== null) for (const path of uploaded) editUploadedImagePaths.add(path)
    } catch (error) {
      await removeStoredImages(uploaded).catch(() => undefined)
      throw error
    }
  },
  removeCampaignImage: async (campaignId, storagePath) => {
    const client = get().currentClient()
    const location = findCampaignLocation(client, campaignId)
    if (!location) return
    const campaign = client.stages[location.si].nodes[location.ni].campaigns[location.ci]
    const images = (campaign.images ?? []).filter((image) => image.storagePath !== storagePath)
    const nextClient = structuredClone(client)
    const nextLocation = findCampaignLocation(nextClient, campaignId)!
    nextClient.stages[nextLocation.si].nodes[nextLocation.ni].campaigns[nextLocation.ci].images = images
    await persistClient(nextClient)
    get().updateCampaign(campaignId, { images })
    if (editSnapshot === null) await removeStoredImages([storagePath])
  },
  reorderCampaignImages: (campaignId, storagePaths) => {
    const client = get().currentClient()
    const location = findCampaignLocation(client, campaignId)
    if (!location) return
    const campaign = client.stages[location.si].nodes[location.ni].campaigns[location.ci]
    get().updateCampaign(campaignId, { images: reorderImageSubset(campaign.images ?? [], storagePaths) })
  },
  moveCampaignOnBoard: (campaignId, boardX, boardY) =>
    set((s) => withClient(s, (client) => {
      const location = findCampaignLocation(client, campaignId)
      if (!location) return
      const campaign = client.stages[location.si].nodes[location.ni].campaigns[location.ci]
      campaign.boardX = boardX
      campaign.boardY = boardY
    })),
  moveCampaignTo: (campaignId, x, y, cardW, cardH, trackW, trackH) =>
    set((s) =>
      withClient(s, (c) => {
        const loc = findCampaignLocation(c, campaignId)
        if (!loc) return
        const campaign = c.stages[loc.si].nodes[loc.ni].campaigns[loc.ci]
        const clamped = clampCardPosition(x, y, cardW, cardH, trackW, trackH)
        campaign.x = clamped.x
        campaign.y = clamped.y
        campaign.pos = posFromY(clamped.y, cardH)
      })
    ),
  moveCampaignToNode: (campaignId, targetNodeId, x, y, cardW, cardH, trackW, trackH) =>
    set((s) =>
      withClient(s, (c) => {
        // Detach from current node
        let campaign: Campaign | null = null
        outer: for (const st of c.stages) {
          for (const n of st.nodes) {
            const ci = n.campaigns.findIndex((k) => k.id === campaignId)
            if (ci !== -1) {
              ;[campaign] = n.campaigns.splice(ci, 1)
              break outer
            }
          }
        }
        if (!campaign) return
        // Attach to target node with clamped position
        for (const st of c.stages) {
          const targetNode = st.nodes.find((n) => n.id === targetNodeId)
          if (targetNode) {
            const clamped = clampCardPosition(x, y, cardW, cardH, trackW, trackH)
            campaign.x = clamped.x
            campaign.y = clamped.y
            campaign.pos = posFromY(clamped.y, cardH)
            targetNode.campaigns.push(campaign)
            return
          }
        }
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
}))

// Debounced whole-tree resync: any change to `clients` re-sends the
// current client's full stage/node/campaign tree to Supabase shortly
// after the last edit, rather than wiring a Supabase call into each of
// the ~20 CRUD actions individually. Guarded on dataLoaded so the initial
// load never races a write before there's anything real to persist, and
// on a `clients` reference check so UI-only state (zoom, mode, selection)
// doesn't trigger a redundant write.
let persistTimer: ReturnType<typeof setTimeout> | null = null
let lastSeenClients: Client[] | null = null
useBoardStore.subscribe((state) => {
  if (!state.dataLoaded || state.clients === lastSeenClients) return
  lastSeenClients = state.clients
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    const client = state.clients.find((c) => c.id === state.clientId)
    if (client) void persistClient(client)
  }, 500)
})
