import { spawn } from 'node:child_process'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

const serverPath = fileURLToPath(new URL('../server/index.js', import.meta.url))
const vitePath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const apiPort = Number.parseInt(process.env.PORT ?? '8787', 10)
const healthUrl = `http://127.0.0.1:${apiPort}/health`

let serverProcess
let viteProcess
let shuttingDown = false

function spawnProcess(command, args, label) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return
    }

    if (signal) {
      console.log(`${label} exited with signal ${signal}`)
    } else {
      console.log(`${label} exited with code ${code}`)
    }

    if (label === 'server') {
      viteProcess?.kill('SIGTERM')
      process.exit(code ?? 1)
    }

    serverProcess?.kill('SIGTERM')
    process.exit(code ?? 1)
  })

  return child
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isHealthOk() {
  try {
    const response = await fetch(healthUrl)
    return response.ok
  } catch {
    return false
  }
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })

    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.on('error', (error) => {
      if (error && error.code === 'ECONNREFUSED') {
        resolve(false)
        return
      }

      resolve(true)
    })

    socket.setTimeout(1000, () => {
      socket.destroy()
      resolve(true)
    })
  })
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await isHealthOk()) {
      return
    }

    await delay(100)
  }

  throw new Error('Timed out waiting for the API server to start.')
}

if (!(await isHealthOk())) {
  if (await isPortInUse(apiPort)) {
    throw new Error(
      `Port ${apiPort} is already in use, but ${healthUrl} is not responding. ` +
        'Stop the process using that port, then run npm run dev again.',
    )
  }

  serverProcess = spawnProcess(process.execPath, [serverPath], 'server')
  await waitForHealth()
} else {
  console.log(`Reusing existing API server at ${healthUrl}`)
}

const shutdown = () => {
  shuttingDown = true
  serverProcess?.kill('SIGTERM')
  viteProcess?.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

viteProcess = spawnProcess(process.execPath, [vitePath], 'vite')

viteProcess.on('exit', (code) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  serverProcess?.kill('SIGTERM')
  process.exit(code ?? 1)
})