import { supabase } from '../supabase'
import type { Campaign, CampaignImage, CampaignImageRecord } from '../types'

export const CAMPAIGN_IMAGE_BUCKET = 'campaign-images'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24

export function campaignImages(campaign: Pick<Campaign, 'images' | 'img'>): CampaignImage[] {
  const images = campaign.images ?? []
  if (!campaign.img || images.some((image) => image.url === campaign.img || image.key === `legacy:${campaign.img}`)) return images
  return [{ key: `legacy:${campaign.img}`, url: campaign.img }, ...images]
}

export function attachedCampaignImages(campaign: Pick<Campaign, 'images' | 'img'>): CampaignImage[] {
  return (campaign.images ?? []).filter((image) => Boolean(image.storagePath))
}

export function campaignImagesForStep(images: CampaignImage[], stepId: string, stepCount: number): CampaignImage[] {
  return images.filter((image) => image.stepId === stepId || (stepCount === 1 && !image.stepId))
}

export function reorderImageSubset(images: CampaignImage[], storagePaths: string[]): CampaignImage[] {
  const byPath = new Map(images.flatMap((image) => image.storagePath ? [[image.storagePath, image] as const] : []))
  const ordered = storagePaths.flatMap((path) => { const image = byPath.get(path); return image ? [image] : [] })
  const selected = new Set(ordered.map((image) => image.storagePath))
  let next = 0
  return images.map((image) => selected.has(image.storagePath ?? '') ? ordered[next++] : image)
}

export function imageRecords(images: CampaignImage[]): CampaignImageRecord[] {
  return images.flatMap((image) =>
    image.storagePath && Number.isFinite(image.width) && image.width > 0 && Number.isFinite(image.height) && image.height > 0
      ? [{ storagePath: image.storagePath, width: image.width, height: image.height, ...(image.stepId ? { stepId: image.stepId } : {}) }]
      : [],
  )
}

export function imageAspectRatio(width: number, height: number): number | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return width / height
}

export function isCampaignImageRecord(value: unknown): value is CampaignImageRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<CampaignImageRecord>
  return typeof record.storagePath === 'string'
    && record.storagePath.length > 0
    && (record.stepId === undefined || (typeof record.stepId === 'string' && record.stepId.length > 0))
    && imageAspectRatio(record.width ?? NaN, record.height ?? NaN) !== null
}

export async function signedCampaignImageUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CAMPAIGN_IMAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
  if (error) throw error
  if (!data?.signedUrl) throw new Error(`이미지 URL을 만들지 못했습니다: ${storagePath}`)
  return data.signedUrl
}

export async function signedCampaignImage(image: CampaignImageRecord): Promise<CampaignImage> {
  return {
    ...image,
    key: image.storagePath,
    url: await signedCampaignImageUrl(image.storagePath),
  }
}
