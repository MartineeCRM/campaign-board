# Campaign image attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the user-selected task-by-task execution workflow. Steps use checkbox syntax for tracking.

**Goal:** Support persistent multi-image campaign attachments, natural-height campaign cards, and an image carousel above detail-panel metrics.

**Architecture:** Keep image bytes in a private Supabase Storage bucket and persist ordered path/dimension metadata in `campaigns.images`. Resolve signed URLs at load time; keep the legacy `img` URL as a fallback. Centralize file intake and image operations, then feed measured rendered card heights into board geometry and drag clamping.

**Tech Stack:** React 18, TypeScript, Zustand, Supabase JS v2, Supabase SQL migrations, Vitest, Testing Library, jsdom.

**Spec:** `docs/design/campaign-image-gallery.md`

## Global Constraints

- Upload image files to a private Supabase Storage bucket.
- Keep only each object's storage path, display order, and original width and height in campaign metadata.
- Keep reading the existing `img` URL so current campaign images remain visible.
- Keep the expanded card's existing width rule; display images at full card width and intrinsic aspect ratio without cropping.
- In the detail panel, place one image above metrics and provide swipe plus previous/next controls and an indicator when there are multiple images.
- Canceling edits restores the prior image list and removes newly uploaded objects that are no longer referenced.
- Keep the feature scoped to campaign images; do not change Braze creative or send test messages.
- Do not commit, push, or merge changes.

## Review Focus

- Existing campaigns with only `img` still show that URL; test the legacy fallback in Task 1 and both card and panel rendering in Tasks 3 and 4.
- Corrupt or absent image dimensions never produce `NaN` sizing; Task 1 tests metadata validation and image-ratio helpers.
- Clipboard events with text but no image do not create empty attachments; Task 2 tests mixed clipboard contents.
- Portrait image load changes measured card height and drag clamping while width remains unchanged; Task 3 tests dynamic measurement and geometry.
- Signed URL expiry, storage upload failure, and cancel cleanup never leave broken visible entries or orphaned new objects; Task 1 tests URL resolution, Task 2 tests upload errors, and Task 4 tests cancel cleanup.

---

## File map

- `src/types.ts` — persisted image metadata, resolved display image, and `Campaign.images`.
- `supabase/migrations/0006_campaign_images.sql` — `images` JSONB column, private bucket, and authenticated object policies.
- `src/utils/campaign-images.ts` — legacy fallback, metadata validation, dimension extraction, ordered image helpers, and display URL resolution.
- `src/utils/campaign-images.test.ts` — pure helper tests.
- `src/persistence.ts` — campaign image row mapping, signed URL resolution, and metadata persistence.
- `src/store.ts` — upload/remove image actions and edit-cancel cleanup.
- `src/components/CampaignImageAttachments.tsx` — picker, drag/drop, paste, ordered thumbnails, removal, and per-file error display.
- `src/components/CampaignCard.tsx` — first-image card preview and edit attachment controls.
- `src/components/NodeColumn.tsx` — rendered card measurement and measured height passed into drag handling.
- `src/hooks/useCardDrag.ts` — use current measured card height for position updates.
- `src/utils/geometry.ts` — dynamic track bounds and card-height-aware clamping.
- `src/components/StageColumn.tsx`, `src/components/AddStageButton.tsx` — use the shared dynamic track height.
- `src/components/DetailPanel.tsx` — swipeable multi-image gallery above metrics.
- `src/components/CampaignImageAttachments.test.tsx`, `src/components/CampaignImageGallery.test.tsx` — user-visible intake and gallery behavior.
- Create: `src/persistence.test.ts` — legacy row loading, ordered multi-image reload, and signed URL behavior.
- `src/store.test.ts` — edit-cancel cleanup behavior without replacing unrelated fixtures.

## Task 1: Campaign image model, storage, and persistence

**Files:**
- Create: `supabase/migrations/0006_campaign_images.sql`
- Create: `src/utils/campaign-images.ts`
- Create: `src/utils/campaign-images.test.ts`
- Modify: `src/types.ts`
- Modify: `src/persistence.ts`

**Interfaces:**
- `CampaignImageRecord = { storagePath: string; width: number; height: number }` is persisted metadata.
- `CampaignImageDisplay = { key: string; url: string; storagePath?: string; width?: number; height?: number }` is the resolved UI value; legacy URLs have no storage path or known dimensions.
- `Campaign.images?: CampaignImageDisplay[]` is ordered by array order. `Campaign.img` remains the legacy external URL.
- `campaignImages(campaign)` returns resolved `images` when non-empty, otherwise returns a one-item display image for `img`, or `[]`.
- `imageAspectRatio(width, height)` returns a finite positive ratio or `null` for invalid dimensions.

- [x] **Step 1: Add failing helper tests**

```ts
const first = { key: 'first', storagePath: 'campaign/1/first.png', width: 200, height: 100, url: 'https://signed.example/first' }
const second = { key: 'second', storagePath: 'campaign/1/second.png', width: 100, height: 200, url: 'https://signed.example/second' }

it('uses the legacy img URL when there are no uploaded images', () => {
  expect(campaignImages({ images: [], img: 'https://cdn.example/old.png' })).toEqual([
    expect.objectContaining({ url: 'https://cdn.example/old.png' }),
  ])
})

it('preserves uploaded image order and rejects invalid dimensions', () => {
  expect(campaignImages({ images: [first, second], img: 'https://cdn.example/old.png' })).toEqual([first, second])
  expect(imageAspectRatio(0, 300)).toBeNull()
  expect(imageAspectRatio(200, 100)).toBe(2)
})

it('requests a fresh signed URL after a stored image URL fails to load', async () => {
  expect(await refreshImageUrl(first.storagePath)).toBe('https://signed.example/fresh')
})
```

- [x] **Step 2: Run `npm test -- src/utils/campaign-images.test.ts` and confirm these assertions fail because the helper module is absent.**
- [x] **Step 3: Add `CampaignImageRecord`, `CampaignImage`, `Campaign.images`, and helpers that preserve order and validate positive finite dimensions.**
- [x] **Step 4: Add the migration with `campaigns.images jsonb not null default '[]'::jsonb`, a private `campaign-images` bucket, and authenticated select/insert/update/delete policies scoped to that bucket.**
- [x] **Step 5: Update row mapping to persist only `storage_path`, `width`, and `height`; resolve private signed URLs on load, retry signing when a resolved URL fails, and retain `img` fallback.**
- [x] **Step 6: Add `src/persistence.test.ts` for reading a legacy row and for reloading two ordered image records into resolved display images.**
- [x] **Step 7: Run `npm test -- src/utils/campaign-images.test.ts src/persistence.test.ts`; confirm legacy fallback, ordering, invalid dimensions, signed URL refresh, and persisted reload pass.**

## Task 2: File intake and image lifecycle

**Files:**
- Create: `src/components/CampaignImageAttachments.tsx`
- Create: `src/components/CampaignImageAttachments.test.tsx`
- Modify: `src/store.ts`
- Modify: `src/persistence.ts` only if the upload helper needs a shared persistence boundary.

**Interfaces:**
- `addCampaignImages(campaignId, files)` uploads valid image files to `campaign-images/<campaignId>/<uuid>-<safe-name>`, records dimensions and appends in order.
- `removeCampaignImage(campaignId, storagePath)` persists removal before deleting the private object.
- `discardUnreferencedCampaignImages(previousClient, editedClient)` removes newly uploaded paths absent from the restored snapshot.
- `CampaignImageAttachments` accepts `campaignId`, resolved `images`, `onAdd(files)`, `onRemove(storagePath)`, and `onReorder(storagePaths)`.

- [x] **Step 1: Add failing component tests:** selecting two files calls `onAdd` in selection order; dropping two image files calls `onAdd`; pasting an image plus text adds only the image; pasting text only adds nothing; removing an item calls `onRemove` with its storage path.
- [x] **Step 2: Run `npm test -- src/components/CampaignImageAttachments.test.tsx` and verify failures are caused by the missing component.**
- [x] **Step 3: Implement a hidden `input[type=file][multiple][accept=image/*]`, a keyboard-accessible drop target, clipboard `image/*` extraction, ordered thumbnails with drag reorder, and per-file upload errors. Stop propagation for pointer and drag events so board card dragging does not start.**
- [x] **Step 4: Implement upload and removal actions with UUID object paths; use `createImageBitmap` or an `Image` object to read intrinsic dimensions and close/release temporary resources.**
- [x] **Step 5: Add edit-cancel cleanup by diffing uploaded paths against the edit snapshot and removing only paths that became unreferenced after restore. Preserve already-persisted images and external `img` URLs.**
- [x] **Step 6: Run the intake component tests and relevant store tests; confirm upload errors leave the previous image list intact and cancel cleanup targets only new orphan paths.**

## Task 3: Natural-height card preview and board geometry

**Files:**
- Modify: `src/components/CampaignCard.tsx`
- Modify: `src/components/NodeColumn.tsx`
- Modify: `src/hooks/useCardDrag.ts`
- Modify: `src/utils/geometry.ts`
- Modify: `src/components/StageColumn.tsx`
- Modify: `src/components/AddStageButton.tsx`
- Create or modify: `src/utils/geometry.test.ts`

**Interfaces:**
- Expanded card displays the first `campaignImages(k)` image, using `width: 100%`, `height: auto`, and `objectFit: contain`; image dimensions do not change the existing card width.
- `DraggableCard` observes its rendered card height and passes the measured height to `useCardDrag` and `moveCampaignTo`/`moveCampaignToNode`.
- Node track height is at least the standard height and extends to contain every card's `y + measuredHeight + bottomPadding`.

- [x] **Step 1: Add failing geometry tests for clamping using a measured 700px card, maintaining horizontal bounds, and computing enough track height for its bottom edge.**
- [x] **Step 2: Run `npm test -- src/utils/geometry.test.ts` and verify failures demonstrate that geometry currently assumes fixed `TRACK_HEIGHT`.**
- [x] **Step 3: Add a `ResizeObserver` measurement in `DraggableCard`; keep the existing width calculation and update drag bounds whenever measured height changes.**
- [x] **Step 4: Make the node track extend to the maximum campaign bottom while keeping stage and add-node tracks aligned to the same track height.**
- [x] **Step 5: Replace cropped/max-height card image rendering with intrinsic-ratio rendering; show the current first image and retain the placeholder when no image exists. Mount `CampaignImageAttachments` in card edit mode.**
- [x] **Step 6: Run geometry and card tests; verify portrait/landscape image load, width stability, and drag clamping with the measured height.**

## Task 4: Detail panel gallery and integrated verification

**Files:**
- Create: `src/components/CampaignImageGallery.test.tsx`
- Modify: `src/components/DetailPanel.tsx`
- Modify: `src/store.test.ts` and `src/persistence.test.ts` only for image reload and cancellation coverage.

**Interfaces:**
- `CampaignImageGallery` receives `images: CampaignImage[]`, shows the current image, and provides `onImageError(image)` for signed URL refresh.
- One image renders without navigation; multiple images render previous/next controls, an `n / total` indicator, and touch/trackpad navigation.

- [x] **Step 1: Add failing gallery tests:** one image has no navigation controls; two images show `1 / 2`; next and previous change the current image; a swipe gesture changes the image; failed signed URL invokes refresh.
- [x] **Step 2: Run `npm test -- src/components/CampaignImageGallery.test.tsx` and confirm expected failures.**
- [x] **Step 3: Implement a controlled-by-component index with bounds-safe navigation; reset index when campaign/image count changes; render the gallery immediately above the metrics.**
- [x] **Step 4: Add persistence/store tests for two ordered images after `loadAllClients` and for cancel restoring the old image list and cleaning only new objects.**
- [x] **Step 5: Run the focused image utility, attachment, geometry, gallery, persistence, and store tests.**
- [x] **Step 6: Run `npm run build` and `git diff --check`; record any pre-existing build failures separately from image-feature failures.**

## Plan self-review

- **Spec coverage:** storage and metadata are Task 1; picker/drop/paste/reorder/remove and cancel cleanup are Task 2; fixed width, intrinsic image sizing, measured card height, and track growth are Task 3; gallery placement, swipe, controls, and indicator are Task 4.
- **Placeholder scan:** every step names a concrete file, action, and expected check; helper/component contracts and focused test commands are explicit.
- **Type consistency:** persisted metadata uses `CampaignImageRecord`; UI display uses `CampaignImageDisplay` with a resolved `url`; campaign state carries the resolved ordered array.
- **Review focus:** all five failure modes are assigned tests in Tasks 1–4. Storage and browser behavior will also receive manual QA in the running app after the automated checks.
