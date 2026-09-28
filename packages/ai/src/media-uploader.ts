/** Bytes to store without buffering the whole response in the adapter. */
export interface MediaUploadInput {
  body: ReadableStream<Uint8Array> | Blob
  contentType: string
}

/**
 * Store generated media and return a public HTTP(S) URL. Consume streams with
 * backpressure; calling arrayBuffer() here still buffers the entire asset.
 * Provider Files APIs that return private file IDs do not supply public URLs.
 */
export type MediaUploader = (input: MediaUploadInput) => Promise<string>
