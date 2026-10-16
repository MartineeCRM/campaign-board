import { describe, expect, it } from 'vitest'
import { brazeItemKey, getImportedBrazeKeys } from './braze-import'
import type { Client } from '../types'

const client = {
  id: 'client-1',
  name: 'Client',
  stages: [{
    id: 'stage-1', name: 'Stage', color: '#000', nodes: [{
      id: 'node-1', label: 'Node', sub: '', line: 'solid', campaigns: [
        { id: 'local-1', name: 'Existing campaign', channel: 'Push', status: 'experiment', pos: 'top', x: 0, y: 0, sent: 0, opens: 0, clicks: 0, convs: 0, period: '', delivery: '', trigger: '', audience: '', convEvent: '', cap: '', link: '', brazeId: 'campaign-id', brazeType: 'campaign' },
        { id: 'local-2', name: 'Existing canvas', channel: 'Push', status: 'experiment', pos: 'top', x: 0, y: 0, sent: 0, opens: 0, clicks: 0, convs: 0, period: '', delivery: '', trigger: '', audience: '', convEvent: '', cap: '', link: '', brazeId: 'canvas-id', brazeType: 'canvas' },
      ],
    }],
  }],
} satisfies Client

describe('Braze import identity', () => {
  it('keeps campaign and canvas IDs distinct and normalizes IDs', () => {
    expect(brazeItemKey('campaign', '  ABC ')).toBe('campaign:abc')
    expect(brazeItemKey('campaign', 'same-id')).not.toBe(brazeItemKey('canvas', 'same-id'))
  })

  it('finds Braze items already added anywhere in the client board', () => {
    expect(getImportedBrazeKeys(client)).toEqual(new Set(['campaign:campaign-id', 'canvas:canvas-id']))
  })
})
