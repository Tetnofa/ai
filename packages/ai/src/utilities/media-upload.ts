import { arrayBufferToBase64, base64ToArrayBuffer } from '@tanstack/ai-utils'
import type { MediaUploader } from '../media-uploader'
import type { InternalLogger } from '../logger/internal-logger'

export const MEDIA_UPLOADER_REQUIRED =
  'Upstream URL not available; provide a mediaUploader to download and host the bytes.'

/** Pass response streams through without calling blob() or arrayBuffer(). */
export async function uploadMedia(
  source: Response | Blob | ReadableStream<Uint8Array>,
  uploader: MediaUploader,
  contentType: string,
): Promise<string> {
  let body: Blob | ReadableStream<Uint8Array>
  if (source instanceof Response) {
    if (!source.ok || !source.body) {
      await source.body?.cancel()
      throw new Error(`Media download failed: ${source.status}`)
    }
    body = source.body
    contentType = source.headers.get('content-type') || contentType
  } else {
    body = source
    if (source instanceof Blob) contentType = source.type || contentType
  }
  try {
    const url = await uploader({ body, contentType })
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('mediaUploader must return a public HTTP(S) URL')
    }
    if (
      /\s/.test(url) ||
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    ) {
      throw new Error('mediaUploader must return a public HTTP(S) URL')
    }
    return url
  } finally {
    // Release unread network bytes when an uploader rejects or returns early.
    if (body instanceof ReadableStream && !body.locked) {
      await body.cancel().catch(() => {})
    }
  }
}

export function warnIfLargeMediaBuffer(
  byteLength: number,
  logger: InternalLogger,
): void {
  if (byteLength > 10 * 1024 * 1024) {
    logger.warn(
      'Media exceeds 10 MiB; configure mediaUploader to avoid base64 buffering.',
      {
        byteLength,
      },
    )
  }
}

/** Keep the existing speech result unless the caller opts into hosted media. */
export async function speechMedia(
  source: Response | Blob | ReadableStream<Uint8Array>,
  contentType: string,
  uploader: MediaUploader | undefined,
  logger: InternalLogger,
): Promise<{ audio: string; url?: string }> {
  if (uploader) {
    return { audio: '', url: await uploadMedia(source, uploader, contentType) }
  }
  const response = source instanceof Response ? source : new Response(source)
  const bytes = await response.arrayBuffer()
  warnIfLargeMediaBuffer(bytes.byteLength, logger)
  return { audio: arrayBufferToBase64(bytes) }
}

/** Inline JSON media is already buffered by the provider SDK. */
export async function uploadBase64Media(
  data: string,
  contentType: string,
  uploader: MediaUploader,
): Promise<string> {
  return uploadMedia(
    new Blob([base64ToArrayBuffer(data)], { type: contentType }),
    uploader,
    contentType,
  )
}
