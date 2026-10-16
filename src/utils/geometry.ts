// Node track geometry. Each node column renders one continuous vertical
// track; the spine sits at a fixed y inside it, and campaign cards are
// absolutely positioned (x, y) inside the track instead of the handoff's
// button-ordered top/bottom lists, per the "freeform placement" requirement.
export const TRACK_WIDTH = 400
// An expanded campaign card (the README's design, with the placeholder
// image block) renders at ~266px tall. TRACK_HEIGHT and SPINE_Y are sized
// to comfortably stack two such cards on each side of the spine, with
// clearance so cards never cover the node's own label text.
export const TRACK_HEIGHT = 1250
export const SPINE_Y = 600

export function boardPositionFromGhost(
  ghostX: number,
  ghostY: number,
  canvasRect: { left: number; top: number },
  zoom: number,
): { x: number; y: number } {
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return { x: (ghostX - canvasRect.left) / scale, y: (ghostY - canvasRect.top) / scale }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function clampCardPosition(
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  trackW: number,
  trackH = TRACK_HEIGHT,
): { x: number; y: number } {
  return {
    x: clamp(x, 0, Math.max(0, trackW - cardW)),
    y: clamp(y, 0, Math.max(0, trackH - cardH)),
  }
}

export function trackHeightForCards(cards: { y: number; height: number }[], bottomPadding = 48): number {
  return Math.max(TRACK_HEIGHT, ...cards.map(({ y, height }) => y + height + bottomPadding))
}

export function boardTrackHeight(
  clients: { stages: { nodes: { campaigns: { id: string; y: number; boardY?: number }[] }[] }[] }[],
  open: Record<string, boolean>,
  measured: Record<string, number>,
): number {
  const cards = clients.flatMap((client) => client.stages.flatMap((stage) => stage.nodes.flatMap((node) => node.campaigns.map((campaign) => ({
    y: campaign.boardY ?? campaign.y,
    height: measured[campaign.id] ?? (open[campaign.id] ? 270 : 48),
  })))))
  return trackHeightForCards(cards)
}

export function posFromY(y: number, cardH: number): 'top' | 'bottom' {
  return y + cardH / 2 < SPINE_Y ? 'top' : 'bottom'
}
