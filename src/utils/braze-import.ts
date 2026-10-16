import type { BrazeType, Client } from '../types'

export function brazeItemKey(type: BrazeType, id: string): string {
  return `${type}:${id.trim().toLocaleLowerCase()}`
}

export function getImportedBrazeKeys(client: Client): Set<string> {
  const keys = new Set<string>()
  for (const stage of client.stages) {
    for (const node of stage.nodes) {
      for (const campaign of node.campaigns) {
        if (campaign.brazeId) keys.add(brazeItemKey(campaign.brazeType ?? 'campaign', campaign.brazeId))
      }
    }
  }
  return keys
}
