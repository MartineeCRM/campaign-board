import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CampaignImageAttachments from './CampaignImageAttachments'
import type { CampaignImage } from '../types'

const images: CampaignImage[] = [
  { key: 'a', url: 'a.png', storagePath: 'c/a.png', width: 10, height: 10 },
  { key: 'b', url: 'b.png', storagePath: 'c/b.png', width: 10, height: 10 },
]

describe('CampaignImageAttachments', () => {
  it('adds selected image files in order', () => {
    const onAdd = vi.fn()
    render(<CampaignImageAttachments campaignId="c" images={[]} onAdd={onAdd} onRemove={vi.fn()} onReorder={vi.fn()} />)
    const input = screen.getByLabelText('이미지 추가') as HTMLInputElement
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]
    fireEvent.change(input, { target: { files } })
    expect(onAdd).toHaveBeenCalledWith(files)
  })

  it('accepts dropped and pasted images while ignoring clipboard text', () => {
    const onAdd = vi.fn()
    render(<CampaignImageAttachments campaignId="c" images={[]} onAdd={onAdd} onRemove={vi.fn()} onReorder={vi.fn()} />)
    const target = screen.getByRole('group', { name: '캠페인 이미지' })
    const file = new File(['x'], 'x.png', { type: 'image/png' })
    fireEvent.drop(target, { dataTransfer: { files: [file] } })
    expect(onAdd).toHaveBeenLastCalledWith([file])
    onAdd.mockClear()
    fireEvent.paste(target, { clipboardData: { items: [{ type: 'image/png', getAsFile: () => file }, { type: 'text/plain', getAsFile: () => null }] } })
    expect(onAdd).toHaveBeenCalledWith([file])
    onAdd.mockClear()
    fireEvent.paste(target, { clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }] } })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('removes and reorders stored images', () => {
    const onRemove = vi.fn()
    const onReorder = vi.fn()
    render(<CampaignImageAttachments campaignId="c" images={images} onAdd={vi.fn()} onRemove={onRemove} onReorder={onReorder} />)
    fireEvent.click(screen.getByRole('button', { name: 'a.png 삭제' }))
    expect(onRemove).toHaveBeenCalledWith('c/a.png')
    fireEvent.dragStart(screen.getByLabelText('b.png 순서 변경'))
    fireEvent.drop(screen.getByLabelText('a.png 순서 변경'))
    expect(onReorder).toHaveBeenCalledWith(['c/b.png', 'c/a.png'])
  })
})
