import { describe, expect, it, vi } from 'vitest'
import { resolveDebugOption } from '../src/logger/resolve'
import {
  speechMedia,
  uploadMedia,
  warnIfLargeMediaBuffer,
} from '../src/utilities/media-upload'

describe('media upload', () => {
  it('streams 100 MiB with backpressure without accumulating bytes', async () => {
    let chunks = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunks++ < 100) controller.enqueue(new Uint8Array(1024 * 1024))
        else controller.close()
      },
    })
    const result = await uploadMedia(
      stream,
      async ({ body }) => {
        expect(body).toBe(stream)
        let total = 0
        await stream.pipeTo(
          new WritableStream({
            write(chunk) {
              total += chunk.byteLength
            },
          }),
        )
        expect(total).toBe(100 * 1024 * 1024)
        return 'https://storage.example/large.mp4'
      },
      'video/mp4',
    )
    expect(result).toBe('https://storage.example/large.mp4')
  })

  it('cancels unread bytes and propagates uploader errors without fallback', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream({ cancel })
    await expect(
      uploadMedia(
        stream,
        async () => {
          throw new Error('Storage unavailable')
        },
        'video/mp4',
      ),
    ).rejects.toThrow('Storage unavailable')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('rejects failed downloads and invalid uploader URLs', async () => {
    const uploader = vi.fn()
    await expect(
      uploadMedia(
        new Response('error', { status: 403 }),
        uploader,
        'video/mp4',
      ),
    ).rejects.toThrow('403')
    expect(uploader).not.toHaveBeenCalled()
    await expect(
      uploadMedia(
        new Blob(),
        async () => 'data:video/mp4;base64,AA==',
        'video/mp4',
      ),
    ).rejects.toThrow('HTTP(S)')
  })

  it('keeps base64 speech by default', async () => {
    expect(
      await speechMedia(
        new Response('audio'),
        'audio/mpeg',
        undefined,
        resolveDebugOption(false),
      ),
    ).toEqual({ audio: btoa('audio') })
  })

  it('routes size warnings through the configured logger and honors debug:false', () => {
    const warn = vi.fn()
    const logger = resolveDebugOption({
      logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
    })
    warnIfLargeMediaBuffer(10 * 1024 * 1024, logger)
    expect(warn).not.toHaveBeenCalled()
    warnIfLargeMediaBuffer(11 * 1024 * 1024, logger)
    expect(warn).toHaveBeenCalledOnce()
    const consoleWarn = vi.spyOn(console, 'warn')
    warnIfLargeMediaBuffer(11 * 1024 * 1024, resolveDebugOption(false))
    expect(consoleWarn).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
  })
})
