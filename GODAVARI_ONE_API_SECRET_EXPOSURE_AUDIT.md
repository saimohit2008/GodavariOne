# GODAVARI ONE — API KEY & SECRET EXPOSURE AUDIT REPORT

**Date & Time:** 2026-11-05T21:56:00+05:30  
**Target Repository:** `https://github.com/saimohit2008/GodavariOne`  
**Target Branch:** `main`  
**Latest Git Commit Audited:** `14bed42`  
**Auditor:** DevOps & Full-Stack Security Auditor  
**Audit Scope:** Full codebase scan, Git commit history, frontend client JavaScript bundles, mobile codebase, configuration, and local environment files.

---

## 1. Executive Summary

A comprehensive multi-surface credential exposure audit was performed on the Godavari One codebase. 

- **Git-Tracked Source Files**: `0` active private secrets detected in the current working tree.
- **Git Commit History**: `6` historical commits (`2eb1c8f` through `14bed42`) analyzed across all branches. `0` raw private database passwords, raw Supabase service keys, or raw Resend keys were committed to Git history.
- **Client-Side Bundles (`.next/static`)**: Verified zero private server secrets, database URLs, or API keys leaked into client browser bundles.
- **Previously Exposed / Compromised Credentials Identified for Rotation**:
  1. **Supabase Secret Key (`SUPABASE_SECRET_KEY`)**: Used for server-side public image and private document storage operations.
  2. **Supabase PostgreSQL Database Password**: Embedded in production pooler and direct connection strings.
  3. **Resend API Key (`RESEND_API_KEY`)**: Used for automated email notifications, OTP delivery, and booking updates.

---

## 2. Multi-Surface Audit Results & Classification

| Item # | Credential Category | Exposure Location / Scope | Severity | Status / Remediation Plan |
|:---:|:---|:---|:---:|:---|
| 1 | **Supabase Secret Key** (`SUPABASE_SECRET_KEY`) | Historical development session / Local `.env` | **CRITICAL** | Pending rotation via Supabase Project Settings API dashboard. Never expose in code. |
| 2 | **PostgreSQL Database Password** (`DATABASE_URL`, `DIRECT_URL`) | Historical development session / Local `.env` | **CRITICAL** | Pending database password reset via Supabase Project Settings Database dashboard. Update connection strings. |
| 3 | **Resend API Key** (`RESEND_API_KEY`) | Historical development session / Local `.env` | **CRITICAL** | Pending revocation and replacement with new sending key via Resend dashboard. Verified sending-only permissions. |
| 4 | **Client-Side Supabase Publishable Key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Frontend client configuration | **LOW** | Intentionally public publishable key. Protected by Supabase Row Level Security (RLS) policies. |
| 5 | **Cryptographic Secrets** (`SESSION_SECRET`, `MFA_ENCRYPTION_KEY`, `RATE_LIMIT_SALT`, `CRON_SECRET`) | Production Environment Variables | **HIGH** | Independent, high-entropy 64-character cryptographic keys must be generated specifically for production (no reuse of local keys). |

---

## 3. Git History Deep Scan Analysis

All commits in the repository history were inspected for leaked credentials:

- `14bed42` — `chore(deployment): adjust vercel cron schedule for hobby plan`
- `f3a585a` — `chore(deployment): configure vercel cron, postgresql safety gate and readiness report`
- `755502f` — `docs: record exact commit hash in security audit report`
- `cd23d39` — `Security audit, remediation and production deployment preparation`
- `df07989` — `fix: stabilize admin email notification statistics and regression tests`
- `2eb1c8f` — `feat: initial public release of Godavari One`

**Result**: 
- Tracked files in commit history: **CLEAN**.
- `.gitignore` strictly protects `.env`, `.env.*`, `*.db`, `*.sqlite`, `*.rdb`, `*.sql.bak`, and private document directories.

---

## 4. Frontend & Client-Side Bundle Inspection

The compiled Next.js production client bundle (`.next/static/**/*.js`) was scanned with automated pattern matchers:

- `DATABASE_URL` / `DIRECT_URL` / PostgreSQL passwords: **NOT PRESENT (SECURE)**
- `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: **NOT PRESENT (SECURE)**
- `RESEND_API_KEY`: **NOT PRESENT (SECURE)**
- `SESSION_SECRET` / `MFA_ENCRYPTION_KEY`: **NOT PRESENT (SECURE)**
- `CRON_SECRET`: **NOT PRESENT (SECURE)**
- `NEXT_PUBLIC_SUPABASE_URL`: Safely exposed for client-side queries.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Safely exposed for client-side queries.

---

## 5. Affected Applications & Services Inventory

The three compromised credentials are used by the following internal services and files:

### A. `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `src/lib/storage.ts`: Public uploads for listing images (`godavari-uploads` bucket).
- `src/lib/private-storage.ts`: Private document uploads for priority passes and verification (`godavari-private-documents` bucket).

### B. `DATABASE_URL` / `DIRECT_URL` (PostgreSQL Password)
- `src/lib/db.ts`: Primary Prisma Client connection pooler (Port 6543, PgBouncer).
- `prisma/schema.postgresql.prisma`: PostgreSQL datasource schema configuration.
- `scripts/database-audit.mjs`: Database structure auditing utility.
- `scripts/postgres-backup-verify.mjs`: Read-only snapshot verification utility.

### C. `RESEND_API_KEY`
- `src/lib/resend.ts`: Direct Resend client initialization.
- `src/lib/email-service.ts`: Transactional email outbox processor and booking reminder dispatcher.
- `src/lib/email.ts`: Email routing helper.
- `src/app/api/v1/auth/email/request/route.ts`: Email OTP request API.
- `src/app/api/v1/auth/register/verify-phone/route.ts`: Verification notification dispatcher.

---

## 6. Actionable Credential Rotation Plan

To eliminate risk from historical exposure, the three credentials must be rotated through provider dashboards:

### 1. Supabase Secret Key Rotation
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the Godavari One production project.
3. Navigate to **Project Settings** → **API**.
4. In the **Project API keys** section, locate the `service_role` (secret) key and click **Roll secret key** (or create a new secret key).
5. Copy the replacement key to be configured in Vercel Production Environment Variables as `SUPABASE_SECRET_KEY`.

### 2. Supabase PostgreSQL Database Password Reset
1. In the Supabase Dashboard, navigate to **Project Settings** → **Database**.
2. Scroll to **Database password** and click **Reset database password**.
3. Set a new high-entropy password.
4. Copy the updated Connection Strings:
   - **Transaction Pooler (Port 6543)** → `DATABASE_URL` (append `?pgbouncer=true&connection_limit=10&connect_timeout=30&pool_timeout=30`).
   - **Direct Connection (Port 5432)** → `DIRECT_URL`.
5. Note: Existing connections will require the updated password immediately upon reset.

### 3. Resend API Key Replacement
1. Log in to [Resend Dashboard](https://resend.com/api-keys).
2. Click **Create API Key**.
3. Choose **Permission: Sending access** (or Full access if managing domains).
4. Label: `Godavari One Production`.
5. Copy the replacement key (`re_...`).
6. Delete the previously exposed API key.

---

## 7. Audit Conclusion & Next Steps

The codebase is free of hardcoded secrets and protected against SQLite fallback in cloud environments. All automated quality checks pass (`npm run typecheck`, `npm test`, `npm run build`). 

Proceeding to Phase 2 & 10 requires the rotated credentials and authenticated Vercel deployment credentials.

