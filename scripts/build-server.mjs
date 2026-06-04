import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(projectRoot, 'dist-server')
const outputFile = resolve(outputDirectory, 'index.mjs')

await rm(outputDirectory, { force: true, recursive: true })

await build({
  bundle: true,
  entryPoints: [resolve(projectRoot, 'server/index.ts')],
  format: 'esm',
  logLevel: 'info',
  outfile: outputFile,
  platform: 'node',
  target: 'node20.19',
})

console.info(`Project Z server bundle written to ${outputFile}`)
