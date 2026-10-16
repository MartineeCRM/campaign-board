import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoardStore } from '../store'
import type { Client } from '../types'
import { useCardDrag } from './useCardDrag'

const testClient: Client = {
  id: 'client', name: 'Client', stages: [{ id: 'stage', name: 'Stage', color: '#000', nodes: [{
    id: 'node', label: 'Node', sub: 'event', line: 'solid', campaigns: [{
      id: 'campaign', name: 'Campaign', channel: 'Push', status: 'alwayson', pos: 'top', x: 10, y: 20,
      sent: 0, opens: 0, clicks: 0, convs: 0, period: '', delivery: '', trigger: '', audience: '', convEvent: '', cap: '', link: '',
    }],
  }] }],
}

function DragHarness() {
  const drag = useCardDrag('campaign', 100, 100, 1500)
  return <div data-testid="drag-handle" style={{ opacity: drag.isDragging ? 0.25 : 1 }} onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp} />
}

describe('campaign board drag', () => {
  beforeEach(() => {
    useBoardStore.setState({ clients: [structuredClone(testClient)], clientId: 'client', zoom: 1, cardHeights: {}, dataLoaded: false })
    vi.stubGlobal('PointerEvent', MouseEvent)
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() })
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: vi.fn(() => true) })
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() })
  })

  it('drops a card into blank board space without reassigning it to a node', () => {
    const canvas = document.createElement('div')
    canvas.dataset.campaignCanvas = ''
    canvas.getBoundingClientRect = () => ({ left: 50, top: 50, right: 2050, bottom: 1550, width: 2000, height: 1500, x: 50, y: 50, toJSON: () => ({}) }) as DOMRect
    Object.defineProperty(canvas, 'clientWidth', { value: 2000 })
    Object.defineProperty(canvas, 'clientHeight', { value: 1500 })
    document.body.append(canvas)
    const view = render(<DragHarness />)
    const handle = view.getByTestId('drag-handle')
    handle.getBoundingClientRect = () => ({ left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 110, clientY: 110 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 500, clientY: 400 })

    const campaign = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(campaign).toMatchObject({ boardX: 440, boardY: 340 })
    expect(useBoardStore.getState().currentClient().stages[0].nodes[0].id).toBe('node')
    view.unmount()
    canvas.remove()
  })

  it('keeps a card dropped beyond the canvas attached to the nearest board edge', () => {
    const canvas = document.createElement('div')
    canvas.dataset.campaignCanvas = ''
    canvas.getBoundingClientRect = () => ({ left: 50, top: 50, right: 2050, bottom: 1550, width: 2000, height: 1500, x: 50, y: 50, toJSON: () => ({}) }) as DOMRect
    document.body.append(canvas)
    const view = render(<DragHarness />)
    const handle = view.getByTestId('drag-handle')
    handle.getBoundingClientRect = () => ({ left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 110, clientY: 110 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 2100, clientY: 1600 })

    const campaign = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(campaign).toMatchObject({ boardX: 1900, boardY: 1400 })
    view.unmount()
    canvas.remove()
  })

  it('cancels a drag on Escape and ignores the later pointer up', () => {
    const canvas = document.createElement('div')
    canvas.dataset.campaignCanvas = ''
    canvas.getBoundingClientRect = () => ({ left: 50, top: 50, right: 2050, bottom: 1550, width: 2000, height: 1500, x: 50, y: 50, toJSON: () => ({}) }) as DOMRect
    document.body.append(canvas)
    const view = render(<DragHarness />)
    const handle = view.getByTestId('drag-handle')
    handle.getBoundingClientRect = () => ({ left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 110, clientY: 110 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500, clientY: 400 })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 500, clientY: 400 })

    const campaign = useBoardStore.getState().currentClient().stages[0].nodes[0].campaigns[0]
    expect(campaign.boardX).toBeUndefined()
    expect(campaign.boardY).toBeUndefined()
    expect((view.getByTestId('drag-handle') as HTMLElement).style.opacity).toBe('1')
    view.unmount()
    canvas.remove()
  })
})
