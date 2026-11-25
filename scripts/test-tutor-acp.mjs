// Local end-to-end check with a real gateway, pinned adapter and synthetic book
// prompts. No provider credentials, shared service, container or egress is used.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

const checkout = process.env.AGENT_CONNECT_CHECKOUT
assert.ok(checkout, 'Set AGENT_CONNECT_CHECKOUT to the Agent Connect checkout.')
const upstream = resolve(checkout)
const binary = join(upstream, 'target/debug/agent-connect')
const upstreamFixtures = join(upstream, 'deploy/gateway/test/fixtures')
const project = resolve(import.meta.dirname, '..')
const { ownerTerminal } = await import(pathToFileURL(join(upstream, 'deploy/gateway/test/clean-room/owner-terminal.mjs')))
const root = await mkdtemp(join(tmpdir(), 'bookhand-acp-'))
const passphrase = randomBytes(24).toString('base64url')
const children = new Set()
const env = {
  PATH: `${root}/bin:${process.env.PATH}`,
  HOME: join(root, 'home'),
  XDG_CONFIG_HOME: join(root, 'config'),
  XDG_STATE_HOME: join(root, 'state'),
  XDG_CACHE_HOME: join(root, 'cache'),
  AGENT_CONNECT_CONTAINER_ENGINE: 'podman',
}

async function unusedPort() {
  const listener = createServer()
  await new Promise((ready, fail) => listener.once('error', fail).listen(0, '127.0.0.1', ready))
  const { port } = listener.address()
  await new Promise((closed) => listener.close(closed))
  return port
}

function start(bin, args, settings = {}) {
  const child = spawn(bin, args, { cwd: root, env, stdio: 'ignore', ...settings })
  children.add(child)
  const result = new Promise((done) => {
    child.once('error', () => done(1))
    child.once('exit', (code) => done(code ?? 1))
  }).finally(() => children.delete(child))
  return { child, result }
}

async function ready(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) break
    try { if ((await fetch(url)).ok) return } catch { /* still launching */ }
    await setTimeout(100)
  }
  throw new Error('Disposable Tutor fixture did not become ready.')
}

try {
  await Promise.all(['bin', 'home', 'config', 'state', 'cache', '.run/codex-home'].map((part) =>
    mkdir(join(root, part), { recursive: true, mode: 0o700 })))
  // Answer setup's rootless-engine metadata probe. Refuse every other command.
  await writeFile(join(root, 'bin/podman'), `#!/bin/sh
case "$1" in info) printf '%s\\n' '{"rootless":true}';; *) exit 91;; esac
`, { mode: 0o700 })
  if (process.env.BOOKHAND_TUTOR_FIXTURE_ADAPTERS) {
    await symlink(resolve(process.env.BOOKHAND_TUTOR_FIXTURE_ADAPTERS), join(root, 'adapters'))
  } else {
    await symlink(join(upstreamFixtures, 'adapters'), join(root, 'adapters'))
  }
  const gatewayPort = await unusedPort()
  const modelPort = await unusedPort()
  const appPort = await unusedPort()
  const origin = `http://localhost:${gatewayPort}`
  const provider = `http://127.0.0.1:${modelPort}`
  await writeFile(join(root, '.run/codex-home/config.toml'), `
model = "mock-model"
model_provider = "mock"
approval_policy = "never"
[model_providers.mock]
name = "Bookhand deterministic fixture"
base_url = "${provider}/v1"
wire_api = "responses"
requires_openai_auth = false
`, { mode: 0o600 })
  const mock = await readFile(join(upstreamFixtures, 'mock-model/server.mjs'), 'utf8')
  const insertion = '  // Claude Code may defer MCP tools'
  assert.ok(mock.includes(insertion), 'Agent Connect model fixture changed.')
  await writeFile(join(root, 'model.mjs'), mock.replace(insertion, `
  const reading = findTool(tools, "get_reading_context");
  if (!reading) return { text: "Fixture could not find the reading tool." };
  const latest = resultFor("get_reading_context");
  if (latest === undefined) return { call: { ...reading, args: {} } };
  return { text: latest.includes("Calculus Made Easy")
    ? "Fixture read Calculus Made Easy." : "Fixture did not receive the book title." };
${insertion}`))
  const { child: model } = start(process.execPath, [join(root, 'model.mjs')], {
    env: { ...env, MOCK_PORT: String(modelPort), MOCK_LOG: join(root, 'model.jsonl') },
  })
  await ready(`${provider}/v1/models`, model)

  const runtime = join(root, 'runtime')
  const setup = await ownerTerminal(binary, [
    'setup', '--apply', '--non-interactive', '--no-service', '--box-image', 'bookhand-fixture:unused',
    '--directory', runtime, '--harness', 'codex', '--origin', origin,
    '--listen', `127.0.0.1:${gatewayPort}`,
  ], passphrase, { cwd: root, env, timeout: 30_000 })
  assert.equal(setup.code, 0, 'Disposable gateway setup failed.')
  const path = join(runtime, 'config.json')
  const config = JSON.parse(await readFile(path, 'utf8'))
  Object.assign(config, {
    boxed: false, mock_root: root, harness_home: undefined,
    profiles: ['app-tools-only'], permissions: 'app-tools-only',
    codex_mode: 'read-only', mock_url: `${provider}/v1`,
  })
  await writeFile(path, JSON.stringify(config), { mode: 0o600 })
  const { child: gateway } = start(binary, ['serve', '--config', path])
  await ready(`http://127.0.0.1:${gatewayPort}/healthz`, gateway)

  const args = [
    'run', 'test:e2e:built', '--', 'tests/e2e/tutor-acp.spec.ts', '--project=chromium', '--workers=1',
  ]
  const tester = start('npm', args, {
    cwd: project,
    env: {
      ...process.env,
      BOOKHAND_E2E_PORT: String(appPort),
      BOOKHAND_TUTOR_FIXTURE_GATEWAY: origin,
      BOOKHAND_TUTOR_FIXTURE_PASSPHRASE: passphrase,
    },
    stdio: 'inherit',
  })
  assert.equal(await tester.result, 0, 'Bookhand ACP browser fixture failed.')
  const records = (await readFile(join(root, 'model.jsonl'), 'utf8')).trim().split('\n')
    .map((line) => JSON.parse(line))
  assert.equal(records.filter(({ decision }) => decision?.call?.name?.endsWith('get_reading_context')).length, 2,
    'Exactly one page tool request per explicit prompt; reload must not replay.')
  assert.equal(records.filter(({ decision }) => decision?.text === 'Fixture read Calculus Made Easy.').length, 2)
} finally {
  for (const child of children) child.kill('SIGTERM')
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    const exited = new Promise((done) => child.once('exit', done))
    const timer = globalThis.setTimeout(() => child.kill('SIGKILL'), 5000)
    await exited
    globalThis.clearTimeout(timer)
  }
  await rm(root, { recursive: true, force: true })
}
