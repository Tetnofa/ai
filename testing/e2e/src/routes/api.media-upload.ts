import { createFileRoute } from '@tanstack/react-router'
import {
  generateSpeech,
  generateVideo,
  getVideoJobStatus,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { createOpenaiSpeech, createOpenaiVideo } from '@tanstack/ai-openai'
import { mediaResponse } from '../../fixtures/media-upload/upstream'
import type { MediaUploader } from '@tanstack/ai'

export const Route = createFileRoute('/api/media-upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const speech = params.get('kind') === 'speech'
        let downloaded = false
        let uploadedBytes = 0
        const mediaUploader: MediaUploader = async ({ body, contentType }) => {
          if (!(body instanceof ReadableStream))
            throw new Error('Expected a stream')
          await body.pipeTo(
            new WritableStream<Uint8Array>({
              write(chunk) {
                uploadedBytes += chunk.byteLength
              },
            }),
          )
          if (contentType !== (speech ? 'audio/mpeg' : 'video/mp4'))
            throw new Error('Incorrect media type')
          return `https://storage.example/${speech ? 'audio.mp3' : 'video.mp4'}`
        }
        // Exercise real SDK deserialization and activities with a local binary fixture.
        const mockFetch: typeof fetch = async (input) => {
          const url = input instanceof Request ? input.url : String(input)
          if (url.endsWith('/content') || url.endsWith('/audio/speech')) {
            downloaded = true
            return mediaResponse(
              speech ? 1 : 100,
              speech ? 'audio/mpeg' : 'video/mp4',
            )
          }
          return Response.json({ id: 'job', status: 'completed' })
        }
        const config = {
          fetch: mockFetch,
          ...(params.get('upload') === 'true' ? { mediaUploader } : {}),
        }
        if (speech) {
          const stream = generateSpeech({
            adapter: createOpenaiSpeech(
              'gpt-4o-audio-preview',
              'test-key',
              config,
            ),
            text: 'Hello',
            stream: true,
            debug: false,
          })
          return toServerSentEventsResponse(stream)
        }
        if (params.get('stream') === 'true') {
          return toServerSentEventsResponse(
            generateVideo({
              adapter: createOpenaiVideo('sora-2', 'test-key', config),
              prompt: 'A lake',
              stream: true,
              pollingInterval: 0,
              debug: false,
            }),
          )
        }
        const result = await getVideoJobStatus({
          adapter: createOpenaiVideo('sora-2', 'test-key', config),
          jobId: 'job',
        })
        return Response.json({ result, downloaded, uploadedBytes })
      },
    },
  },
})
