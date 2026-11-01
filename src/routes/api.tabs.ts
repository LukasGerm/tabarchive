import { createFileRoute } from '@tanstack/react-router'
import { requireOwner } from '../server/auth'
import { createTab, listTabs, maxFileSize } from '../server/storage'
import { HttpError, json, readBody, respond } from '../server/http'

export const Route = createFileRoute('/api/tabs')({
  server: {
    handlers: {
      GET: ({ request }) =>
        respond(async () => {
          requireOwner(request)
          return json(
            await listTabs(
              new URL(request.url).searchParams.get('view') === 'bin'
                ? 'bin'
                : 'active',
            ),
          )
        }),
      POST: ({ request }) =>
        respond(async () => {
          requireOwner(request)
          const bytes = await readBody(request, maxFileSize + 64000)
          let form: FormData
          try {
            form = await new Response(bytes, {
              headers: {
                'Content-Type': request.headers.get('content-type') ?? '',
              },
            }).formData()
          } catch {
            throw new HttpError(
              400,
              'Invalid upload. Please select the file again.',
            )
          }
          return json(await createTab(form), 201)
        }),
    },
  },
})
