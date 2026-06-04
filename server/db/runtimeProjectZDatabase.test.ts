import { afterEach, describe, expect, it } from 'vitest'
import { BackendConfigurationError } from '../backend/configuration'
import { PostgresProjectZDatabase } from './postgresProjectZDatabase'
import { createRuntimeProjectZDatabaseFromEnv } from './runtimeProjectZDatabase'

const previousDatabaseUrl = process.env.DATABASE_URL
const previousSupabaseUrl = process.env.SUPABASE_URL
const previousSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

afterEach(() => {
  restoreEnvironmentVariable('DATABASE_URL', previousDatabaseUrl)
  restoreEnvironmentVariable('SUPABASE_URL', previousSupabaseUrl)
  restoreEnvironmentVariable(
    'SUPABASE_SERVICE_ROLE_KEY',
    previousSupabaseServiceRoleKey,
  )
})

describe('createRuntimeProjectZDatabaseFromEnv', () => {
  it('uses the own PostgreSQL factory instead of Supabase runtime env vars', async () => {
    delete process.env.DATABASE_URL
    process.env.SUPABASE_URL = 'https://project-z.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    expect(() => createRuntimeProjectZDatabaseFromEnv()).toThrow(
      BackendConfigurationError,
    )

    process.env.DATABASE_URL = 'postgres://project-z.test/postgres'
    const db = createRuntimeProjectZDatabaseFromEnv()

    expect(db).toBeInstanceOf(PostgresProjectZDatabase)
    await db.close()
  })
})
