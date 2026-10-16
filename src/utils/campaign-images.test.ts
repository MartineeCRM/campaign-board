import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({ createSignedUrl: vi.fn() }))

vi.mock('../supabase', () => ({
  supabase: { storage: { from: vi.fn(() => storage) } },
}))

import { attachedCampaignImages, campaignImages, campaignImagesForStep, imageAspectRatio, imageRecords, reorderImageSubset, signedCampaignImageUrl } from './campaign-images'

const first = { key: 'first', storagePath: 'campaign/1/first.png', width: 200, height: 100, url: 'https://signed.example/first' }
const second = { key: 'second', storagePath: 'campaign/1/second.png', width: 100, height: 200, url: 'https://signed.example/second' }

describe('campaign image helpers', () => {
  beforeEach(() => storage.createSignedUrl.mockReset())

  it('uses the legacy img URL when there are no uploaded images', () => {
    expect(campaignImages({ images: [], img: 'https://cdn.example/old.png' })).toEqual([
      expect.objectContaining({ url: 'https://cdn.example/old.png' }),
    ])
  })

  it('preserves uploaded image order and strips temporary URLs before persistence', () => {
    expect(campaignImages({ images: [first, second] })).toEqual([first, second])
    expect(imageRecords([first, second])).toEqual([
      { storagePath: first.storagePath, width: 200, height: 100 },
      { storagePath: second.storagePath, width: 100, height: 200 },
    ])
  })

  it('keeps a legacy URL visible before uploaded images', () => {
    expect(campaignImages({ img: 'https://cdn.example/old.png', images: [first] }).map((image) => image.url)).toEqual([
      'https://cdn.example/old.png', 'https://signed.example/first',
    ])
  })

  it('shows only uploaded files for Canvas artwork', () => {
    expect(attachedCampaignImages({ img: 'https://braze.example/image.png', images: [first] })).toEqual([first])
  })

  it('keeps step assignments on stored attachments and shows legacy images on a single Canvas step', () => {
    const stepImage = { ...second, stepId: 'step-2' }
    expect(imageRecords([first, stepImage])).toEqual([
      { storagePath: first.storagePath, width: 200, height: 100 },
      { storagePath: second.storagePath, width: 100, height: 200, stepId: 'step-2' },
    ])
    const images = campaignImages({ images: [first, stepImage] })
    expect(campaignImagesForStep(images, 'step-1', 1)).toEqual([first])
    expect(campaignImagesForStep(images, 'step-2', 2)).toEqual([stepImage])
    expect(campaignImagesForStep(images, 'step-1', 2)).toEqual([])
  })

  it('reorders one step without removing attachments assigned to another step', () => {
    const images = [{ ...first, stepId: 'one' }, { ...second, stepId: 'two' },
      { key: 'third', storagePath: 'campaign/1/third.png', width: 10, height: 10, url: 'third', stepId: 'one' }]
    expect(reorderImageSubset(images, ['campaign/1/third.png', first.storagePath]).map((image) => image.key))
      .toEqual(['third', 'second', 'first'])
  })

  it('returns a finite aspect ratio only for positive dimensions', () => {
    expect(imageAspectRatio(200, 100)).toBe(2)
    expect(imageAspectRatio(100, 200)).toBe(0.5)
    expect(imageAspectRatio(0, 100)).toBeNull()
    expect(imageAspectRatio(100, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('resolves a fresh signed URL for a stored image path', async () => {
    storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/fresh' }, error: null })
    await expect(signedCampaignImageUrl(first.storagePath)).resolves.toBe('https://signed.example/fresh')
  })
})
