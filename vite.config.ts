import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

function playerApiPlugin() {
  let handlerPromise

  return {
    name: 'player-api-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next) => {
        const requestUrl = request.url ?? ''

        if (!requestUrl.startsWith('/api/player/')) {
          next()
          return
        }

        handlerPromise ??= import(new URL('./api/player/[username].js', import.meta.url).href)

        try {
          const { default: handler } = await handlerPromise
          await handler(request, response)
        } catch (error) {
          server.config.logger.error(
            error instanceof Error ? error.stack ?? error.message : String(error),
          )

          if (!response.writableEnded) {
            response.statusCode = 500
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ error: 'Local API handler failed.' }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), playerApiPlugin()],
})
