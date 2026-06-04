import { pathToFileURL } from 'node:url'
import { createProjectZNodeServer } from './nodeHttp'

const defaultPort = 3000
const defaultHost = '0.0.0.0'

function getPortFromEnv() {
  const rawPort = process.env.PORT

  if (!rawPort) {
    return defaultPort
  }

  const port = Number.parseInt(rawPort, 10)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }

  return port
}

function isMainModule() {
  const entry = process.argv[1]

  return entry ? import.meta.url === pathToFileURL(entry).href : false
}

export function startProjectZNodeServer() {
  const port = getPortFromEnv()
  const host = process.env.HOST ?? defaultHost
  const server = createProjectZNodeServer()

  server.listen(port, host, () => {
    console.info('Project Z Node API listening', {
      host,
      port,
    })
  })

  server.on('error', (error) => {
    console.error('Project Z Node API failed to start', {
      message: error.message,
    })
    process.exitCode = 1
  })

  return server
}

if (isMainModule()) {
  startProjectZNodeServer()
}
