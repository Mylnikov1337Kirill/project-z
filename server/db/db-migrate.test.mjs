import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checksumSql,
  planMigrationActions,
  readMigrationFiles,
} from '../../scripts/db-migrate.mjs'

describe('Agent Trail database migration runner', () => {
  it('keeps the own PostgreSQL schema migration scoped to domain schema objects', async () => {
    const sql = await readFile(
      new URL('./migrations/202606020001_project_z_schema.sql', import.meta.url),
      'utf8',
    )
    const domainTables = [
      'pilot_sessions',
      'learners',
      'learner_chapter_progress',
      'mission_attempts',
      'completed_missions',
      'badge_awards',
      'trap_discoveries',
      'chapter_reflections',
      'announcement_deliveries',
      'mission_starts',
      'suspicious_events',
    ]

    const telemetrySql = await readFile(
      new URL(
        './migrations/202606020002_ai_autopass_suspicious_signals.sql',
        import.meta.url,
      ),
      'utf8',
    )
    const leaderboardBadgeSql = await readFile(
      new URL(
        './migrations/202606020003_leaderboard_last_badge_name.sql',
        import.meta.url,
      ),
      'utf8',
    )
    const combinedSql = `${sql}\n${telemetrySql}\n${leaderboardBadgeSql}`

    for (const table of domainTables) {
      expect(combinedSql).toMatch(
        new RegExp(`create table if not exists public\\.${table}\\b`, 'i'),
      )
    }

    expect(sql).toMatch(/create extension if not exists pgcrypto/i)
    expect(sql).toMatch(
      /create or replace function public\.project_z_touch_updated_at/i,
    )
    expect(sql).toMatch(/create trigger learners_touch_updated_at/i)
    expect(sql).toMatch(/create or replace view public\.leaderboard_entries/i)
    expect(telemetrySql).toMatch(/create or replace view public\.leaderboard_entries/i)
    expect(telemetrySql).toMatch(/from public\.suspicious_events/i)
    expect(telemetrySql).toMatch(/where suspicious_events\.learner_id = learners\.id/i)
    expect(leaderboardBadgeSql).toMatch(
      /create or replace view public\.leaderboard_entries/i,
    )
    expect(leaderboardBadgeSql).toMatch(/last_badge_name/i)
    expect(leaderboardBadgeSql).toMatch(/badge_name_snapshot/i)
    expect(sql).not.toMatch(/enable row level security/i)
    expect(sql).not.toMatch(/request\.jwt\.claims/i)
    expect(sql).not.toMatch(/\bservice_role\b/i)
    expect(sql).not.toMatch(/\bauthenticated\b/i)
    expect(sql).not.toMatch(/project_z_progress_payload/i)
    expect(sql).not.toMatch(/project_z_create_pilot_session/i)
  })

  it('reads SQL migrations in lexical order with checksums and transaction flags', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'project-z-db-migrations-'))

    try {
      await writeFile(join(directory, '002_second.sql'), 'select 2;')
      await writeFile(
        join(directory, '001_first.sql'),
        '-- db-migrate: no-transaction\nselect 1;',
      )
      await writeFile(join(directory, 'README.md'), 'ignored')

      const migrations = await readMigrationFiles(directory)

      expect(migrations.map((migration) => migration.filename)).toEqual([
        '001_first.sql',
        '002_second.sql',
      ])
      expect(migrations[0].checksum).toBe(
        checksumSql('-- db-migrate: no-transaction\nselect 1;'),
      )
      expect(migrations[0].useTransaction).toBe(false)
      expect(migrations[1].useTransaction).toBe(true)
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('plans idempotent skips for applied migrations and applies only new files', () => {
    const firstMigration = {
      checksum: checksumSql('select 1;'),
      filename: '001_first.sql',
      sql: 'select 1;',
      useTransaction: true,
    }
    const secondMigration = {
      checksum: checksumSql('select 2;'),
      filename: '002_second.sql',
      sql: 'select 2;',
      useTransaction: true,
    }

    expect(
      planMigrationActions([firstMigration, secondMigration], [
        {
          checksum: firstMigration.checksum,
          filename: firstMigration.filename,
          status: 'applied',
        },
      ]),
    ).toEqual([
      { migration: firstMigration, type: 'skip' },
      { migration: secondMigration, type: 'apply' },
    ])
  })

  it('fails loudly on dirty, changed or missing applied migrations', () => {
    const migration = {
      checksum: checksumSql('select 1;'),
      filename: '001_first.sql',
      sql: 'select 1;',
      useTransaction: true,
    }

    expect(() =>
      planMigrationActions([migration], [
        {
          checksum: migration.checksum,
          filename: migration.filename,
          status: 'failed',
        },
      ]),
    ).toThrow(/Dirty schema_migrations state/)

    expect(() =>
      planMigrationActions([migration], [
        {
          checksum: checksumSql('select changed;'),
          filename: migration.filename,
          status: 'applied',
        },
      ]),
    ).toThrow(/checksum mismatch/)

    expect(() =>
      planMigrationActions([], [
        {
          checksum: migration.checksum,
          filename: migration.filename,
          status: 'applied',
        },
      ]),
    ).toThrow(/missing from server\/db\/migrations/)
  })
})
