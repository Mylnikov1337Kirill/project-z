# Historical Supabase migrations

This directory is retained only as historical ADR-0006 / DBM-00 reference
material. The active Project Z runtime no longer uses Supabase REST/RPC, RLS,
service-role grants or these migration files.

The supported database path is the own PostgreSQL schema under
`server/db/migrations`, applied with `npm run db:migrate` through `DATABASE_URL`.
