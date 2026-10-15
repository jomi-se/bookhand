// Serves the generated-artifact frame (ADR 0013) under its own policy.
//
// The application's policy only runs Bookhand's own scripts, and every
// response from the dev and preview servers carries it. The artifact frame is
// the one document that must run inline agent-written scripts and load a short
// list of trusted CDNs, so its response gets its own policy instead of the
// application's. The frame is always embedded with `sandbox="allow-scripts"`
// and no `allow-same-origin`, so it runs in an opaque origin.

const TRUSTED_CDNS = 'https://cdnjs.cloudflare.com https://cdn.jsdelivr.net'

export const artifactFramePolicy = [
  "default-src 'none'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${TRUSTED_CDNS}`,
  `style-src 'self' 'unsafe-inline' ${TRUSTED_CDNS}`,
  `font-src 'self' data: ${TRUSTED_CDNS}`,
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'none'",
  "frame-src 'none'",
  "worker-src blob:",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join('; ')

function isFrameResource(url = '') {
  const path = url.split('?')[0]
  return path.endsWith('/artifact-frame.html') || path.includes('/artifact-kit/')
}

function frameHeaders(req, res, next) {
  if (!isFrameResource(req.url)) return next()
  const setHeader = res.setHeader.bind(res)
  // Later middleware applies the application's policy to every response;
  // drop that write so the frame keeps only its own.
  res.setHeader = (name, value) =>
    String(name).toLowerCase() === 'content-security-policy' ? res : setHeader(name, value)
  if (req.url.split('?')[0].endsWith('.html')) setHeader('Content-Security-Policy', artifactFramePolicy)
  // The frame's opaque origin makes its own stylesheet and script requests
  // cross-origin.
  setHeader('Access-Control-Allow-Origin', '*')
  setHeader('Cache-Control', 'no-cache')
  next()
}

export function artifactFrame() {
  return {
    name: 'bookhand-artifact-frame',
    configureServer(server) {
      server.middlewares.use(frameHeaders)
    },
    configurePreviewServer(server) {
      server.middlewares.use(frameHeaders)
    },
  }
}
