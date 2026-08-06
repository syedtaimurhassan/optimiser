import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

/**
 * Deliberately header-less static server.
 *
 * GitHub Pages sends no COOP/COEP headers and offers no way to add them. That
 * single fact is the reason coi-serviceworker exists in this project, so the
 * benchmark host must reproduce it exactly: if this server ever sets those
 * headers, the benchmark stops measuring the thing we deploy.
 *
 * The ONLY headers sent are Content-Type, Content-Length and no-cache.
 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

/**
 * @param {object} opts
 * @param {string} opts.root      directory to serve
 * @param {string} opts.basePath  URL prefix, mirroring Vite's `base` ('/optimiser/')
 * @param {(url: string) => boolean} [opts.block]  return true to 404 a request
 */
export async function startServer({ root, basePath = '/optimiser/', block }) {
  const blocked = []

  const server = createServer(async (req, res) => {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)

    if (block?.(urlPath)) {
      blocked.push(urlPath)
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('blocked by benchmark harness')
      return
    }

    if (urlPath.startsWith(basePath)) urlPath = urlPath.slice(basePath.length - 1)
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html'

    // Contain path traversal: resolve, then require the result to stay under root.
    const filePath = join(root, normalize(urlPath).replace(/^(\.\.[/\\])+/, ''))
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('forbidden')
      return
    }

    try {
      const info = await stat(filePath)
      if (!info.isFile()) throw new Error('not a file')
      const body = await readFile(filePath)
      res.writeHead(200, {
        'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
      })
      res.end(body)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('not found')
    }
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()

  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    url: `http://127.0.0.1:${port}${basePath}`,
    blocked,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
