import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ select: vi.fn(), createSignedUrl: vi.fn() }))

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: mocks.select })),
    storage: { from: vi.fn(() => ({ createSignedUrl: mocks.createSignedUrl })) },
  },
}))

import { loadAllClients } from './persistence'
import { campaignImages } from './utils/campaign-images'

const row = {
  id: 'c1', name: 'Client', stages: [{
    id: 's1', name: 'Stage', color: '#000', position: 0, funnel_nodes: [{
      id: 'n1', label: 'Node', sub: 'event', line: 'solid', position: 0, campaigns: [{
        id: 'k1', node_id: 'n1', braze_id: null, braze_type: null, braze_is_active: null,
        name: 'Campaign', channel: 'Push', status: 'experiment', pos: 'top', x: 1, y: 2,
        period: '', img: 'https://cdn.example/legacy.png',
        images: [
          { storagePath: 'c1/k1/first.png', width: 320, height: 640 },
          { storagePath: 'c1/k1/second.png', width: 640, height: 320 },
        ],
        delivery: '', trigger_desc: '', audience: '', conv_event: '', cap: '', link: '',
        sent: 0, opens: 0, clicks: 0, convs: 0, last_synced_at: null,
      }],
    }],
  }],
}

describe('campaign image persistence', () => {
  beforeEach(() => {
    mocks.select.mockReset().mockResolvedValue({ data: [row], error: null })
    mocks.createSignedUrl.mockReset().mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://signed.example/${path}` }, error: null,
    }))
  })

  it('reloads ordered image metadata as signed display URLs and keeps the legacy URL', async () => {
    const [client] = await loadAllClients()
    const campaign = client.stages[0].nodes[0].campaigns[0]

    expect(campaign.images?.map((image) => [image.storagePath, image.url])).toEqual([
      ['c1/k1/first.png', 'https://signed.example/c1/k1/first.png'],
      ['c1/k1/second.png', 'https://signed.example/c1/k1/second.png'],
    ])
    expect(campaignImages(campaign).map((image) => image.url)).toEqual([
      'https://cdn.example/legacy.png',
      'https://signed.example/c1/k1/first.png',
      'https://signed.example/c1/k1/second.png',
    ])
    expect(campaign.img).toBe('https://cdn.example/legacy.png')
  })

  it('loads campaign data when signing fails and leaves the image available for retry', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: new Error('storage unavailable') })
    const [client] = await loadAllClients()
    const campaign = client.stages[0].nodes[0].campaigns[0]

    expect(campaign.name).toBe('Campaign')
    expect(campaign.images?.[0]).toMatchObject({ storagePath: 'c1/k1/first.png', url: '' })
  })
})
