export type LineStyle = 'solid' | 'dashed' | 'dotted'
export type Status = 'alwayson' | 'experiment' | 'stopped'
export type Channel = 'Push' | 'Kakao' | 'Email' | 'In-app' | 'SMS'
export type CardPos = 'top' | 'bottom'
export type Mode = 'full' | 'click'

export interface Campaign {
  id: string
  name: string
  channel: Channel
  status: Status
  pos: CardPos
  x: number
  y: number
  sent: number
  opens: number
  clicks: number
  convs: number
  rate: { o: number; c: number; v: number }
  period: string
  img?: string
  delivery: string
  trigger: string
  audience: string
  convEvent: string
  cap: string
  link: string
  brazeId?: string
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
}
