# GODAVARI ONE — CREDENTIAL ROTATION & PREPARATION REPORT

**Date & Time:** 2026-11-05T22:19:00+05:30  
**Project:** Godavari One  
**Repository:** `https://github.com/saimohit2008/GodavariOne`  
**Branch:** `main`  
**Vercel Account Status:** Authenticated (`saimohit2008` / Team: `MY PROJECTS`)  
**Deployment State:** PREPARATION ONLY (Vercel project not created, deployment held)  

---

## 1. Executive Rotation Checklist

| Credential | Operation | Status | Verification Plan |
|:---|:---|:---:|:---|
| **Supabase PostgreSQL Password** | Password Reset | **CONFIRMED COMPLETED** | Read-only Prisma queries across core tables (Users, Listings, Bookings) |
| **Supabase Secret Key** | Service Key Rotation | **PENDING OWNER ROTATION** | Non-destructive upload & cleanup of temporary test object in `godavari-uploads` |
| **Resend API Key** | Sending Key Replacement | **PENDING OWNER ROTATION** | Controlled test OTP delivery to authorized test account |
| **Previous Credentials Revocation** | Revoke Compromised Keys | **HELD UNTIL VERIFICATION** | Old keys remain active until replacements are fully verified |

---

## 2. Supabase Secret Key Analysis (`src/lib/storage.ts` & `src/lib/private-storage.ts`)

### Authentication Mechanism
Both `src/lib/storage.ts` and `src/lib/private-storage.ts` authenticate with Supabase using `@supabase/supabase-js`:

```ts
function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  if (!_supabaseClient) {
    _supabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabaseClient;
}
```

### Key Compatibility & Safety Rules
1. **SDK Compatibility**: `@supabase/supabase-js` accepts either the legacy JWT `service_role` key (`eyJhbGci...`) or the modern Supabase Secret Key (`sb_sec_...`). Both pass the key as `apikey` and `Authorization: Bearer <key>` to PostgREST and the Storage API (`/storage/v1/`).
2. **Standard Variable Name**: `SUPABASE_SECRET_KEY` is the top-priority variable name in source code.
3. **Storage Scopes**:
   - Public listing images bucket: `godavari-uploads` (via `src/lib/storage.ts`).
   - Private identity/priority pass documents: `godavari-private-documents` (via `src/lib/private-storage.ts`).
4. **Safety Constraint**: Do **not** rotate the JWT signing secret. Do **not** alter the client publishable/anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) unnecessarily. Do **not** expose `SUPABASE_SECRET_KEY` in `NEXT_PUBLIC_*` variables.
5. **Revocation Rule**: The old secret key must remain active until the replacement is tested against `godavari-uploads`.

---

## 3. PostgreSQL Password & Connection String Requirements

The PostgreSQL database password has already been changed in the Supabase Dashboard. 

### Prisma & Application Connection Requirements
In `prisma/schema.postgresql.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

In `src/lib/db.ts`:
The application connects via Prisma Client. In serverless cloud production (Vercel), connections must route through the Supabase Transaction Pooler to prevent connection exhaustion.

### Connection String Specifications
1. **`DATABASE_URL` (Transaction Pooler — Port 6543)**:
   - **Target**: Supabase PgBouncer Transaction Pooler.
   - **Required Port**: `6543`
   - **Required Query Parameters**: `?pgbouncer=true&connection_limit=10&connect_timeout=30&pool_timeout=30`
   - **Format Template**:
     `postgresql://postgres.[PROJECT_REF]:[NEW_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&connect_timeout=30&pool_timeout=30`
2. **`DIRECT_URL` (Direct Connection — Port 5432)**:
   - **Target**: Direct PostgreSQL Session Connection.
   - **Required Port**: `5432`
   - **Format Template**:
     `postgresql://postgres.[PROJECT_REF]:[NEW_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

### Database Safety Guarantees
- Zero destructive operations (`no migrate reset`, `no db push --accept-data-loss`, `no drop table`, `no truncate`).
- Connectivity verification will execute exclusively read-only queries (`user.count()`, `listing.count()`, `booking.count()`).

---

## 4. Resend API Key Analysis (`src/lib/resend.ts` & `src/lib/email-service.ts`)

### Environment Variable Usage
- **API Key**: `RESEND_API_KEY` (fallback: `EMAIL_API_KEY`).
- **Sender Address**: `RESEND_FROM_EMAIL` (fallback: `EMAIL_FROM`, default: `onboarding@resend.dev` or custom domain `noreply@godavari-one.in`).
- **Canonical App URL**: `APP_BASE_URL` (used for one-click verification links).

### Replacement Key Requirements
- **Permission**: Minimum required permissions is **Sending access** (Restricted Key).
- **Label**: `Godavari One Production`.
- **Revocation Rule**: The old key must not be revoked until the new key is validated with a test delivery.

---

## 5. Environment Variables Inventory for Next Phase

Once credentials are ready, the following variables will be configured in Vercel:

| Variable Name | Classification | Purpose |
|:---|:---:|:---|
| `DATABASE_URL` | Private / Secret | Supabase PostgreSQL Port 6543 (PgBouncer) |
| `DIRECT_URL` | Private / Secret | Supabase PostgreSQL Port 5432 (Direct) |
| `SUPABASE_URL` | Private | Supabase project API URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Client-side Supabase URL |
| `SUPABASE_SECRET_KEY` | Private / Secret | Rotated Supabase Secret / Service Role Key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Client-side Publishable Anon Key |
| `OBJECT_STORAGE_PROVIDER` | Private | Value: `"supabase"` |
| `SUPABASE_STORAGE_BUCKET` | Private | Value: `"godavari-uploads"` |
| `SUPABASE_PRIVATE_STORAGE_BUCKET` | Private | Value: `"godavari-private-documents"` |
| `SESSION_SECRET` | Private / Secret | 64-char cryptographic hex secret |
| `MFA_ENCRYPTION_KEY` | Private / Secret | 64-char hex AES-256 key |
| `RATE_LIMIT_SALT` | Private | Cryptographic salt for IP hashing |
| `CRON_SECRET` | Private / Secret | High-entropy bearer secret for `/api/v1/notifications/cron` |
| `RESEND_API_KEY` | Private / Secret | Rotated Resend Sending Key (`re_...`) |
| `RESEND_FROM_EMAIL` | Private | Sender address |
| `APP_BASE_URL` | Private | Canonical production URL |

---

## 6. Safe Verification Protocol

An automated verification harness (`scratch/test-rotated-credentials.mjs`) is in place to execute:

1. **Database Test**: Read-only count verification ensuring existing production records and schema relationships remain intact.
2. **Storage Test**: Single temporary object upload (`test-verify-[timestamp].txt`) to `godavari-uploads` followed by immediate cleanup of only that test object.
3. **Resend Test**: Delivery authorization probe confirming active sending state.

---

## 7. Remaining Owner Dashboard Actions

To complete the rotation phase:

1. **Supabase Secret Key**:
   - In Supabase Dashboard → **Project Settings** → **API**.
   - Under **Project API keys**, click **Roll secret key** for `service_role` (or generate a replacement key).
2. **Resend API Key**:
   - In Resend Dashboard (`https://resend.com/api-keys`), click **Create API Key** with **Sending access**.
3. **Hold Old Key Revocation**:
   - Keep old keys until we test and confirm the replacements.

