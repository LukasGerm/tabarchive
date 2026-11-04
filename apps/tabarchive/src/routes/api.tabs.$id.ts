import { createFileRoute } from '@tanstack/react-router'
import { requireOwner } from '../server/auth'
import { trashTab, getTab, updateTab } from '../server/storage'
import { json, readJson, respond } from '../server/http'

export const Route = createFileRoute('/api/tabs/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        respond(async () => {
          requireOwner(request)
          return json(await getTab(params.id))
        }),
      PATCH: ({ request, params }) =>
        respond(async () => {
          requireOwner(request)
          return json(
            await updateTab(params.id, await readJson(request, 100000)),
          )
        }),
      DELETE: ({ request, params }) =>
        respond(async () => {
          requireOwner(request)
          return json(await trashTab(params.id))
        }),
    },
  },
})
