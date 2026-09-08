# Deployment Guide

This guide covers deploying the Fan Retailer Survey app to production using Vercel and Supabase.

## Prerequisites

- A Supabase account ([supabase.com](https://supabase.com))
- A Vercel account ([vercel.com](https://vercel.com))
- The Git repository (push access)
- Local environment set up per [README.md](../README.md)
- Supabase CLI installed locally

## Step 1: Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New Project**.
3. Fill in:
   - **Name:** (e.g., `fan-retailer-survey-prod`)
   - **Database password:** (save this securely)
   - **Region:** (closest to your users, e.g., Singapore or Middle East)
4. Wait for the project to initialize.
5. On the project page, note:
   - **Project URL** (under Settings → General)
   - **Anon key** (under Settings → API)
   - **Service Role key** (under Settings → API)

Store these values securely; you will need them in the next steps.

> **Raise the API row limit.** In **Settings → API**, set **Max Rows** to at
> least `100000`. The default of `1000` will silently truncate the CSV/XLSX
> export, the overview charts, and the map, all of which rely on unpaged
> queries.

## Step 2: Apply database schema and migrations

1. Link the local repository to the production Supabase project:

```bash
npx supabase link --project-ref <PROJECT_REF>
```

Replace `<PROJECT_REF>` with your project reference (visible in the project URL: `https://app.supabase.com/project/<PROJECT_REF>`).

2. Push migrations to the production database:

```bash
npx supabase db push
```

This applies all migrations in `supabase/migrations/` in order:
- `0001_schema.sql` — tables and base schema
- `0002_rls.sql` — row-level security policies and `is_admin()` function
- `0003_storage.sql` — private storage bucket policies
- `0004_create_survey.sql` — the `create_survey()` RPC function
- `0005_survey_form_v2.sql` — "Other" brand support + quotation photos (see below)
- `0006_survey_edit.sql` — rep survey editing + edited_at column + update_survey RPC (see below)

> **⚠️ Important:** Do **not** run `supabase/seed.sql` in production. It contains test data and demo accounts. Seed data is for local development only.

### Step 2b — Survey Form v2 migration (0005)

If the app is already live and you are adding the "Other" brand feature + quotation photos, migration 0005 must be applied to the hosted database **before** deploying the app code. The migration is backward-compatible; existing rows remain unaffected.

1. In the Supabase dashboard, go to **SQL Editor** and open a new query.
2. Copy the entire contents of `supabase/migrations/0005_survey_form_v2.sql` and paste it into the editor.
3. Click **Run**. This will:
   - Add `'Other'` to all brand field `CHECK` constraints
   - Add 5 companion `*_other` columns for typed brand names (with pairing `CHECK` constraints)
   - Add `'quotation'` to the `survey_photos.kind` `CHECK` constraint
   - Replace the `create_survey()` RPC to handle the new fields and validate them

4. **Record the migration in the ledger.** A migration run from the SQL Editor does
   **not** write to `supabase_migrations.schema_migrations`, so a later
   `supabase db push` against this project would try to apply `0005` again and
   fail partway (the brand `CHECK` names are already swapped). Immediately after
   step 3, run this in the same SQL Editor:

   ```sql
   insert into supabase_migrations.schema_migrations (version, name)
   values ('0005', 'survey_form_v2')
   on conflict (version) do nothing;
   ```

   Alternatively, if you never intend to run `supabase db push` against this
   project again, you may skip this — but recording it is safer.

5. Once complete, proceed to deploy the app code (push to `master` on Vercel).

> **Note:** Existing rows are unaffected — the `*_other` columns default to `null`, and no quotation photos exist until a new survey is submitted with them. The replaced RPC is fully backward-compatible.

### Step 2c — Rep survey editing migration (0006)

If the app is already live with 0005, migration 0006 must be applied to the hosted database **before** deploying the rep editing feature. The migration is backward-compatible; existing rows remain unaffected.

Apply `0006` via the Supabase SQL Editor (as with `0005`), or via `supabase db push` only after the `0005` migration ledger row has been inserted (Step 2b) — otherwise `db push` re-runs `0005` then `0006`.

1. In the Supabase dashboard, go to **SQL Editor** and open a new query.
2. Copy the entire contents of `supabase/migrations/0006_survey_edit.sql` and paste it into the editor.
3. Click **Run**. This will add the `edited_at` column to `surveys`, create RLS policies for rep editing, and add/replace the `update_survey()` RPC function.
4. **Record the migration in the ledger.** Run this in the same SQL Editor:

   ```sql
   insert into supabase_migrations.schema_migrations (version, name)
   values ('0006', 'survey_edit')
   on conflict (version) do nothing;
   ```

5. Once complete, proceed to deploy the app code (push to `master` on Vercel).

## Step 3: Verify storage buckets

1. Go to the Supabase dashboard → **Storage**.
2. Confirm that two private buckets exist:
   - `survey-photos`
   - `survey-audio`

Both are created by `0003_storage.sql` and should already be present if Step 2 completed successfully. Verify their **Privacy** setting is **Private** (not public).

The `survey-audio` bucket has a `file_size_limit` of 25 MiB and an `allowed_mime_types` allowlist (set by migration `0006`) to enforce audio uploads. Verify these settings are configured if needed.

## Step 4: Configure Vercel environment variables

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard).
2. Click **Import** (or use an existing project if already connected).
3. Select your Git repository and click **Import**.
4. Under **Environment Variables**, add the following:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From Step 1 (Project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Step 1 (Anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | From Step 1 (Service Role key) |
| `REP_EMAIL_DOMAIN` | `survey.local` (or another non-routable domain) |

5. Click **Deploy**.

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` is a secret. Vercel will not expose it to the browser, only to the server. Treat it the same as a password.

## Step 5: Seed the admin account in production

1. Locally, update `.env.local` to point to the production Supabase project:

```env
NEXT_PUBLIC_SUPABASE_URL=<PROJECT_URL_FROM_STEP_1>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY_FROM_STEP_1>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY_FROM_STEP_1>
REP_EMAIL_DOMAIN=survey.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<CHOOSE_A_STRONG_PASSWORD>
```

2. Run the seed script once:

```bash
npm run seed:admin
```

This creates the initial admin account in the production database. The script uses `ADMIN_USERNAME` and `ADMIN_PASSWORD` to set up the account.

3. After success, you can remove `ADMIN_PASSWORD` from `.env.local` (keep the Supabase credentials for future admin operations if needed).

> **Note:** The seed script will only run if the account does not already exist. Running it multiple times is safe.

## Step 6: Deploy and sign in

1. Push your repository to the `master` branch:

```bash
git push origin master
```

Vercel automatically detects the push and deploys the app.

2. Once deployment is complete, visit your production URL (displayed on the Vercel dashboard).

3. Sign in with the admin account you created in Step 5:
   - **Username:** `admin`
   - **Password:** (the one you set in Step 5)

4. From the admin dashboard, navigate to **Users** to create sales rep accounts.
   - Each rep will receive a username and temporary password (admin-generated).
   - Reps log in with their username + password.

## Step 7: Verify the app is working

1. Ensure admin can see the dashboard (empty initially; no surveys yet).
2. Create a test rep account and log in.
3. Start and submit a test survey.
4. Verify the survey appears in the admin dashboard and on the map.
5. Test the export feature (CSV/XLSX).

## Important Notes

### Password reset workflow

Passwords are reset by the admin only. Because `REP_EMAIL_DOMAIN` is a non-routable domain (e.g., `survey.local`), no email is ever sent. The admin must manually generate a new password for reps who forget theirs via the **Users** tab in the admin dashboard.

### Signed-URL expiry

Export links (CSV/XLSX) are generated with a 6-hour expiration window (`SIGNED_URL_TTL` in the code). If your workflow requires longer-lived links, adjust this value in the export route handler and redeploy.

### Monitoring and debugging

- **Supabase logs:** Check the production database logs in the Supabase dashboard.
- **Vercel logs:** View deployment and runtime logs at `vercel.com/dashboard`.
- **Browser console:** Users can check browser console for any client-side errors.

## Rollback

If an issue occurs, Vercel allows you to:
1. Revert to a previous deployment (Vercel dashboard → **Deployments** → select previous version).
2. If database changes must be rolled back, you would need to restore from a Supabase backup or manually undo migrations (contact Supabase support for assistance).

---

For more information, see:
- [Supabase documentation](https://supabase.com/docs)
- [Vercel documentation](https://vercel.com/docs)
- [Next.js deployment guide](https://nextjs.org/docs/app/building-your-application/deploying)
- [README.md](../README.md) — local development setup
