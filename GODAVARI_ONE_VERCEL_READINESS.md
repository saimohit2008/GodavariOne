# GODAVARI ONE — VERCEL PRODUCTION DEPLOYMENT READINESS REPORT

**Application:** Godavari One (పుష్కరాలు 2027 Digital Platform)  
**Target Hosting:** Vercel (Edge & Serverless Node.js Runtime)  
**Database Runtime:** Supabase Managed PostgreSQL (Transaction Pooler Port 6543)  
**Storage Provider:** Supabase Object Storage (Cloud Buckets)  
**Deployment State:** PRE-DEPLOYMENT VERIFICATION COMPLETE (AWAITING USER REVIEW)  
**Date & Timestamp:** 2026-11-05T21:05:00+05:30  
**Git Repository:** `https://github.com/saimohit2008/GodavariOne.git`  
**Git Branch:** `main`  
**Latest Verified Commit:** `755502f` (All tests green, 0 compiler errors)  

---

## 1. Executive Deployment Readiness Summary

A full technical readiness audit has been conducted across the Godavari One production codebase. The application has passed all pre-deployment quality gates:

- **TypeScript Compilation**: 0 errors (`npm run typecheck` passed cleanly).
- **Automated Regression Suite**: 275 tests passed, 0 failed across 59 suites (`npm test`).
- **Production Build Engine**: 66 routes compiled and optimized in 2.1s (`next build`).
- **Mobile Client Parity**: Native Expo / Hermes bytecode bundle validated (`mobile`).
- **Database Safety Guard**: Added a fail-safe constraint in `src/lib/db.ts` that immediately terminates with an explicit fatal error if any cloud/Vercel instance attempts to fall back to SQLite.
- **Background Cron Automation**: Created `vercel.json` with standard cron scheduling for the automated email outbox processor.

---

## 2. Vercel Project Root & Repository Structure

- **GitHub Repository**: `https://github.com/saimohit2008/GodavariOne.git`
- **Root Directory in Vercel Project Settings**: `./` (Default repository root).
  - *Verification*: `package.json`, `next.config.ts`, `prisma/`, `vercel.json`, and `src/` reside directly at the repository root. Do **NOT** set a custom subdirectory (e.g., do not set `GODAVARI NADHI MAIN PROJECT`).
- **Framework Preset**: `Next.js` (Vercel automatically detects Next.js 16/15).
- **Node.js Version**: `20.x` or `22.x` (LTS recommended).

---

## 3. Production Environment Variables (Public vs Private Classification)

To ensure a secure, zero-leak deployment, all environment variables required by Godavari One are cataloged and classified below. 

> [!IMPORTANT]
> Variables prefixed with `NEXT_PUBLIC_` are embedded into client-side JavaScript bundles and visible to the public. All server credentials and database passwords must **NEVER** use the `NEXT_PUBLIC_` prefix.

### A. Database Configuration (Private — Server Only)

| Variable Name | Scope | Sensitivity | Description & Configuration Instruction |
|:---|:---:|:---:|:---|
| `DATABASE_URL` | Private | **CRITICAL** | Production Supabase PostgreSQL transaction pooler URI on **Port 6543**.<br>Must include query parameters: `?pgbouncer=true&connection_limit=10`.<br>*Example*: `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10` |
| `DIRECT_URL` | Private | **CRITICAL** | Direct session connection to PostgreSQL on **Port 5432** (used for schema synchronization).<br>*Example*: `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres` |

### B. Supabase Cloud & Storage Configuration

| Variable Name | Scope | Sensitivity | Description & Configuration Instruction |
|:---|:---:|:---:|:---|
| `SUPABASE_URL` | Private | High | Root API URL of your production Supabase project (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_URL` | **Public** | Low | Public URL for client-side asset access (`https://<project-ref>.supabase.co`). |
| `SUPABASE_SECRET_KEY` | Private | **CRITICAL** | Modern Supabase Secret Key (`sb_sec_...`) or legacy Service Role Key (`eyJ...`). Used exclusively by the server to upload public images and private documents. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Public** | Low | Browser client publishable/anon key (`sb_pub_...` or legacy `eyJ...`). |
| `OBJECT_STORAGE_PROVIDER` | Private | Medium | Set explicitly to `"supabase"` in production. |
| `SUPABASE_STORAGE_BUCKET` | Private | Low | Public image bucket name. Defaults to `"godavari-uploads"`. |
| `SUPABASE_PRIVATE_STORAGE_BUCKET` | Private | Low | Secure private document bucket. Defaults to `"godavari-private-documents"`. |

### C. Authentication, Security & MFA

| Variable Name | Scope | Sensitivity | Description & Configuration Instruction |
|:---|:---:|:---:|:---|
| `SESSION_SECRET` | Private | **CRITICAL** | Minimum 32-character high-entropy cryptographic hex secret for session token entropy. |
| `MFA_ENCRYPTION_KEY` | Private | **CRITICAL** | Exactly 64 hex characters (32 bytes) used for AES-256-GCM encryption of admin TOTP secrets at rest. |
| `RATE_LIMIT_SALT` | Private | High | Cryptographic salt used to pseudonymize IP addresses in persistent rate-limit tables. |
| `CRON_SECRET` | Private | **CRITICAL** | High-entropy random bearer secret used by Vercel Cron to invoke `/api/v1/notifications/cron`. |

### D. Email Notification & Resend Service

| Variable Name | Scope | Sensitivity | Description & Configuration Instruction |
|:---|:---:|:---:|:---|
| `RESEND_API_KEY` | Private | **CRITICAL** | Resend API key (`re_...`). |
| `RESEND_FROM_EMAIL` | Private | Medium | Production verified sender email (e.g., `Godavari One <noreply@godavari-one.in>`). |
| `APP_BASE_URL` | Private | Medium | Production canonical domain (e.g., `https://godavari-one.vercel.app` or custom domain `https://godavari-one.in`). Used for one-click email verification links. |

### E. AI Assistant & Cost Guard

| Variable Name | Scope | Sensitivity | Description & Configuration Instruction |
|:---|:---:|:---:|:---|
| `AI_SERVICE_ENABLED` | Private | Low | `"true"` or `"false"` (controls master AI assistant). |
| `AI_PROVIDER` | Private | Low | `"gemini"`, `"groq"`, or `"openai"`. Defaults to `"gemini"`. |
| `AI_API_KEY` / `GEMINI_API_KEY` | Private | High | API key for Gemini / LLM interactions. |
| `AI_MODEL` | Private | Low | Default model name (`gemini-1.5-flash`). |
| `AI_MONTHLY_BUDGET_USD` | Private | Low | Monthly hard cap ceiling in USD (e.g., `"25.0"`). |

---

## 4. PostgreSQL Production Database Verification & SQLite Isolation

1. **Active Database Selection Logic (`src/lib/db.ts`)**:
   - Inspects `process.env.DATABASE_URL`.
   - When the URL begins with `postgres://` or `postgresql://`, the application instantiates `@prisma/client-pg` (PostgreSQL client) and applies automated Supabase transaction pooler optimizations.
2. **Anti-Fallback Production Safety Gate**:
   - `src/lib/db.ts` contains an explicit cloud environment guard:
     ```ts
     const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production";
     if (isVercel && (!envUrl || envUrl.startsWith("file:"))) {
       throw new Error(
         "FATAL: Vercel cloud deployment requires a valid PostgreSQL DATABASE_URL. SQLite fallback is strictly prohibited in cloud production."
       );
     }
     ```
   - If `DATABASE_URL` is missing or mistakenly set to a SQLite file in Vercel, the application halts immediately with this fatal error, preventing any silent fallback or ephemeral SQLite file creation.
3. **Database Migration Strategy**:
   - The production PostgreSQL schema has been synchronized using Prisma (`prisma/schema.postgresql.prisma`).
   - Do **NOT** execute destructive commands (`prisma migrate reset` or `prisma db push --force-reset`) against the production database.

---

## 5. Supabase Storage & Filesystem Safety Verification

1. **Storage Factory Protection (`src/lib/storage.ts` & `src/lib/private-storage.ts`)**:
   - In production (`VERCEL === "1"` or `NODE_ENV === "production"`), `isSupabaseStorageActive()` and `isPrivateSupabaseActive()` strictly enforce Supabase Storage.
   - Any attempt to use `localStorage` in production immediately throws:
     `"Local filesystem storage is disabled in production. Supabase Storage is required."`
2. **Reverse Proxy Rewrites (`next.config.ts`)**:
   - Static upload paths (`/uploads/:path*`) are transparently proxied to `${supabaseUrl}/storage/v1/object/public/${bucketName}/:path*` when `OBJECT_STORAGE_PROVIDER="supabase"`.
3. **Required Supabase Bucket Pre-requisites**:
   - Public Bucket: `godavari-uploads` (Public access enabled).
   - Private Bucket: `godavari-private-documents` (Private; signed URLs / authenticated server reads only).

---

## 6. Resend API Key Status Investigation (Task 8 Resolution)

During audit verification of the configured Resend credentials:
- **Observed Behavior**: Probing Resend administrative endpoints (`GET https://api.resend.com/api-keys` or `GET /domains`) returned HTTP `401 Unauthorized` with error payload:
  `{"statusCode":401,"message":"This API key is restricted to only send emails","name":"restricted_api_key"}`.
- **Diagnostic Finding**: The API key is **VALID** and active, but has been deliberately created as a **Restricted API Key (Sending Access Only)** in the Resend dashboard.
- **Verification Probe**: Probing the transactional dispatch endpoint (`POST https://api.resend.com/emails`) authenticated successfully with HTTP `422 Unprocessable Entity` (`Missing 'to' field`), confirming that the key is fully authorized to send emails.
- **Production Recommendation**:
  - The current key functions properly for sending OTP emails and booking notifications.
  - To send emails from a branded domain (e.g., `noreply@godavari-one.in`), verify that the domain has completed DNS records (DKIM, SPF, MX) inside the Resend console. For preliminary staging/preview deployments, `onboarding@resend.dev` can be used.

---

## 7. Prisma Client Generation & Vercel Build Pipeline

1. **Dual-Client Architecture**:
   - `prisma/schema.prisma` generates SQLite client to `node_modules/@prisma/client`.
   - `prisma/schema.postgresql.prisma` generates PostgreSQL client to `node_modules/@prisma/client-pg`.
2. **Automatic Postinstall Generation**:
   - In `package.json`:
     `"postinstall": "prisma generate --schema=prisma/schema.prisma && prisma generate --schema=prisma/schema.postgresql.prisma"`
   - During Vercel's build process, `npm install` triggers `postinstall`, ensuring `@prisma/client-pg` is generated before `next build` executes.
3. **Tracing Inclusion**:
   - In `next.config.ts`, `outputFileTracingIncludes` explicitly traces `@prisma/client-pg` into serverless API function bundles.

---

## 8. Next.js Output & Vercel Build Settings

### Build & Output Settings in Vercel Dashboard:
- **Build Command**: Leave default (`next build` / `npm run build`).
- **Output Directory**: Automatically handled by Vercel (`.next`). Do **not** override.
- **Install Command**: Leave default (`npm install`).
- **Standalone Compatibility**: `output: "standalone"` is configured in `next.config.ts`. Vercel natively packages standalone Next.js applications into optimal serverless lambda artifacts.

---

## 9. Background Workers & Cron Jobs (`vercel.json`)

1. **Cron Endpoint**: `/api/v1/notifications/cron` handles:
   - Automated processing of pending and queued emails.
   - Dispatching 24-hour and 2-hour pre-booking reminder alerts.
   - Retrying transient email failures.
2. **Vercel Cron Configuration File**:
   A `vercel.json` file has been prepared at the project root:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "crons": [
       {
         "path": "/api/v1/notifications/cron",
         "schedule": "*/5 * * * *"
       }
     ]
   }
   ```
3. **Authentication**:
   - Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to cron requests when `CRON_SECRET` is defined in Vercel Environment Variables.

---

## 10. Authentication Cookies, CORS & Allowed Origins

1. **Session Cookies (`src/lib/auth.ts`)**:
   - `httpOnly: true` (Shields tokens from XSS theft).
   - `secure: true` in production and on Vercel (`isProd = NODE_ENV === 'production' || VERCEL === '1'`).
   - `sameSite: "lax"` (Prevents CSRF on cross-site navigations).
   - `path: "/"` (Consistent across all routes).
2. **HTTP Defense Headers (`next.config.ts`)**:
   - `X-Frame-Options: SAMEORIGIN`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
3. **API CORS & Mobile Headers**:
   - `Access-Control-Allow-Credentials: true`
   - Allowed Headers: `Authorization, X-Client-Platform, X-Godavari-Client, Content-Type, Accept`
   - Fully supports native Android/iOS app requests alongside web clients.

---

## 11. Pre-Deployment Verification Checklist

| Step # | Verification Item | Target Setting | Status |
|:---:|:---|:---|:---:|
| 1 | Git Repository & Branch | `https://github.com/saimohit2008/GodavariOne.git` (`main`) | **READY** |
| 2 | Vercel Project Root | `./` (Repository Root) | **READY** |
| 3 | Framework Detection | `Next.js` | **READY** |
| 4 | Prisma Dual Client Postinstall | `package.json` `"postinstall"` | **READY** |
| 5 | PostgreSQL Database Configuration | `DATABASE_URL` (Port 6543) & `DIRECT_URL` (Port 5432) | **READY** |
| 6 | SQLite Cloud Anti-Fallback Guard | `src/lib/db.ts` throws fatal error if SQLite on Vercel | **READY** |
| 7 | Cloud Storage Configuration | `OBJECT_STORAGE_PROVIDER="supabase"` | **READY** |
| 8 | Resend API Key Validation | Validated sending-only key (`422` on empty probe) | **READY** |
| 9 | Cron Schedule | `vercel.json` configured for 5-minute interval | **READY** |
| 10 | Security Headers & CORS | Configured in `next.config.ts` | **READY** |
| 11 | Full Test Suite Pass Rate | 275 of 275 tests passed (`npm test`) | **READY** |
| 12 | TypeScript Compilation | 0 errors (`npm run typecheck`) | **READY** |

---

## 12. Deployment Instructions (Step-by-Step for Vercel Dashboard)

When you are ready to initiate the deployment:

1. **Connect GitHub Project**:
   - Open Vercel Dashboard -> **Add New Project**.
   - Select `saimohit2008/GodavariOne` repository.
2. **Configure Project Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./` (do not change)
   - **Build & Output Settings**: Leave on default (Next.js automatically detected).
3. **Add Environment Variables**:
   - Copy the required variables from **Section 3** into Vercel's **Environment Variables** tab for the **Production** (and Preview if needed) environment.
4. **Click Deploy**:
   - Vercel will clone the repository, run `npm install` (generating both Prisma clients via `postinstall`), execute `next build`, configure the cron job from `vercel.json`, and deploy the application to your production URL.

