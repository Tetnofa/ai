import { afterEach, describe, expect, it, vi } from 'vitest'
import { getVideoJobStatus } from '@tanstack/ai'
import { resolveDebugOption } from '@tanstack/ai/adapter-internals'
import { createOpenaiVideo } from '../src/adapters/video'
import { createOpenaiSpeech } from '../src/adapters/tts'
import { createOpenaiImage } from '../src/adapters/image'

const logger = resolveDebugOption(false)
afterEach(() => vi.restoreAllMocks())

function videoResource(
  method: string,
  response: unknown,
  uploader?: () => Promise<string>,
) {
  const adapter = createOpenaiVideo('sora-2', 'test-key', {
    mediaUploader: uploader,
  })
  const retrieve = vi.fn().mockResolvedValue({ id: 'job', status: 'completed' })
  const download = vi.fn().mockResolvedValue(response)
  Object.assign(adapter, {
    client: { videos: { retrieve, [method]: download } },
  })
  return { adapter, retrieve, download }
}

describe('mediaUploader', () => {
  it('does not download video without an uploader, and surfaces the reason through the activity', async () => {
    const { adapter, download } = videoResource(
      'downloadContent',
      new Response('video'),
    )
    expect(await adapter.getVideoUrl('job')).toEqual({
      jobId: 'job',
      url: '',
      error: expect.stringContaining('mediaUploader'),
    })
    expect(await getVideoJobStatus({ adapter, jobId: 'job' })).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('mediaUploader'),
    })
    expect(download).not.toHaveBeenCalled()
  })

  it('passes upstream URLs through without downloading or uploading', async () => {
    const uploader = vi.fn()
    const { adapter, retrieve, download } = videoResource(
      'downloadContent',
      null,
      uploader,
    )
    retrieve.mockResolvedValue({ url: 'https://cdn.example/video.mp4' })
    expect((await adapter.getVideoUrl('job')).url).toBe(
      'https://cdn.example/video.mp4',
    )
    expect(download).not.toHaveBeenCalled()
    expect(uploader).not.toHaveBeenCalled()
  })

  it.each(['downloadContent', 'content', 'getContent', 'download'])(
    'streams %s directly to storage',
    async (method) => {
      const response = new Response('video', {
        headers: { 'content-type': 'video/webm' },
      })
      const arrayBuffer = vi.spyOn(response, 'arrayBuffer')
      const blob = vi.spyOn(response, 'blob')
      const uploader = vi.fn().mockResolvedValue('https://storage.example/clip')
      const { adapter } = videoResource(method, response, uploader)
      expect((await adapter.getVideoUrl('job')).url).toBe(
        'https://storage.example/clip',
      )
      expect(uploader).toHaveBeenCalledWith({
        body: response.body,
        contentType: 'video/webm',
      })
      expect(arrayBuffer).not.toHaveBeenCalled()
      expect(blob).not.toHaveBeenCalled()
    },
  )

  it('uploads Blob responses without reading them', async () => {
    const blob = new Blob(['video'], { type: 'video/webm' })
    const read = vi.spyOn(blob, 'arrayBuffer')
    const uploader = vi.fn().mockResolvedValue('https://storage.example/clip')
    const { adapter } = videoResource('content', blob, uploader)
    await adapter.getVideoUrl('job')
    expect(uploader).toHaveBeenCalledWith({
      body: blob,
      contentType: 'video/webm',
    })
    expect(read).not.toHaveBeenCalled()
  })

  it('uses the configured SDK transport for the content fallback', async () => {
    const adapter = createOpenaiVideo('sora-2', 'test-key', {
      mediaUploader: async () => 'https://storage.example/clip',
    })
    const get = vi.fn().mockResolvedValue(new Response('clip'))
    Object.assign(adapter, {
      client: { get, videos: { retrieve: async () => ({}) } },
    })
    await adapter.getVideoUrl('job/1')
    expect(get).toHaveBeenCalledWith('/videos/job%2F1/content', {
      headers: { Accept: 'video/mp4' },
      __binaryResponse: true,
    })
  })

  it('does not buffer speech when an uploader is configured', async () => {
    const response = new Response(new TextEncoder().encode('audio'), {
      headers: { 'content-type': 'audio/mpeg' },
    })
    const read = vi.spyOn(response, 'arrayBuffer')
    const uploader = vi
      .fn()
      .mockResolvedValue('https://storage.example/speech.mp3')
    const adapter = createOpenaiSpeech('tts-1', 'test-key', {
      mediaUploader: uploader,
    })
    Object.assign(adapter, {
      client: { audio: { speech: { create: async () => response } } },
    })
    const result = await adapter.generateSpeech({
      text: 'Hello',
      model: 'tts-1',
      logger,
    })
    expect(result).toMatchObject({
      audio: '',
      url: 'https://storage.example/speech.mp3',
    })
    expect(read).not.toHaveBeenCalled()
    expect(uploader).toHaveBeenCalledWith({
      body: response.body,
      contentType: 'audio/mpeg',
    })
  })

  it('uploads inline image output and preserves revised prompts', async () => {
    const uploader = vi.fn(
      async ({ body }: { body: Blob | ReadableStream<Uint8Array> }) => {
        expect(await new Response(body).text()).toBe('image')
        return 'https://storage.example/image.png'
      },
    )
    const adapter = createOpenaiImage('gpt-image-2', 'test-key', {
      mediaUploader: uploader,
    })
    Object.assign(adapter, {
      client: {
        images: {
          generate: async () => ({
            data: [{ b64_json: btoa('image'), revised_prompt: 'Revised' }],
          }),
        },
      },
    })
    const result = await adapter.generateImages({
      prompt: 'An image',
      model: 'gpt-image-2',
      logger,
    })
    expect(result.images).toEqual([
      { url: 'https://storage.example/image.png', revisedPrompt: 'Revised' },
    ])
  })
})
