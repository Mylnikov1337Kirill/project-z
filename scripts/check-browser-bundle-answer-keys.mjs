import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const distAssetsDir = new URL('../dist/assets/', import.meta.url)
const forbiddenMarkers = [
  'acceptedFragmentIds',
  'correctOrder',
  'isCorrect',
  'passingScore',
]

async function listAssetFiles(directoryUrl) {
  let entries

  try {
    entries = await readdir(directoryUrl, { withFileTypes: true })
  } catch (error) {
    throw new Error(
      `Browser bundle assets not found at ${directoryUrl.pathname}. Run npm run build first.`,
      { cause: error },
    )
  }

  const files = []

  for (const entry of entries) {
    const entryUrl = new URL(entry.name, directoryUrl)

    if (entry.isDirectory()) {
      files.push(...(await listAssetFiles(new URL(`${entry.name}/`, directoryUrl))))
      continue
    }

    if (entry.isFile()) {
      files.push(entryUrl)
    }
  }

  return files
}

async function main() {
  const assets = await listAssetFiles(distAssetsDir)
  const findings = []

  for (const assetUrl of assets) {
    const assetStat = await stat(assetUrl)

    if (assetStat.size === 0) {
      continue
    }

    const content = await readFile(assetUrl, 'utf8')
    const matchedMarkers = forbiddenMarkers.filter((marker) =>
      content.includes(marker),
    )

    if (matchedMarkers.length > 0) {
      findings.push({
        file: join('dist/assets', assetUrl.pathname.split('/dist/assets/')[1]),
        markers: matchedMarkers,
      })
    }
  }

  if (findings.length > 0) {
    console.error('Browser bundle contains answer-key markers:')

    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.markers.join(', ')}`)
    }

    process.exitCode = 1
  }
}

await main()
