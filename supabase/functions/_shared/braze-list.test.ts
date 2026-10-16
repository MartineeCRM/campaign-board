import { fetchAllBrazePages, filterBrazeDrafts, hasMartineeTag } from './braze-list.ts'
import { describe, expect, it, vi } from 'vitest'

describe('Braze list helpers', () => {
  it('fetches pages until the last partial page', async () => {
    const requestedPages: number[] = []
    const pages = [Array.from({ length: 3 }, (_, i) => i), [3, 4, 5], []]

    const result = await fetchAllBrazePages(async (page) => {
      requestedPages.push(page)
      return pages[page]
    }, 3)

    expect(result).toEqual([0, 1, 2, 3, 4, 5])
    expect(requestedPages).toEqual([0, 1, 2])
  })

  it('matches the Martinee tag without case or whitespace differences', () => {
    expect(hasMartineeTag(['other', ' Martinee '])).toBe(true)
    expect(hasMartineeTag(['Martinee campaign'])).toBe(false)
    expect(hasMartineeTag(undefined)).toBe(false)
  })

  it('keeps only candidates explicitly confirmed as published', async () => {
    const items = [{ id: 'published' }, { id: 'draft' }, { id: 'unknown' }]
    const fetcher = vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify({
      draft: String(url).includes('published') ? false : String(url).includes('draft') ? true : undefined,
    })))

    const result = await filterBrazeDrafts(items, (id) => `https://braze.test/${id}`, {}, fetcher)
    expect(result).toEqual([{ id: 'published' }])
  })

  it('fails closed when draft status cannot be read', async () => {
    const fetcher = vi.fn(async () => new Response('forbidden', { status: 403 }))
    await expect(filterBrazeDrafts([{ id: 'campaign' }], (id) => id, {}, fetcher))
      .rejects.toThrow('details permission is required')
  })
})
