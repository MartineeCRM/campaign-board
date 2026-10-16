// src/store.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
const persistenceMocks = vi.hoisted(() => ({ persistClient: vi.fn(async () => undefined), deleteClientRow: vi.fn(async () => undefined), loadAllClients: vi.fn(async () => []) }))
vi.mock('./persistence', () => persistenceMocks)
import { useBoardStore, STAGE_PALETTE, normalizeClient } from './store'
import { SPINE_Y, TRACK_HEIGHT, TRACK_WIDTH } from './utils/geometry'
import type { Client } from './types'
import { supabase } from './supabase'

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
    dataLoaded: false,
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

  it('reorders a node by dropping it before or after another node', () => {
    useBoardStore.getState().addNode('s1')
    const addedNode = useBoardStore.getState().currentClient().stages[0].nodes[0]
    useBoardStore.getState().reorderNode(addedNode.id, 'n1', true)
    expect(useBoardStore.getState().currentClient().stages[0].nodes.map((node) => node.id)).toEqual(['n1', addedNode.id])

    useBoardStore.getState().reorderNode('n1', addedNode.id, true)
    expect(useBoardStore.getState().currentClient().stages[0].nodes.map((node) => node.id)).toEqual([addedNode.id, 'n1'])
  })

  it('moves a dropped node into the target stage', () => {
    useBoardStore.getState().reorderNode('n1', 'n2', true)
    const stages = useBoardStore.getState().currentClient().stages
    expect(stages[0].nodes).toHaveLength(0)
    expect(stages[1].nodes.map((node) => node.id)).toEqual(['n2', 'n1'])
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
    expect(stages[1].nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
  })
})

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
    const belowSpine = SPINE_Y + 70
    useBoardStore.getState().moveCampaignTo('k1', 20, belowSpine, 260, 160, TRACK_WIDTH)
    const campaign = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(campaign.pos).toBe('bottom')
    expect(campaign.x).toBe(20)
    expect(campaign.y).toBe(belowSpine)
  })

  it('moveCampaignTo clamps x/y to the track bounds', () => {
    useBoardStore.getState().moveCampaignTo('k1', 99999, -500, 260, 160, TRACK_WIDTH)
    const campaign = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(campaign.x).toBe(TRACK_WIDTH - 260)
    expect(campaign.y).toBe(0)
  })

  it('moveCampaignTo clamps y so a card cannot leave the bottom of the track', () => {
    useBoardStore.getState().moveCampaignTo('k1', 20, 999999, 260, 160, TRACK_WIDTH)
    const campaign = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(campaign.y).toBe(TRACK_HEIGHT - 160)
  })

  it('moves a campaign to free board coordinates without changing its node ownership', () => {
    const before = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    useBoardStore.getState().moveCampaignOnBoard('k1', 1480, 760)
    const after = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(after.boardX).toBe(1480)
    expect(after.boardY).toBe(760)
    expect(after.x).toBe(before.x)
    expect(after.y).toBe(before.y)
  })

  it('does not import Braze items already on the board or duplicated in one batch', () => {
    useBoardStore.getState().updateCampaign('k1', { brazeId: 'existing-id', brazeType: 'campaign' })
    useBoardStore.getState().importBrazeCampaigns('n2', 'top', [
      { brazeId: 'existing-id', brazeType: 'campaign', name: 'Already on board' },
      { brazeId: 'new-id', brazeType: 'canvas', name: 'New canvas' },
      { brazeId: 'new-id', brazeType: 'canvas', name: 'Duplicate in selection' },
    ])

    const campaigns = useBoardStore.getState().currentClient().stages[1].nodes[0].campaigns
    expect(campaigns).toHaveLength(1)
    expect(campaigns[0]).toMatchObject({ brazeId: 'new-id', brazeType: 'canvas', name: 'New canvas' })
  })

  it('deleteCampaign removes the campaign by id', () => {
    useBoardStore.getState().deleteCampaign('k1')
    expect(useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns).toHaveLength(0)
  })
})

describe('normalizeClient', () => {
  it('fills in a missing campaigns array on an old-shaped node', () => {
    const old = fixtureClient()
    // simulate data saved before `campaigns` was guaranteed to be present
    // @ts-expect-error intentionally constructing a pre-migration shape
    delete old.stages[1].nodes[0].campaigns
    const normalized = normalizeClient(old)
    expect(normalized.stages[1].nodes[0].campaigns).toEqual([])
  })

  it('leaves already-current data untouched', () => {
    const current = fixtureClient()
    const normalized = normalizeClient(current)
    expect(normalized).toEqual(current)
  })
})

describe('edit mode snapshot/cancel', () => {
  it('enterEdit turns edit mode on', () => {
    useBoardStore.getState().enterEdit()
    expect(useBoardStore.getState().edit).toBe(true)
    // clears the module-level snapshot so later tests don't inherit it
    useBoardStore.getState().confirmEdit()
  })

  it('confirmEdit keeps changes made during the edit session', () => {
    useBoardStore.getState().enterEdit()
    useBoardStore.getState().renameStage('s1', 'Renamed')
    useBoardStore.getState().confirmEdit()
    const state = useBoardStore.getState()
    expect(state.edit).toBe(false)
    expect(state.currentClient().stages[0].name).toBe('Renamed')
  })

  it('cancelEdit discards changes made since enterEdit', () => {
    useBoardStore.getState().enterEdit()
    useBoardStore.getState().renameStage('s1', 'Renamed')
    useBoardStore.getState().addStage()
    useBoardStore.getState().cancelEdit()
    const state = useBoardStore.getState()
    expect(state.edit).toBe(false)
    expect(state.currentClient().stages).toHaveLength(2)
    expect(state.currentClient().stages[0].name).toBe('Stage 1')
  })

  it('cancelEdit deletes only newly uploaded image objects', async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null })
    const from = vi.spyOn(supabase.storage, 'from').mockImplementation(() => ({ remove } as never))
    useBoardStore.getState().updateCampaign('k1', { images: [{ key: 'kept', url: 'signed', storagePath: 'k1/kept.png', width: 10, height: 10 }] })
    useBoardStore.getState().enterEdit()
    useBoardStore.getState().updateCampaign('k1', { images: [
      { key: 'kept', url: 'signed', storagePath: 'k1/kept.png', width: 10, height: 10 },
      { key: 'new', url: 'signed-new', storagePath: 'k1/new.png', width: 10, height: 20 },
    ] })
    useBoardStore.getState().cancelEdit()
    await vi.waitFor(() => expect(from).toHaveBeenCalledWith('campaign-images'))
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith(['k1/new.png']))
    expect(useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0].images).toHaveLength(1)
    from.mockRestore()
  })

  it('associates an uploaded Canvas image with the selected message step', async () => {
    const upload = vi.fn().mockResolvedValue({ data: {}, error: null })
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/step.png' }, error: null })
    const from = vi.spyOn(supabase.storage, 'from').mockImplementation(() => ({ upload, createSignedUrl } as never))
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 100, height: 200, close: vi.fn() }))
    useBoardStore.getState().updateCampaign('k1', { brazeType: 'canvas', canvasSteps: [
      { id: 'step-1', name: 'Push', channel: 'Push', sent: 0, opens: 0, clicks: 0, engagements: 0, conversionCounts: [0] },
    ] })
    try {
      await useBoardStore.getState().addCampaignImages('k1', [new File(['image'], 'step.png', { type: 'image/png' })], 'step-1')
      expect(useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0].images?.[0])
        .toMatchObject({ stepId: 'step-1', width: 100, height: 200 })
    } finally {
      from.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('cancelEdit restores a removed stored image without deleting its object', () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null })
    const from = vi.spyOn(supabase.storage, 'from').mockImplementation(() => ({ remove } as never))
    const original = { key: 'kept', url: 'signed', storagePath: 'k1/kept.png', width: 10, height: 10 }
    useBoardStore.getState().updateCampaign('k1', { images: [original] })
    useBoardStore.getState().enterEdit()
    useBoardStore.getState().updateCampaign('k1', { images: [] })
    useBoardStore.getState().cancelEdit()
    expect(remove).not.toHaveBeenCalled()
    expect(useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0].images).toEqual([original])
    from.mockRestore()
  })

  it('confirmEdit removes stored objects that were removed in the edit session', async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null })
    const from = vi.spyOn(supabase.storage, 'from').mockImplementation(() => ({ remove } as never))
    useBoardStore.getState().updateCampaign('k1', { images: [{ key: 'old', url: 'signed', storagePath: 'k1/old.png', width: 10, height: 10 }] })
    useBoardStore.getState().enterEdit()
    useBoardStore.getState().updateCampaign('k1', { images: [] })
    useBoardStore.getState().confirmEdit()
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith(['k1/old.png']))
    from.mockRestore()
  })

  it('cancelEdit is a harmless no-op if edit mode was never entered', () => {
    useBoardStore.getState().renameStage('s1', 'Renamed')
    useBoardStore.getState().cancelEdit()
    const state = useBoardStore.getState()
    expect(state.edit).toBe(false)
    expect(state.currentClient().stages[0].name).toBe('Renamed')
  })

  it('addClient during edit is undone by cancelEdit', () => {
    useBoardStore.getState().enterEdit()
    useBoardStore.getState().addClient()
    const addedId = useBoardStore.getState().clientId
    useBoardStore.getState().cancelEdit()
    const state = useBoardStore.getState()
    expect(state.clients.some((c) => c.id === addedId)).toBe(false)
    expect(state.clientId).toBe('c1')
  })
})
