import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CampaignImageGallery from './CampaignImageGallery'
import type { CampaignImage } from '../types'

const images: CampaignImage[] = [
  { key: 'a', url: 'a.png', storagePath: 'c/a.png', width: 10, height: 10 },
  { key: 'b', url: 'b.png', storagePath: 'c/b.png', width: 10, height: 20 },
]

describe('CampaignImageGallery', () => {
  it('shows one image without navigation controls', () => {
    render(<CampaignImageGallery campaignId="c" images={[images[0]]} onImageError={vi.fn()} />)
    expect(screen.getByAltText('캠페인 이미지')).toBeTruthy()
    expect(screen.queryByText('1 / 1')).toBeNull()
  })
  it('navigates images with buttons and swipe and refreshes expired URLs', () => {
    const onImageError = vi.fn()
    render(<CampaignImageGallery campaignId="c" images={images} onImageError={onImageError} />)
    expect(screen.getByText('1 / 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다음 이미지' }))
    expect(screen.getByText('2 / 2')).toBeTruthy()
    const image = screen.getByAltText('캠페인 이미지')
    fireEvent.touchStart(image, { touches: [{ clientX: 150, clientY: 2 }] })
    fireEvent.touchEnd(image, { changedTouches: [{ clientX: 20, clientY: 2 }] })
    expect(screen.getByText('1 / 2')).toBeTruthy()
    fireEvent.error(screen.getByAltText('캠페인 이미지'))
    expect(onImageError).toHaveBeenCalledWith(images[0])
  })
  it('lets a card navigate attached images without starting a card drag', () => {
    const onPointerDown = vi.fn()
    render(<div onPointerDown={onPointerDown}><CampaignImageGallery campaignId="card" images={images} onImageError={vi.fn()} compact /></div>)
    fireEvent.pointerDown(screen.getByRole('button', { name: '다음 이미지' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 이미지' }))
    expect(screen.getByText('2 / 2')).toBeTruthy()
    expect(onPointerDown).not.toHaveBeenCalled()
  })
})
