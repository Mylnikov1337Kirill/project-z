import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const DEFAULT_MIGRATIONS_DIRECTORY = resolve(
  projectRoot,
  'server/db/migrations',
)

const NO_TRANSACTION_PATTERN = /^--\s*db-migrate:\s*no-transaction\b/im
const APPLIED_STATUS = 'applied'

export function checksumSql(sql) {
  return createHash('sha256').update(sql).digest('hex')
}

export function parseMigrationFile(filename, sql) {
  return {
    checksum: checksumSql(sql),
    filename,
    sql,
    useTransaction: !NO_TRANSACTION_PATTERN.test(sql),
  }
}

export async function readMigrationFiles(
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
) {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true })
  const sqlFilenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  return Promise.all(
    sqlFilenames.map(async (filename) => {
      const sql = await readFile(resolve(migrationsDirectory, filename), 'utf8')

      return parseMigrationFile(filename, sql)
    }),
  )
}

export function planMigrationActions(migrations, schemaMigrationRows) {
  const migrationsByFilename = new Map(
    migrations.map((migration) => [migration.filename, migration]),
  )
  const rowsByFilename = new Map()

  for (const row of schemaMigrationRows) {
    if (rowsByFilename.has(row.filename)) {
      throw new Error(`Duplicate schema_migrations row for ${row.filename}.`)
    }

    if (row.status !== APPLIED_STATUS) {
      throw new Error(
        `Dirty schema_migrations state for ${row.filename}: status is ${row.status}.`,
      )
    }

    rowsByFilename.set(row.filename, row)
  }

  for (const row of schemaMigrationRows) {
    if (!migrationsByFilename.has(row.filename)) {
      throw new Error(
        `Applied migration ${row.filename} is missing from server/db/migrations.`,
      )
    }
  }

  return migrations.map((migration) => {
    const appliedRow = rowsByFilename.get(migration.filename)

    if (!appliedRow) {
      return { migration, type: 'apply' }
    }

    if (appliedRow.checksum !== migration.checksum) {
      throw new Error(
        `Applied migration ${migration.filename} checksum mismatch. Do not edit applied migrations.`,
      )
    }

    return { migration, type: 'skip' }
  })
}

async function ensureSchemaMigrationsTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      checksum text not null,
      status text not null default 'applied'
        check (status in ('running', 'applied', 'failed')),
      started_at timestamptz not null default now(),
      applied_at timestamptz,
      finished_at timestamptz,
      error text
    );
  `)
}

async function readSchemaMigrationRows(client) {
  const result = await client.query(`
    select filename, checksum, status
    from schema_migrations
    order by filename;
  `)

  return result.rows
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error)
}

async function rollback(client) {
  try {
    await client.query('rollback')
  } catch {
    // Keep the original migration failure as the primary error.
  }
}

async function applyTransactionalMigration(client, migration) {
  await client.query('begin')

  try {
    await client.query(migration.sql)
    await client.query(
      `
        insert into schema_migrations (
          filename,
          checksum,
          status,
          started_at,
          applied_at,
          finished_at
        )
        values ($1, $2, 'applied', now(), now(), now());
      `,
      [migration.filename, migration.checksum],
    )
    await client.query('commit')
  } catch (error) {
    await rollback(client)

    throw new Error(
      `Migration ${migration.filename} failed: ${formatError(error)}`,
      { cause: error },
    )
  }
}

async function applyNonTransactionalMigration(client, migration) {
  await client.query(
    `
      insert into schema_migrations (
        filename,
        checksum,
        status,
        started_at
      )
      values ($1, $2, 'running', now());
    `,
    [migration.filename, migration.checksum],
  )

  try {
    await client.query(migration.sql)
    await client.query(
      `
        update schema_migrations
        set status = 'applied',
          applied_at = now(),
          finished_at = now(),
          error = null
        where filename = $1;
      `,
      [migration.filename],
    )
  } catch (error) {
    await client
      .query(
        `
          update schema_migrations
          set status = 'failed',
            finished_at = now(),
            error = $2
          where filename = $1;
        `,
        [migration.filename, formatError(error)],
      )
      .catch(() => undefined)

    throw new Error(
      `Migration ${migration.filename} failed without transaction rollback: ${formatError(
        error,
      )}`,
      { cause: error },
    )
  }
}

async function applyMigration(client, migration) {
  if (migration.useTransaction) {
    await applyTransactionalMigration(client, migration)
    return
  }

  await applyNonTransactionalMigration(client, migration)
}

async function createPgClient(databaseUrl) {
  const pg = await import('pg')
  const { Client } = pg.default

  return new Client({
    connectionString: databaseUrl,
  })
}

export async function migrate({
  databaseUrl = process.env.DATABASE_URL,
  logger = console,
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
} = {}) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run Project Z DB migrations.')
  }

  const client = await createPgClient(databaseUrl)
  const summary = {
    applied: 0,
    skipped: 0,
    total: 0,
  }

  await client.connect()

  try {
    await ensureSchemaMigrationsTable(client)

    const migrations = await readMigrationFiles(migrationsDirectory)
    const schemaMigrationRows = await readSchemaMigrationRows(client)
    const actions = planMigrationActions(migrations, schemaMigrationRows)
    summary.total = actions.length

    for (const action of actions) {
      if (action.type === 'skip') {
        summary.skipped += 1
        logger.info(`Skipping already applied migration ${action.migration.filename}`)
        continue
      }

      logger.info(
        `Applying migration ${action.migration.filename}${
          action.migration.useTransaction ? '' : ' without transaction'
        }`,
      )
      await applyMigration(client, action.migration)
      summary.applied += 1
      logger.info(`Applied migration ${action.migration.filename}`)
    }

    if (summary.total === 0) {
      logger.info('No SQL migration files found.')
    } else if (summary.applied === 0) {
      logger.info('No pending database migrations.')
    }

    return summary
  } finally {
    await client.end()
  }
}

function isCliEntry(metaUrl) {
  const entryPath = process.argv[1]

  if (!entryPath) {
    return false
  }

  return metaUrl === pathToFileURL(resolve(entryPath)).href
}

if (isCliEntry(import.meta.url)) {
  migrate().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
