# Database schema

Supabase is the only stateful dependency, so its schema is versioned like code.

## Layout

```
supabase/
  migrations/   # source of truth — one file per change, timestamp-prefixed
  schema.sql    # GENERATED bundle of every migration, for the SQL Editor
```

`schema.sql` is assembled by `scripts/build-schema.mjs` and verified in CI
(`pnpm run schema:check`). **Never edit it by hand** — the next build overwrites
it. It exists only because this project is deployed by pasting one file into
**Supabase Dashboard > SQL Editor**.

## Applying migrations

**Without the Supabase CLI (current setup)**

1. Open the project in the Supabase dashboard.
2. Go to **SQL Editor**.
3. Paste the whole of [`schema.sql`](./schema.sql) and run it.

Every statement is idempotent, so re-running the bundle is safe.

**With the Supabase CLI (optional)**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Adding a migration

1. Create `supabase/migrations/<YYYYMMDDHHmmss>_<snake_case_description>.sql`.
   The timestamp must sort after the previous migration — that ordering is the
   whole mechanism, so never reuse or reorder one.
2. Write idempotent SQL (`create table if not exists`, `drop policy if exists`,
   …). A migration that fails halfway leaves the project in a state no one can
   reproduce.
3. Regenerate the bundle:

   ```bash
   pnpm run schema:build
   ```

4. Commit the migration **and** the regenerated `schema.sql` together.

## Current migrations

| Migration | Change |
| --- | --- |
| `20260524000000_baseline_workouts.sql` | Baseline `workouts` table, reconstructed from the app code |
| `20260818131159_workouts_user_scoping.sql` | Per-user ownership: `user_id`, RLS policies, orphan-row claiming |

## A note on the baseline

The `workouts` table was created by hand in the dashboard before migrations
existed, so the baseline is a reconstruction from the columns the app reads and
writes rather than a verbatim dump. It is a no-op on the live project; its value
is that a fresh project now converges on the same shape.
