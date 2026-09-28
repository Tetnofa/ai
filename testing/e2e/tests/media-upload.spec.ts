import { test, expect } from './fixtures'

test.describe('media upload', () => {
  test('a missing uploader surfaces an actionable error without downloading', async ({
    request,
  }) => {
    const response = await request.post('/api/media-upload')
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(body.downloaded).toBe(false)
    expect(body.result.status).toBe('failed')
    expect(body.result.error).toContain('mediaUploader')
  })

  test('streams a 100 MiB video through storage and returns its public URL', async ({
    request,
  }) => {
    const response = await request.post('/api/media-upload?upload=true')
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(body.uploadedBytes).toBe(100 * 1024 * 1024)
    expect(body.result).toMatchObject({
      status: 'completed',
      url: 'https://storage.example/video.mp4',
    })
  })

  test('speech SSE carries the hosted URL without base64 media', async ({
    page,
  }) => {
    await page.goto('/')
    const events = await page.evaluate(async () => {
      const response = await fetch(
        '/api/media-upload?kind=speech&upload=true',
        { method: 'POST' },
      )
      return response.text()
    })
    expect(events).toContain('https://storage.example/audio.mp3')
    expect(events).toContain('"audio":""')
    expect(events).toContain('RUN_FINISHED')
    expect(events).not.toContain('RUN_ERROR')
  })
})

test('video SSE surfaces the missing uploader as RUN_ERROR', async ({
  request,
}) => {
  const response = await request.post('/api/media-upload?stream=true')
  const events = await response.text()
  expect(events).toContain('RUN_ERROR')
  expect(events).toContain('mediaUploader')
  expect(events).not.toContain('generation:result')
})
