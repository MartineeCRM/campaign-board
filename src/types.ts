export type LineStyle = 'solid' | 'dashed' | 'dotted'
export type Status = 'alwayson' | 'experiment' | 'stopped'
export type Channel = 'Push' | 'Kakao' | 'Email' | 'In-app' | 'SMS' | 'Banner' | 'Webhook'
export type CardPos = 'top' | 'bottom'
export type Mode = 'full' | 'click'
export type BrazeType = 'campaign' | 'canvas'

export interface CampaignImageRecord {
  storagePath: string
  width: number
  height: number
  /** Canvas message step associated with this uploaded image. */
  stepId?: string
}

export interface CampaignImageDisplay extends CampaignImageRecord {
  key: string
  url: string
}

export interface CampaignImageLegacyDisplay {
  key: string
  url: string
  storagePath?: undefined
  width?: undefined
  height?: undefined
  stepId?: undefined
}

export type CampaignImage = CampaignImageDisplay | CampaignImageLegacyDisplay

export interface CanvasStep {
  id: string
  name: string
  channel: string
  sent: number
  opens: number
  clicks: number
  engagements: number
  conversionCounts: number[]
}

export interface Campaign {
  id: string
  name: string
  channel: Channel
  status: Status
  pos: CardPos
  x: number
  y: number
  /** Free-form position in the whole board canvas; legacy x/y remain node-relative for untouched cards. */
  boardX?: number
  boardY?: number
  sent: number
  opens: number
  clicks: number
  convs: number
  /** Braze conversion event counts in order: primary event, then B, C, etc. */
  conversionCounts?: number[]
  /** True when the latest completed 7-day period is down at least 20% vs the prior 7 days. */
  wowDrops?: Partial<Record<'sent' | 'opens' | 'clicks' | 'convs', boolean>> & { conversionCounts?: boolean[] }
  period: string
  img?: string
  images?: CampaignImage[]
  canvasSteps?: CanvasStep[]
  delivery: string
  trigger: string
  audience: string
  convEvent: string
  cap: string
  link: string
  brazeId?: string
  brazeType?: BrazeType
  brazeIsActive?: boolean
  lastSyncedAt?: string
}

export interface FunnelNode {
  id: string
  label: string
  sub: string
  line: LineStyle
  campaigns: Campaign[]
}

export interface Stage {
  id: string
  name: string
  color: string
  nodes: FunnelNode[]
}

export interface Client {
  id: string
  name: string
  sheetsTab?: string
  /** Which In-App Message button clicks count toward the campaign click metric. */
  iamClickCount?: 'first' | 'both'
  /** Conversion event slot to display across this client's campaigns. */
  conversionEventIndex?: number
  stages: Stage[]
}

export interface BoardState {
  clients: Client[]
  clientId: string
  mode: Mode
  edit: boolean
  open: Record<string, boolean>
  sel: string | null
  sync: number
  syncSheetsMessage: string | null
  /** False until the initial Supabase fetch completes — distinguishes
   * "no clients yet" (seed on first run) from "haven't loaded yet". */
  dataLoaded: boolean
}
