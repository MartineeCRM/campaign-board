// src/data/seed.test.ts
import { describe, expect, it } from 'vitest'
import { seed } from './seed'
import { SPINE_Y } from '../utils/geometry'

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
            if (campaign.pos === 'top') expect(campaign.y).toBeLessThan(SPINE_Y)
            else expect(campaign.y).toBeGreaterThanOrEqual(SPINE_Y)
          }
        }
      }
    }
  })
})
