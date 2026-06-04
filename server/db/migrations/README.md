# Project Z SQL migrations

Place own-PostgreSQL `.sql` migration files here. `npm run db:migrate`
applies them in lexical order and records successful files in
`schema_migrations`.

Each migration is wrapped in a transaction by default. For rare PostgreSQL
statements that cannot run in a transaction, add this marker near the top:

```sql
-- db-migrate: no-transaction
```
