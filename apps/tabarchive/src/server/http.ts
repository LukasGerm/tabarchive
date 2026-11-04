import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers })
}

export async function respond(work: () => Promise<Response> | Response) {
  let response: Response
  try {
    response = await work()
  } catch (error) {
    if (error instanceof HttpError)
      response = json({ error: error.message }, error.status)
    else if (error instanceof ZodError)
      response = json(
        { error: error.issues[0]?.message ?? 'Invalid input.' },
        400,
      )
    else {
      console.error(
        'Archive request failed',
        error instanceof Error ? error.name : 'Unknown error',
      )
      response = json({ error: 'Something went wrong. Please try again.' }, 500)
    }
  }
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Frame-Options', 'DENY')
  return response
}

// Enforce limits while streaming, including requests without Content-Length.
export async function readBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes)
    throw new HttpError(413, 'This upload is too large.')
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.length
      if (size > maxBytes) {
        await reader.cancel()
        throw new HttpError(413, 'This upload is too large.')
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

export async function readJson(
  request: Request,
  limit = 20000,
): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await readBody(request, limit)))
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Invalid request body.')
  }
}
