/** A lazy binary response: no preallocated 100 MiB fixture or real API key. */
export function mediaResponse(chunks: number, contentType: string): Response {
  let sent = 0
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < chunks) controller.enqueue(new Uint8Array(1024 * 1024))
        else controller.close()
      },
    }),
    { headers: { 'content-type': contentType } },
  )
}
