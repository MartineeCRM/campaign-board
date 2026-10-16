export async function fetchAllBrazePages<T>(
  fetchPage: (page: number) => Promise<T[]>,
  pageSize = 100,
): Promise<T[]> {
  const items: T[] = []

  for (let page = 0; ; page += 1) {
    const currentPage = await fetchPage(page)
    items.push(...currentPage)
    if (currentPage.length < pageSize) return items
  }
}

export function hasMartineeTag(tags: string[] | undefined): boolean {
  return tags?.some((tag) => tag.trim().toLocaleLowerCase() === 'martinee') ?? false
}

export async function filterBrazeDrafts<T extends { id: string }>(
  items: T[],
  detailsUrl: (id: string) => string,
  headers: HeadersInit,
  fetcher: typeof fetch = fetch,
): Promise<T[]> {
  const published: T[] = []
  for (let i = 0; i < items.length; i += 8) {
    const results = await Promise.all(items.slice(i, i + 8).map(async (item) => {
      const response = await fetcher(detailsUrl(item.id), { headers })
      if (!response.ok) throw new Error(`Braze details ${response.status}; details permission is required to exclude drafts`)
      const detail = await response.json() as { draft?: boolean }
      return { item, published: detail.draft === false }
    }))
    published.push(...results.filter((result) => result.published).map((result) => result.item))
  }
  return published
}
