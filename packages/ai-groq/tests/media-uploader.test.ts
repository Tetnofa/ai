import { expect, it, vi } from 'vitest'
import { resolveDebugOption } from '@tanstack/ai/adapter-internals'
import { createGroqSpeech } from '../src/adapters/tts'

it('streams Groq speech to the uploader with format metadata', async () => {
  const response = new Response(new Uint8Array([1, 2]), {
    headers: { 'content-type': 'audio/wav' },
  })
  const read = vi.spyOn(response, 'arrayBuffer')
  const uploader = vi.fn().mockResolvedValue('https://storage.example/groq.wav')
  const model = 'canopylabs/orpheus-v1-english'
  const adapter = createGroqSpeech(model, 'test-key', {
    mediaUploader: uploader,
  })
  Object.assign(adapter, {
    client: { audio: { speech: { create: async () => response } } },
  })
  const result = await adapter.generateSpeech({
    model,
    text: 'Hello',
    logger: resolveDebugOption(false),
  })
  expect(result).toMatchObject({
    audio: '',
    url: 'https://storage.example/groq.wav',
    contentType: 'audio/wav',
    format: 'wav',
  })
  expect(read).not.toHaveBeenCalled()
  expect(uploader).toHaveBeenCalledWith({
    body: response.body,
    contentType: 'audio/wav',
  })
})
