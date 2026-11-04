import { createFileRoute } from '@tanstack/react-router'
import { requireOwner } from '../server/auth'
import { getScoreDocument, saveScoreDocument } from '../server/storage'
import { json, readJson, respond } from '../server/http'

export const Route = createFileRoute('/api/tabs/$id/score')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        respond(async () => {
          requireOwner(request)
          return json(await getScoreDocument(params.id))
        }),
      PUT: ({ request, params }) =>
        respond(async () => {
          requireOwner(request)
          return json(
            await saveScoreDocument(
              params.id,
              await readJson(request, 3_100_000),
            ),
          )
        }),
    },
  },
})
