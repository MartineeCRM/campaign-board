# Campaign image attachments and preview

## Goal

Let campaign editors attach multiple images from files, drag and drop, or clipboard paste. Keep the campaign card width independent of image dimensions, let its height follow the displayed image ratio, and show all attached images in a swipeable gallery above the metrics in the detail panel.

## Data and storage

- Upload image files to a private Supabase Storage bucket. Keep only each object's storage path, display order, and original width and height in campaign metadata.
- Add a non-null `images` JSONB array to `campaigns`, with each item containing `storage_path`, `width`, and `height`. Add the private bucket and authenticated access policies in a migration.
- Generate signed URLs for display; never persist temporary signed URLs.
- Generate signed URLs when campaign data loads and refresh them if an image URL expires or fails to load.
- Keep reading the existing `img` URL so current campaign images remain visible. New attachments use the multi-image collection.
- Accept browser-recognized image files. Storage enforces the configured upload-size limit and the interface reports rejected files clearly.
- Removing an attachment removes its storage object after the campaign update succeeds. Each uploaded object uses a campaign-specific unique path.

## Editing and display

- In edit mode, provide an image attachment area with a file picker, file drag-and-drop, clipboard image paste, ordered thumbnails, and per-image removal.
- Stop card drag gestures while a file is dragged over or an attachment control is used.
- The expanded card keeps the existing width rule. Its image uses the full card width and its intrinsic aspect ratio without cropping. The first attached image is the card preview; existing `img` remains the fallback when no new attachments exist.
- Measure the rendered expanded card height and pass it to drag clamping and position updates. Ensure the node track can contain cards whose image makes them taller than the current estimate.
- In the detail panel, place one image above the metrics. When multiple images are attached, support touch/trackpad swiping and previous/next controls with a position indicator. A single image has no navigation controls.
- In edit mode, newly added files preview immediately. Canceling edits restores the campaign's previous image list and removes newly uploaded objects that are no longer referenced.

## Acceptance criteria

1. A user can attach multiple image files using a picker, drag-and-drop, and clipboard paste.
2. Attachments retain their order and survive reloads and navigation to another signed-in device.
3. Existing single-URL images continue to render.
4. Adding a portrait or landscape image changes card height according to its ratio and does not change card width or crop the image.
5. Dragging a card uses its rendered height when clamping its position; tall cards remain within a scrollable node track.
6. The detail panel shows all attached images one at a time above the metrics, with swipe and button navigation for multiple images.
7. Canceling edit restores the pre-edit image collection and does not leave orphaned newly uploaded files.

## Scope and limits

- This is an image gallery, not a renderer for Braze's Preview and Test composer.
- Image attachment does not change Braze campaign creative or trigger a Braze test send.
- The current campaign width rule and existing image URL workflow remain compatible.
