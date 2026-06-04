#!/usr/bin/env node
import { accessSync, constants } from 'node:fs'
import { delimiter, dirname } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const MINIMUM_NODE_VERSION = [20, 19, 0]
const DEFAULT_CODEX_NODE_BIN =
  '/Users/kirillmylnikov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'

function formatVersion(version) {
  return `v${version.join('.')}`
}

function parseVersion(value) {
  const match = value.match(/v?(\d+)\.(\d+)\.(\d+)/)

  if (!match) {
    return null
  }

  return match.slice(1).map(Number)
}

function isAtLeast(version, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (version[index] > minimum[index]) {
      return true
    }

    if (version[index] < minimum[index]) {
      return false
    }
  }

  return true
}

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function readNodeVersion(nodeBin) {
  const result = spawnSync(nodeBin, ['-v'], {
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    return null
  }

  return parseVersion(result.stdout.trim())
}

function fail(message) {
  console.error(`[project-z] ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)

if (args.length === 0) {
  fail(
    `Usage: node scripts/run-with-supported-node.mjs <command> [...args]. Requires Node ${formatVersion(
      MINIMUM_NODE_VERSION,
    )} or newer.`,
  )
}

const currentVersion = parseVersion(process.versions.node)

if (!currentVersion) {
  fail(`Could not read current Node version from ${process.version}.`)
}

const env = { ...process.env }

if (!isAtLeast(currentVersion, MINIMUM_NODE_VERSION)) {
  const fallbackNodeBin = env.PROJECT_Z_NODE_BIN || DEFAULT_CODEX_NODE_BIN

  if (!isExecutable(fallbackNodeBin)) {
    fail(
      `Current Node ${process.version} is below ${formatVersion(
        MINIMUM_NODE_VERSION,
      )}. Install/use a supported Node, or set PROJECT_Z_NODE_BIN to a Node binary. Codex fallback was not found at ${fallbackNodeBin}.`,
    )
  }

  const fallbackVersion = readNodeVersion(fallbackNodeBin)

  if (!fallbackVersion || !isAtLeast(fallbackVersion, MINIMUM_NODE_VERSION)) {
    fail(
      `Current Node ${process.version} is below ${formatVersion(
        MINIMUM_NODE_VERSION,
      )}, and fallback ${fallbackNodeBin} is not supported.`,
    )
  }

  env.PATH = `${dirname(fallbackNodeBin)}${delimiter}${env.PATH ?? ''}`
  env.PROJECT_Z_NODE_RUNTIME = fallbackNodeBin
  env.PROJECT_Z_NODE_RUNTIME_VERSION = formatVersion(fallbackVersion)

  console.warn(
    `[project-z] Current Node ${process.version} is below ${formatVersion(
      MINIMUM_NODE_VERSION,
    )}; running "${args.join(' ')}" with ${fallbackNodeBin} (${formatVersion(
      fallbackVersion,
    )}).`,
  )
}

const child = spawn(args[0], args.slice(1), {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

child.on('error', (error) => {
  fail(`Failed to run "${args.join(' ')}": ${error.message}`)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
