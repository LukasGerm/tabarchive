import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requireOwner } from '../server/auth'
import { importSource } from '../server/import-source'
import { json, readJson, respond } from '../server/http'

export const Route = createFileRoute('/api/import')({
  server: {
    handlers: {
      POST: ({ request }) =>
        respond(async () => {
          requireOwner(request)
          const { url } = z
            .object({ url: z.string().max(2000) })
            .parse(await readJson(request, 4096))
          return json(await importSource(url))
        }),
    },
  },
})
