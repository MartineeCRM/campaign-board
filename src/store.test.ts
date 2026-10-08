// src/store.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore, STAGE_PALETTE, saveState, simulateTick, normalizeClient } from './store'
import { SPINE_Y, TRACK_HEIGHT, TRACK_WIDTH } from './utils/geometry'
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
