# Godavari One

**Digital Companion & Service Directory for Godavari Pushkaralu 2027 and the Greater Godavari Region.**

Godavari One is a comprehensive, full-stack digital platform designed to provide pilgrims, tourists, residents, and local administrators with reliable information, crowd monitoring, essential directory listings, and convenience services across Rajahmundry and surrounding sacred ghat locations during Godavari Pushkaralu 2027 and beyond.

---

## 1. Project Introduction

Godavari Pushkaralu is a major 12-day river festival occurring once every 12 years along the Godavari River, drawing tens of millions of pilgrims to Rajahmundry, Kovvur, and neighboring towns. Navigating ghats, accommodations, transport, and emergency services during this immense influx presents significant logistical and informational challenges.

Godavari One addresses this by delivering a unified, mobile-responsive web platform and companion mobile application offering real-time directory access, digital passes, crowd indicators, and essential civic assistance in both English and Telugu.

---

## 2. Problem Statement

During high-density religious congregations:
- Pilgrims encounter severe informational fragmentation regarding ghat crowd density, sacred bathing rituals, and safe entry points.
- Local verified accommodation, medical centers, emergency response hubs, and community kitchens (*Annadanam*) are difficult to locate rapidly.
- Local businesses, licensed purohits, and transit providers struggle to coordinate effectively with visitors.
- Connectivity constraints require lightweight web pages and offline-tolerant mobile capabilities.

---

## 3. Project Objectives

- **Centralize Verification:** Provide a verified, multilingual directory of pushkar ghats, hotels, restaurants, hospitals, free accommodation centers, transport providers, and tourist landmarks.
- **Support Crowd Safety:** Enable crowd reporting, emergency hotline access, and digital priority pass verification for high-density ghat locations.
- **Facilitate Pilgrim Convenience:** Deliver transparent purohit bookings, certified ceremony arrangements, NRI pilgrimage packages, and user reviews.
- **Maintain High Accessibility:** Ensure responsive access across devices (320px mobile viewports through 1440px desktop screens) with dual English/Telugu localization.

---

## 4. Main Features

- **Comprehensive Regional Directory:** Search, filter, and view detailed listings across 9 core categories:
  - Pushkar Ghats (crowd levels, facilities, safety guidelines)
  - Restaurants & Dining (vegetarian/vegan tags, hygiene, Pushkar specials)
  - Hotels & Lodging (rooms, amenities, proximity to ghats)
  - Hospitals & Medical Centers (24/7 emergency, trauma care, ambulance contacts)
  - Transport & Transit (auto stands, bus points, private vehicle rentals)
  - Tourist & Heritage Attractions (historical temples, cultural sites)
  - Free Accommodation Camps (pilgrim shelters, facilities, check-in)
  - Annadanam Centers (free meal distributions, timings, locations)
  - Purohit Directory (verified priests, rituals, Vedic ceremonies)
- **Interactive Crowd Monitoring:** Live crowd status badges (Low, Moderate, High, Peak) with user reports and administrator validation.
- **Digital Priority Pass:** Server-authoritative QR code issuance and gatekeeper validation for controlled ghat access.
- **Bilingual Localization:** Complete English and Telugu language toggle across all public pages and mobile screens.
- **Secure Authentication:** Resend email OTP verification, session cookies for web browsers, and secure token management for mobile devices.
- **Role-Based Access Control:** Seven distinct administrative and operational roles (Master Admin, Content Editor, Category Manager, Business Owner, Purohit, Ghat Operator, Pilgrim).

*Note: Features described represent implemented capabilities within the codebase; operational availability depends on active service deployment.*

---

## 5. Website and Backend Architecture

The Godavari One web platform is built on **Next.js (App Router)** in a unified full-stack architecture:

- **Frontend Presentation:** Server-side rendered (SSR) and client-interactive React components using Tailwind CSS and Radix UI primitives.
- **Unified REST API (`/api/v1`):** Next.js route handlers implement RESTful endpoints across authentication, directory listings, category details, crowd reporting, booking flows, and admin operations.
- **Database Access:** Prisma ORM provides type-safe query building with dual schema support (local SQLite development and production PostgreSQL connection pooling).
- **Session Layer:** Signed, HTTP-only session cookies with scrypt-hashed credentials, rate limiting, and brute-force lockout protection.

---

## 6. Mobile Application Architecture

The mobile application is located in [`mobile/`](mobile/) and built with **React Native and Expo**:

- **Routing:** File-based navigation via Expo Router v4 with bottom-tab navigation and native stack modals.
- **State & Storage:** Hybrid persistent storage leveraging Expo SecureStore for sensitive session tokens and AsyncStorage for favorites, offline cache, and preferences.
- **Offline Tolerance:** Bundled static image assets and cached listing storage enabling basic browsing even in intermittent connectivity zones.
- **Native Hardware Integration:** Camera QR scanning (`expo-camera`) for priority pass verification and device location queries (`expo-location`) for proximity calculations.

---

## 7. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Website & Frontend** | Next.js (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, Lucide Icons |
| **Backend & API** | Next.js Server Handlers (`/api/v1`), Node.js runtime, Zod validation |
| **Database & ORM** | PostgreSQL (Supabase / local), Prisma ORM |
| **Mobile Application** | React Native 0.79, Expo SDK 53, Expo Router, TypeScript |
| **Authentication** | Resend Email OTP, scrypt password hashing, TOTP MFA, SecureStore / HTTP cookies |
| **Object Storage** | Supabase Cloud Storage (`godavari-uploads`) / Local filesystem fallback |
| **Testing** | Node.js Test Runner (`tsx --test`), ESLint, TypeScript compiler (`tsc`) |

---

## 8. Repository Structure

```text
GODAVARI NADHI MAIN PROJECT/
├── mobile/                  # Expo / React Native mobile application
│   ├── assets/              # App icons, splash screens, and bundled offline media
│   ├── src/                 # Mobile screens, navigation routes, services, and hooks
│   ├── app.json             # Expo application manifest
│   ├── eas.json             # EAS build profiles (development, preview, production)
│   ├── package.json         # Mobile dependencies
│   └── README.md            # Mobile-specific setup guide
├── prisma/                  # Database definitions
│   ├── schema.prisma        # Development schema (SQLite compatible)
│   └── schema.postgresql.prisma # Production schema (PostgreSQL / Supabase compatible)
├── public/                  # Public website assets, icons, and static images
├── src/                     # Website and backend source code
│   ├── app/                 # Next.js App Router (views, pages, layouts)
│   │   ├── api/v1/          # Unified RESTful API routes
│   │   └── ...              # Multilingual public routes and admin dashboards
│   ├── components/          # Reusable UI components, views, and navigation bars
│   └── lib/                 # Core server utilities (auth, db, validation, email, sms)
├── tests/                   # Automated unit, integration, and security test suites
├── .env.example             # Web environment variable template
├── package.json             # Root Next.js dependencies and scripts
└── README.md                # Platform documentation (this file)
```

---

## 9. Installation Requirements

- **Node.js:** v20.x or v22.x LTS (compatible with Next.js 16 and Prisma 6)
- **Package Manager:** `npm` (v10+)
- **Git:** Standard version control
- **Database:** Local SQLite (zero-setup default) or PostgreSQL 16+ instance

---

## 10. Local Development Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/saimohit2008/GodavariOne.git
   cd GodavariOne
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to configure your local database URL and optional development keys.*

4. **Generate Prisma clients:**
   ```bash
   npm run db:generate
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Access the application:**
   - Web application: [http://localhost:3000](http://localhost:3000)
   - API health check: [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)

---

## 11. Environment Configuration

All environment variables are documented with safe placeholders in [`.env.example`](.env.example). Essential configuration categories include:

- `DATABASE_URL`: Connection string for Prisma ORM.
- `SESSION_SECRET`: Long random secret string used to sign session cookies and bearer tokens.
- `OBJECT_STORAGE_PROVIDER`: `"local"` for filesystem storage or `"supabase"` for cloud storage.
- `RESEND_API_KEY`: API key for email OTP delivery (optional for local mock testing).
- `OTP_DEV_MODE`: Set to `"true"` in local isolated testing to output OTP codes to server logs.

> [!WARNING]
> Never commit `.env`, `.env.local`, or any file containing real API keys or production database passwords.

---

## 12. Database Configuration

The application supports both local SQLite development and production PostgreSQL:

- **Local Development:** Defaults to `file:../db/custom.db` using `prisma/schema.prisma`.
- **Production PostgreSQL:** Uses `prisma/schema.postgresql.prisma` with transaction pooling.
- **Client Generation:** Run `npm run db:generate` to compile client libraries for the active schema.
- **Safety Rule:** Never execute `prisma db push --accept-data-loss` or `prisma migrate reset` against production databases.

---

## 13. API Overview

The backend exposes a unified REST API rooted at `/api/v1/`:

| Endpoint Group | Methods | Purpose |
| :--- | :--- | :--- |
| `/api/v1/auth/*` | POST, GET | Registration, email OTP dispatch, login, session inspection, logout |
| `/api/v1/listings` | GET, POST | Public listing search, category filtering, and listing creation |
| `/api/v1/listings/[id]` | GET, PUT, DELETE | Listing detail queries, category-specific updates, and management |
| `/api/v1/ghats/*` | GET, POST | Ghat directory, crowd density reporting, and operator validations |
| `/api/v1/bookings/*` | GET, POST | Priority pass issuance, restaurant reservations, hotel inquiries |
| `/api/v1/purohits/*` | GET, POST | Vedic priest directory, ritual scheduling, and booking requests |
| `/api/v1/nri/*` | GET, POST | NRI package requests, custom itinerary planning, and quotations |
| `/api/v1/admin/*` | GET, POST | User management, audit log inspection, and role assignments |
| `/api/v1/health` | GET | System and database health status |

---

## 14. Mobile Application Setup

The mobile companion application is maintained in the [`mobile/`](mobile/) folder.

To run the mobile app:
```bash
cd mobile
npm install
npm run start
```
Refer to the dedicated [Mobile README](mobile/README.md) for full configuration, Android/iOS emulator instructions, and physical device connectivity details.

---

## 15. Security Instructions

- **No Hardcoded Secrets:** The codebase enforces environment-variable injection for all secrets.
- **Browser Protection:** Privileged Supabase service-role keys and database connection strings must remain exclusively in server-side code (`src/lib/` and route handlers).
- **Input Sanitization:** All public mutation endpoints validate incoming payloads via Zod schemas.
- **Reporting Vulnerabilities:** If you discover a security vulnerability, please notify the repository maintainers privately. Do not open public GitHub issues for security disclosures.

---

## 16. Development Guidelines

- **Code Quality:** Ensure all code adheres to ESLint and TypeScript strict checking:
  ```bash
  npm run lint
  npm run typecheck
  ```
- **Automated Testing:** Run existing test suites before submitting pull requests:
  ```bash
  npm test
  ```
- **Preserve Documentation:** Retain existing code comments and architectural docstrings.

---

## 17. Known Limitations

- **Community Project:** This platform is an independent digital initiative and does not claim official government endorsement or administrative authority.
- **Payment Processing:** Financial transactions (such as accommodation payments or ritual fees) currently operate via direct merchant coordination; automated payment gateway integration is planned for future phases.
- **Push Notifications:** Native push notification delivery requires external APNs/FCM credentials configured through EAS.

---

## 18. Project Status & License

- **Status:** Active development. Architecture, schema, and API features are stabilized; production deployment preparations are ongoing.
- **License:** No open-source or proprietary software license has yet been assigned to this repository. All rights are reserved by the project authors pending official license designation.
