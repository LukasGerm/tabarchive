import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated, login, logout } from '../server/auth'
import { json, readJson, respond } from '../server/http'

export const Route = createFileRoute('/api/session')({
  server: {
    handlers: {
      GET: ({ request }) =>
        respond(() => json({ authenticated: isAuthenticated(request) })),
      POST: ({ request }) =>
        respond(async () => {
          const body = (await readJson(request, 4096)) as {
            password?: unknown
          } | null
          return json({ authenticated: true }, 200, {
            'Set-Cookie': login(request, body?.password),
          })
        }),
      DELETE: ({ request }) =>
        respond(() =>
          json({ authenticated: false }, 200, {
            'Set-Cookie': logout(request),
          }),
        ),
    },
  },
})
