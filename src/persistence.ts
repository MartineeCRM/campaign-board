import { supabase } from './supabase'
import type { Campaign, CardPos, Channel, Client, FunnelNode, LineStyle, Stage, Status } from './types'

// --- DB row shapes (snake_case, matching supabase/migrations/0001_init.sql) ---

interface ClientRow {
  id: string
  name: string
}
interface StageRow {
  id: string
  client_id: string
  name: string
  color: string
  position: number
}
interface NodeRow {
  id: string
  stage_id: string
  label: string
  sub: string
  line: LineStyle
  position: number
}
interface CampaignRow {
  id: string
  node_id: string
  braze_id: string | null
  braze_type: 'campaign' | 'canvas' | null
  name: string
  channel: Channel
  status: Status
  pos: CardPos
  x: number
  y: number
  period: string
  img: string | null
  delivery: string
  trigger_desc: string
  audience: string
  conv_event: string
  cap: string
  link: string
  sent: number
  opens: number
  clicks: number
  convs: number
  last_synced_at: string | null
  created_at?: string
}

function campaignFromRow(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    pos: row.pos,
    x: row.x,
    y: row.y,
    sent: row.sent,
    opens: row.opens,
    clicks: row.clicks,
    convs: row.convs,
    period: row.period,
    img: row.img ?? undefined,
    delivery: row.delivery,
    trigger: row.trigger_desc,
    audience: row.audience,
    convEvent: row.conv_event,
    cap: row.cap,
    link: row.link,
    brazeId: row.braze_id ?? undefined,
    brazeType: row.braze_type ?? undefined,
    lastSyncedAt: row.last_synced_at ?? undefined,
  }
}

function campaignToRow(campaign: Campaign, nodeId: string): CampaignRow {
  return {
    id: campaign.id,
    node_id: nodeId,
    braze_id: campaign.brazeId ?? null,
    braze_type: campaign.brazeType ?? null,
    name: campaign.name,
    channel: campaign.channel,
    status: campaign.status,
    pos: campaign.pos,
    x: campaign.x,
    y: campaign.y,
    period: campaign.period,
    img: campaign.img ?? null,
    delivery: campaign.delivery,
    trigger_desc: campaign.trigger,
    audience: campaign.audience,
    conv_event: campaign.convEvent,
    cap: campaign.cap,
    link: campaign.link,
    sent: campaign.sent,
    opens: campaign.opens,
    clicks: campaign.clicks,
    convs: campaign.convs,
    last_synced_at: campaign.lastSyncedAt ?? null,
  }
}

/** Fetches every client and its full stage/node/campaign tree in one
 * round trip (nested embed), then sorts each level by `position` locally
 * — more robust than relying on ordering nested nested selects. */
export async function loadAllClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, stages(id, name, color, position, funnel_nodes(id, label, sub, line, position, campaigns(*)))')

  if (error) throw error

  type RawNode = NodeRow & { campaigns: CampaignRow[] }
  type RawStage = StageRow & { funnel_nodes: RawNode[] }
  type RawClient = ClientRow & { stages: RawStage[] }

  return ((data ?? []) as unknown as RawClient[]).map(
    (c): Client => ({
      id: c.id,
      name: c.name,
      stages: [...c.stages]
        .sort((a, b) => a.position - b.position)
        .map(
          (s): Stage => ({
            id: s.id,
            name: s.name,
            color: s.color,
            nodes: [...s.funnel_nodes]
              .sort((a, b) => a.position - b.position)
              .map(
                (n): FunnelNode => ({
                  id: n.id,
                  label: n.label,
                  sub: n.sub,
                  line: n.line,
                  campaigns: n.campaigns.map(campaignFromRow),
                })
              ),
          })
        ),
    })
  )
}

async function deleteMissing(
  table: 'stages' | 'funnel_nodes' | 'campaigns',
  scopeColumn: 'client_id' | 'stage_id' | 'node_id',
  scopeValue: string | string[],
  keepIds: string[]
) {
  let query = supabase.from(table).delete()
  query = Array.isArray(scopeValue) ? query.in(scopeColumn, scopeValue) : query.eq(scopeColumn, scopeValue)
  if (keepIds.length > 0) query = query.not('id', 'in', `(${keepIds.join(',')})`)
  const { error } = await query
  if (error) throw error
}

/** Resyncs one client's entire tree to Supabase: upserts every current
 * row, then deletes any row under that client no longer present (relying
 * on ON DELETE CASCADE for children of a deleted stage/node). Simpler and
 * far less code than hand-writing a Supabase call per store action; the
 * tradeoff is re-sending the whole tree on every change rather than a
 * single targeted write, which is fine at this app's scale. */
export async function persistClient(client: Client): Promise<void> {
  const stageRows: StageRow[] = []
  const nodeRows: NodeRow[] = []
  const campaignRows: CampaignRow[] = []

  client.stages.forEach((stage, si) => {
    stageRows.push({ id: stage.id, client_id: client.id, name: stage.name, color: stage.color, position: si })
    stage.nodes.forEach((node, ni) => {
      nodeRows.push({
        id: node.id,
        stage_id: stage.id,
        label: node.label,
        sub: node.sub,
        line: node.line,
        position: ni,
      })
      node.campaigns.forEach((campaign) => campaignRows.push(campaignToRow(campaign, node.id)))
    })
  })

  const { error: clientError } = await supabase.from('clients').upsert({ id: client.id, name: client.name })
  if (clientError) throw clientError

  if (stageRows.length > 0) {
    const { error } = await supabase.from('stages').upsert(stageRows)
    if (error) throw error
  }
  if (nodeRows.length > 0) {
    const { error } = await supabase.from('funnel_nodes').upsert(nodeRows)
    if (error) throw error
  }
  if (campaignRows.length > 0) {
    const { error } = await supabase.from('campaigns').upsert(campaignRows)
    if (error) throw error
  }

  const stageIds = client.stages.map((s) => s.id)
  const nodeIds = client.stages.flatMap((s) => s.nodes.map((n) => n.id))
  const campaignIds = client.stages.flatMap((s) => s.nodes.flatMap((n) => n.campaigns.map((c) => c.id)))

  await deleteMissing('stages', 'client_id', client.id, stageIds)
  if (stageIds.length > 0) await deleteMissing('funnel_nodes', 'stage_id', stageIds, nodeIds)
  if (nodeIds.length > 0) await deleteMissing('campaigns', 'node_id', nodeIds, campaignIds)
}

export async function deleteClientRow(clientId: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) throw error
}
