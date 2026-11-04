import { createFileRoute } from '@tanstack/react-router'
import { requireOwner } from '../server/auth'
import { getFile } from '../server/storage'
import { respond } from '../server/http'

export const Route = createFileRoute('/api/tabs/$id/file')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        respond(async () => {
          requireOwner(request)
          const { tab, bytes } = await getFile(params.id)
          return new Response(new Uint8Array(bytes), {
            headers: {
              'Content-Type':
                tab.format === 'pdf'
                  ? 'application/pdf'
                  : 'application/octet-stream',
              'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(tab.originalName ?? 'tab')}`,
              'Content-Security-Policy': "sandbox; default-src 'none'",
            },
          })
        }),
    },
  },
})
