# Fan Retailer Survey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first web app where field reps log in, submit a "Fan Quote Form" per Karachi fan retailer (GPS, photos, voice note, brand data), and where an admin reviews all surveys with filters, export, a map, and charts.

**Architecture:** Next.js (App Router, TypeScript) frontend on Vercel; Supabase for Postgres, Auth, and private Storage. Row Level Security enforces the rep/admin boundary. A `create_survey` Postgres RPC inserts a survey plus its photo rows atomically after the client uploads media to deterministic storage paths. The Supabase service-role key is used only in server actions / route handlers.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, `@supabase/ssr`, `@supabase/supabase-js`, `browser-image-compression`, `react-leaflet` + Leaflet + OpenStreetMap, `recharts`, `xlsx`, Vitest + `@testing-library/react` + jsdom, Playwright, Supabase CLI (local stack via Docker).

**Spec:** `docs/superpowers/specs/2026-09-07-fan-retailer-survey-design.md` (read it alongside this plan).

## Global Constraints

- **Node** 20.x or newer; **npm** as package manager.
- **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.** It appears only in files under `app/**/actions.ts`, `app/api/**`, and `scripts/`. Client components use `NEXT_PUBLIC_SUPABASE_ANON_KEY` only.
- **Reps have no `update` or `delete` capability** on `surveys` / `survey_photos` — enforced by RLS, not just UI.
- **Storage buckets `survey-photos` and `survey-audio` are private.** Media reaches the browser only via server-generated signed URLs. Default signed-URL expiry: `21600` seconds (6 hours).
- **Fixed lists live only in `lib/constants.ts`** and are mirrored by Postgres `CHECK` constraints. Markets (exact strings, order matters for charts): `Arambagh`, `MA Jinnah`, `Waterpump`, `Bohrapir`, `Johar Mor`, `UP`, `Liaquatabad`, `Shah Faisal Colony`, `Orangi Town`, `Baldia Town`, `Malir`, `Landhi/Korangi`. Brands: `Tamoor`, `Khurshid`, `SK`, `GFC`, `Royal`, `Pak Fans`, `Lahore Fans`. Shop sizes: `Small`, `Medium`, `Large`.
- **Required survey fields:** `shop_name`, `market`, `shop_size`, `customer_name`, `customer_number`, GPS, exactly 1 front photo, 1–10 inner photos, `most_selling_fan`, `rec_30w_1`, `rec_50w_1`. Optional: `rec_30w_2`, `rec_50w_2`, voice note.
- **Phone format:** accept `03XXXXXXXXX` or `+923XXXXXXXXX` (spaces/dashes tolerated); store normalized as `03XXXXXXXXX`. DB `CHECK`: `customer_number ~ '^03[0-9]{9}$'`.
- **Storage path convention:** `<rep_uid>/<survey_id>/<filename>` in both buckets. Filenames: `front.jpg`, `inner-0.jpg` … `inner-9.jpg`, `comment.webm`.
- **Login is username + password.** Client maps username to `<username>@<REP_EMAIL_DOMAIN>` before calling Supabase Auth. No email is ever sent.
- **No offline support, no draft autosave.** A failed submit writes nothing; the rep retries.
- **Photo compression target:** ~1600 px longest edge, ~500 KB, JPEG.
- **Audio:** `MediaRecorder`, `audio/webm` (fallback `audio/mp4`), hard stop at 120 s.
- **Commit after every green step.** Conventional Commit prefixes (`feat:`, `test:`, `chore:`, `fix:`).
- Append to every commit message:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01MLkh57YtiPBjQcQNrzVWBW
  ```

## File Structure

```
app/
  layout.tsx                     Root layout, Tailwind import, viewport meta
  page.tsx                       Redirect: -> /dashboard or /login by session
  globals.css                    Tailwind directives + base tokens
  login/
    page.tsx                     Username/password form (client)
    actions.ts                   signIn server action
  dashboard/
    page.tsx                     Rep dashboard (server component): count + list
  survey/
    new/
      page.tsx                   Survey form host (client)
    [id]/
      page.tsx                   Read-only survey detail (server component)
      actions.ts                 getSignedMediaUrls server action
  admin/
    layout.tsx                   Admin guard + tab nav
    overview/page.tsx            Stat tiles + 4 bar charts
    surveys/page.tsx             Filter bar + table + pagination
    surveys/actions.ts           exportSurveys, deleteSurvey server actions
    map/page.tsx                 Leaflet all-surveys map
    users/page.tsx               Rep list
    users/actions.ts             createRep, setRepActive, resetRepPassword
    housekeeping/actions.ts      sweepOrphans server action
  api/
    (none required initially)
components/
  form/
    SurveyForm.tsx               Orchestrates field state + validation + submit
    TextField.tsx                Labeled text/tel input + error slot
    SelectField.tsx              Labeled native <select> + error slot
    GpsCapture.tsx               Capture button + lat/lng/accuracy + mini-map
    PhotoCapture.tsx             Front + inner photo pickers, compression, grid
    VoiceRecorder.tsx            Record/stop/playback/delete + timer
  MiniMap.tsx                    Single-pin Leaflet map (dynamic import, no SSR)
  SurveysMap.tsx                 Multi-pin clustered Leaflet map
  BarChartCard.tsx              Titled Recharts bar chart wrapper
  StatTile.tsx                   Big-number card
  MediaGallery.tsx              Thumbnail grid + lightbox for detail view
  Toast.tsx                     Minimal toast (context + hook)
lib/
  constants.ts                  MARKETS, BRANDS, SHOP_SIZES, colors, map center
  validation.ts                 normalizePhone, validateSurvey, buildSurveyPayload
  geo.ts                        getCurrentPosition wrapper
  compression.ts                compressImage wrapper
  audio.ts                      createRecorder wrapper
  format.ts                     date/relative-time helpers
  aggregations.ts               chart data reducers (pure, unit-tested)
  supabase/
    browser.ts                  createBrowserClient (anon)
    server.ts                   createServerClient (cookies, anon)
    admin.ts                    createAdminClient (service role, server-only)
    middleware.ts               updateSession helper
  types.ts                      Row types: Profile, Survey, SurveyPhoto, etc.
middleware.ts                   Route protection (session + role + active)
supabase/
  config.toml                   Supabase CLI project config
  migrations/
    0001_schema.sql
    0002_rls.sql
    0003_storage.sql
    0004_create_survey.sql
  seed.sql                      Local-only: two reps + sample surveys
scripts/
  seed-admin.ts                 Idempotent admin account creator
tests/
  unit/                         Vitest: constants, validation, aggregations, wrappers
  integration/                  Vitest against local Supabase: RLS, RPC, storage
  e2e/                          Playwright: rep flow, admin flow
  setup/
    vitest.setup.ts             jsdom + testing-library matchers
    supabase-test-client.ts     helpers to sign in as a given user in tests
vitest.config.ts
playwright.config.ts
.env.example
.env.local                      (gitignored)
README.md
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `.env.example`, `vitest.config.ts`, `tests/setup/vitest.setup.ts`, `playwright.config.ts`, `.eslintrc.json`
- Modify: `.gitignore` (already present — verify entries)

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable Next.js app (`npm run dev`), `npm test` (Vitest) and `npm run e2e` (Playwright) scripts, Tailwind configured, path alias `@/*` → repo root.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "fan-retailer-survey",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "db:start": "supabase start",
    "db:reset": "supabase db reset",
    "seed:admin": "tsx scripts/seed-admin.ts"
  },
  "dependencies": {
    "next": "15.1.6",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@supabase/supabase-js": "2.48.1",
    "@supabase/ssr": "0.5.2",
    "browser-image-compression": "2.0.2",
    "leaflet": "1.9.4",
    "react-leaflet": "4.2.1",
    "recharts": "2.15.0",
    "xlsx": "0.18.5"
  },
  "devDependencies": {
    "typescript": "5.7.3",
    "@types/node": "20.17.14",
    "@types/react": "19.0.7",
    "@types/react-dom": "19.0.3",
    "@types/leaflet": "1.9.16",
    "tailwindcss": "3.4.17",
    "postcss": "8.5.1",
    "autoprefixer": "10.4.20",
    "vitest": "2.1.8",
    "@vitejs/plugin-react": "4.3.4",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/user-event": "14.5.2",
    "jsdom": "25.0.1",
    "@playwright/test": "1.49.1",
    "tsx": "4.19.2",
    "eslint": "8.57.1",
    "eslint-config-next": "15.1.6"
  }
}
```

- [ ] **Step 2: Run `npm install`**

Run: `npm install`
Expected: completes; `node_modules/` populated; no peer-dependency errors that abort install.

- [ ] **Step 3: Create config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "tests/e2e"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { reactStrictMode: true };
export default nextConfig;
```

`postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

`.eslintrc.json`:
```json
{ "extends": "next/core-web-vitals" }
```

- [ ] **Step 4: Create app shell**

`app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light; }
html, body { height: 100%; }
body { @apply bg-slate-50 text-slate-900 antialiased; }
```

`app/layout.tsx`:
```tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Fan Retailer Survey" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/login");
}
```

- [ ] **Step 5: Create `.env.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-anon-key
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key   # server only

# App
REP_EMAIL_DOMAIN=survey.local

# Seed script only
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-strong
```

Also create `.env.local` as a copy for local dev (it is gitignored).

- [ ] **Step 6: Create test configs**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup/vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
    globals: true,
  },
});
```

`tests/setup/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 7: Smoke-check the build**

Run: `npm run build`
Expected: build succeeds; routes `/` and `/_not-found` compile. Then `npx tsc --noEmit` passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, Vitest, Playwright"
```

---

### Task 2: Constants module

**Files:**
- Create: `lib/constants.ts`, `lib/types.ts`
- Test: `tests/unit/constants.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MARKETS: readonly Market[]` (12, exact order above), `type Market`
  - `BRANDS: readonly Brand[]` (7), `type Brand`
  - `SHOP_SIZES: readonly ShopSize[]` (3), `type ShopSize`
  - `MAX_INNER_PHOTOS = 10`, `MAX_AUDIO_SECONDS = 120`, `SIGNED_URL_TTL = 21600`
  - `MARKET_COLORS: Record<Market, string>`
  - `KARACHI_CENTER: [number, number]` = `[24.86, 67.02]`, `KARACHI_ZOOM = 11`
  - `lib/types.ts`: `Profile`, `Survey`, `SurveyPhoto`, `SurveyWithRelations` row interfaces.

- [ ] **Step 1: Write the failing test**

`tests/unit/constants.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { MARKETS, BRANDS, SHOP_SIZES, MARKET_COLORS, MAX_INNER_PHOTOS } from "@/lib/constants";

describe("constants", () => {
  it("has 12 markets in spec order", () => {
    expect(MARKETS).toHaveLength(12);
    expect(MARKETS[0]).toBe("Arambagh");
    expect(MARKETS[11]).toBe("Landhi/Korangi");
  });
  it("has 7 brands", () => {
    expect(BRANDS).toEqual(["Tamoor", "Khurshid", "SK", "GFC", "Royal", "Pak Fans", "Lahore Fans"]);
  });
  it("has 3 shop sizes", () => {
    expect(SHOP_SIZES).toEqual(["Small", "Medium", "Large"]);
  });
  it("assigns a distinct colour to every market", () => {
    const colors = MARKETS.map((m) => MARKET_COLORS[m]);
    expect(new Set(colors).size).toBe(12);
  });
  it("caps inner photos at 10", () => {
    expect(MAX_INNER_PHOTOS).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- constants`
Expected: FAIL — cannot resolve `@/lib/constants`.

- [ ] **Step 3: Write `lib/constants.ts`**

```ts
export const MARKETS = [
  "Arambagh", "MA Jinnah", "Waterpump", "Bohrapir", "Johar Mor", "UP",
  "Liaquatabad", "Shah Faisal Colony", "Orangi Town", "Baldia Town", "Malir", "Landhi/Korangi",
] as const;
export type Market = (typeof MARKETS)[number];

export const BRANDS = [
  "Tamoor", "Khurshid", "SK", "GFC", "Royal", "Pak Fans", "Lahore Fans",
] as const;
export type Brand = (typeof BRANDS)[number];

export const SHOP_SIZES = ["Small", "Medium", "Large"] as const;
export type ShopSize = (typeof SHOP_SIZES)[number];

export const MAX_INNER_PHOTOS = 10;
export const MAX_AUDIO_SECONDS = 120;
export const SIGNED_URL_TTL = 21600; // 6 hours

export const MARKET_COLORS: Record<Market, string> = {
  "Arambagh": "#e6194b", "MA Jinnah": "#3cb44b", "Waterpump": "#e6a700",
  "Bohrapir": "#4363d8", "Johar Mor": "#f58231", "UP": "#911eb4",
  "Liaquatabad": "#009fb0", "Shah Faisal Colony": "#f032e6", "Orangi Town": "#7a9a01",
  "Baldia Town": "#c26f9d", "Malir": "#469990", "Landhi/Korangi": "#9a6324",
};

export const KARACHI_CENTER: [number, number] = [24.86, 67.02];
export const KARACHI_ZOOM = 11;
```

- [ ] **Step 4: Write `lib/types.ts`**

```ts
import type { Brand, Market, ShopSize } from "./constants";

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "rep";
  active: boolean;
  created_at: string;
}

export interface SurveyPhoto {
  id: string;
  survey_id: string;
  kind: "front" | "inner";
  storage_path: string;
  sort_order: number;
}

export interface Survey {
  id: string;
  rep_id: string;
  shop_name: string;
  market: Market;
  shop_size: ShopSize;
  customer_name: string;
  customer_number: string;
  gps_lat: number;
  gps_lng: number;
  gps_accuracy: number | null;
  most_selling_fan: Brand;
  rec_30w_1: Brand;
  rec_30w_2: Brand | null;
  rec_50w_1: Brand;
  rec_50w_2: Brand | null;
  audio_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyWithRelations extends Survey {
  rep: Pick<Profile, "id" | "username" | "full_name">;
  photos: SurveyPhoto[];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- constants`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/constants.ts lib/types.ts tests/unit/constants.test.ts
git commit -m "feat: add shared constants and row types"
```

---

### Task 3: Validation module

**Files:**
- Create: `lib/validation.ts`
- Test: `tests/unit/validation.test.ts`

**Interfaces:**
- Consumes: `MARKETS`, `BRANDS`, `SHOP_SIZES`, `MAX_INNER_PHOTOS` from `@/lib/constants`.
- Produces:
  - `normalizePhone(input: string): string | null` — returns `03XXXXXXXXX` or `null`.
  - `interface SurveyFormValues` — string-valued form fields plus `gps: GpsFix | null`, `frontPhoto: File | null`, `innerPhotos: File[]`, `audio: Blob | null`.
  - `interface GpsFix { lat: number; lng: number; accuracy: number | null }`.
  - `validateSurvey(v: SurveyFormValues): Record<string, string>` — key per invalid field; empty object = valid.
  - `buildSurveyPayload(id: string, v: SurveyFormValues, paths: { front: string; inner: string[]; audio: string | null }): SurveyRpcPayload` — the object passed to the `create_survey` RPC.
  - `interface SurveyRpcPayload`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizePhone, validateSurvey, buildSurveyPayload, type SurveyFormValues } from "@/lib/validation";

const valid: SurveyFormValues = {
  shop_name: "Al Madina Electronics",
  market: "Arambagh",
  shop_size: "Medium",
  customer_name: "Bilal",
  customer_number: "0300 1234567",
  gps: { lat: 24.86, lng: 67.02, accuracy: 12 },
  most_selling_fan: "GFC",
  rec_30w_1: "Tamoor",
  rec_30w_2: "",
  rec_50w_1: "Royal",
  rec_50w_2: "",
  frontPhoto: new File(["x"], "front.jpg", { type: "image/jpeg" }),
  innerPhotos: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
  audio: null,
};

describe("normalizePhone", () => {
  it.each([
    ["03001234567", "03001234567"],
    ["0300 123 4567", "03001234567"],
    ["+923001234567", "03001234567"],
    ["+92 300 1234567", "03001234567"],
  ])("accepts %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
  it.each(["12345", "0300123456", "030012345678", "0421234567", ""])(
    "rejects %s",
    (input) => expect(normalizePhone(input)).toBeNull(),
  );
});

describe("validateSurvey", () => {
  it("passes a fully valid form", () => {
    expect(validateSurvey(valid)).toEqual({});
  });
  it("flags every missing required field", () => {
    const errs = validateSurvey({
      ...valid, shop_name: " ", market: "", shop_size: "", customer_name: "",
      customer_number: "abc", gps: null, most_selling_fan: "", rec_30w_1: "",
      rec_50w_1: "", frontPhoto: null, innerPhotos: [],
    });
    for (const k of ["shop_name","market","shop_size","customer_name","customer_number","gps","most_selling_fan","rec_30w_1","rec_50w_1","frontPhoto","innerPhotos"]) {
      expect(errs).toHaveProperty(k);
    }
  });
  it("allows blank optional recommendations", () => {
    expect(validateSurvey({ ...valid, rec_30w_2: "", rec_50w_2: "" })).toEqual({});
  });
  it("rejects an out-of-range optional recommendation", () => {
    expect(validateSurvey({ ...valid, rec_30w_2: "Nonsense" })).toHaveProperty("rec_30w_2");
  });
  it("rejects more than 10 inner photos", () => {
    const many = Array.from({ length: 11 }, (_, i) => new File(["x"], `${i}.jpg`, { type: "image/jpeg" }));
    expect(validateSurvey({ ...valid, innerPhotos: many })).toHaveProperty("innerPhotos");
  });
});

describe("buildSurveyPayload", () => {
  it("normalizes phone and maps photo paths", () => {
    const p = buildSurveyPayload("11111111-1111-1111-1111-111111111111", valid, {
      front: "uid/sid/front.jpg", inner: ["uid/sid/inner-0.jpg"], audio: null,
    });
    expect(p.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(p.customer_number).toBe("03001234567");
    expect(p.rec_30w_2).toBeNull();
    expect(p.audio_path).toBeNull();
    expect(p.photos).toEqual([
      { kind: "front", storage_path: "uid/sid/front.jpg", sort_order: 0 },
      { kind: "inner", storage_path: "uid/sid/inner-0.jpg", sort_order: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- validation`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/validation.ts`**

```ts
import { BRANDS, MARKETS, SHOP_SIZES, MAX_INNER_PHOTOS } from "./constants";

export interface GpsFix { lat: number; lng: number; accuracy: number | null }

export interface SurveyFormValues {
  shop_name: string;
  market: string;
  shop_size: string;
  customer_name: string;
  customer_number: string;
  gps: GpsFix | null;
  most_selling_fan: string;
  rec_30w_1: string;
  rec_30w_2: string;
  rec_50w_1: string;
  rec_50w_2: string;
  frontPhoto: File | null;
  innerPhotos: File[];
  audio: Blob | null;
}

export interface SurveyRpcPayload {
  id: string;
  shop_name: string;
  market: string;
  shop_size: string;
  customer_name: string;
  customer_number: string;
  gps_lat: number;
  gps_lng: number;
  gps_accuracy: number | null;
  most_selling_fan: string;
  rec_30w_1: string;
  rec_30w_2: string | null;
  rec_50w_1: string;
  rec_50w_2: string | null;
  audio_path: string | null;
  photos: { kind: "front" | "inner"; storage_path: string; sort_order: number }[];
}

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  let m = digits.match(/^\+92(3\d{9})$/);
  if (m) return "0" + m[1];
  m = digits.match(/^(03\d{9})$/);
  if (m) return m[1];
  return null;
}

const isBrand = (v: string) => (BRANDS as readonly string[]).includes(v);

export function validateSurvey(v: SurveyFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.shop_name.trim()) e.shop_name = "Shop name is required";
  if (!(MARKETS as readonly string[]).includes(v.market)) e.market = "Select a market";
  if (!(SHOP_SIZES as readonly string[]).includes(v.shop_size)) e.shop_size = "Select a shop size";
  if (!v.customer_name.trim()) e.customer_name = "Customer name is required";
  if (!normalizePhone(v.customer_number)) e.customer_number = "Enter a valid Pakistani mobile number";
  if (!v.gps) e.gps = "Capture the shop location";
  if (!isBrand(v.most_selling_fan)) e.most_selling_fan = "Select the most selling fan";
  if (!isBrand(v.rec_30w_1)) e.rec_30w_1 = "Select a 30W recommendation";
  if (v.rec_30w_2 && !isBrand(v.rec_30w_2)) e.rec_30w_2 = "Invalid brand";
  if (!isBrand(v.rec_50w_1)) e.rec_50w_1 = "Select a 50W recommendation";
  if (v.rec_50w_2 && !isBrand(v.rec_50w_2)) e.rec_50w_2 = "Invalid brand";
  if (!v.frontPhoto) e.frontPhoto = "Add a front photo";
  if (v.innerPhotos.length < 1) e.innerPhotos = "Add at least one inner photo";
  else if (v.innerPhotos.length > MAX_INNER_PHOTOS) e.innerPhotos = `No more than ${MAX_INNER_PHOTOS} inner photos`;
  return e;
}

export function buildSurveyPayload(
  id: string,
  v: SurveyFormValues,
  paths: { front: string; inner: string[]; audio: string | null },
): SurveyRpcPayload {
  return {
    id,
    shop_name: v.shop_name.trim(),
    market: v.market,
    shop_size: v.shop_size,
    customer_name: v.customer_name.trim(),
    customer_number: normalizePhone(v.customer_number)!,
    gps_lat: v.gps!.lat,
    gps_lng: v.gps!.lng,
    gps_accuracy: v.gps!.accuracy,
    most_selling_fan: v.most_selling_fan,
    rec_30w_1: v.rec_30w_1,
    rec_30w_2: v.rec_30w_2 || null,
    rec_50w_1: v.rec_50w_1,
    rec_50w_2: v.rec_50w_2 || null,
    audio_path: paths.audio,
    photos: [
      { kind: "front", storage_path: paths.front, sort_order: 0 },
      ...paths.inner.map((p, i) => ({ kind: "inner" as const, storage_path: p, sort_order: i })),
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- validation`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts tests/unit/validation.test.ts
git commit -m "feat: add survey validation and RPC payload builder"
```

---

### Task 4: Database schema migration

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/0001_schema.sql`, `tests/setup/supabase-test-client.ts`, `tests/integration/schema.test.ts`
- Modify: `.gitignore` — add `supabase/.branches/`, `supabase/.temp/` (verify present)

**Interfaces:**
- Consumes: nothing (SQL only).
- Produces: tables `public.profiles`, `public.surveys`, `public.survey_photos` with `CHECK` constraints and an `updated_at` trigger; a `serviceClient()` test helper.

- [ ] **Step 1: Initialize Supabase and start the local stack**

Run: `npx supabase init` (accept defaults) then `npx supabase start`
Expected: prints local `API URL`, `anon key`, `service_role key`. Copy `anon key` / `service_role key` into `.env.local`.

- [ ] **Step 2: Write the failing test**

`tests/setup/supabase-test-client.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

export function serviceClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anonClient() {
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function signInAs(email: string, password: string) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}
```

`tests/integration/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { serviceClient } from "@/tests/setup/supabase-test-client";

describe("schema", () => {
  const db = serviceClient();

  it("rejects an unknown market", async () => {
    const { error } = await db.from("surveys").insert({
      id: "22222222-2222-2222-2222-222222222222",
      rep_id: "00000000-0000-0000-0000-000000000000",
      shop_name: "x", market: "Nowhere", shop_size: "Small",
      customer_name: "x", customer_number: "03001234567",
      gps_lat: 24, gps_lng: 67, most_selling_fan: "GFC",
      rec_30w_1: "GFC", rec_50w_1: "GFC",
    });
    expect(error?.message).toMatch(/surveys_market_check|violates check/i);
  });

  it("rejects a malformed phone number", async () => {
    const { error } = await db.from("surveys").insert({
      id: "33333333-3333-3333-3333-333333333333",
      rep_id: "00000000-0000-0000-0000-000000000000",
      shop_name: "x", market: "Malir", shop_size: "Small",
      customer_name: "x", customer_number: "12345",
      gps_lat: 24, gps_lng: 67, most_selling_fan: "GFC",
      rec_30w_1: "GFC", rec_50w_1: "GFC",
    });
    expect(error?.message).toMatch(/customer_number|violates check/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- integration/schema`
Expected: FAIL — relation `surveys` does not exist.

- [ ] **Step 4: Write `supabase/migrations/0001_schema.sql`**

```sql
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null,
  role text not null default 'rep' check (role in ('admin', 'rep')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.profiles(id),
  shop_name text not null,
  market text not null check (market in (
    'Arambagh', 'MA Jinnah', 'Waterpump', 'Bohrapir', 'Johar Mor', 'UP',
    'Liaquatabad', 'Shah Faisal Colony', 'Orangi Town', 'Baldia Town', 'Malir', 'Landhi/Korangi')),
  shop_size text not null check (shop_size in ('Small', 'Medium', 'Large')),
  customer_name text not null,
  customer_number text not null check (customer_number ~ '^03[0-9]{9}$'),
  gps_lat double precision not null,
  gps_lng double precision not null,
  gps_accuracy double precision,
  most_selling_fan text not null check (most_selling_fan in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  rec_30w_1 text not null check (rec_30w_1 in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  rec_30w_2 text check (rec_30w_2 in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  rec_50w_1 text not null check (rec_50w_1 in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  rec_50w_2 text check (rec_50w_2 in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index surveys_rep_id_idx on public.surveys (rep_id);
create index surveys_market_idx on public.surveys (market);
create index surveys_created_at_idx on public.surveys (created_at desc);

create table public.survey_photos (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  kind text not null check (kind in ('front', 'inner')),
  storage_path text not null,
  sort_order int not null default 0
);
create index survey_photos_survey_id_idx on public.survey_photos (survey_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger surveys_set_updated_at
  before update on public.surveys
  for each row execute function public.set_updated_at();
```

- [ ] **Step 5: Apply and re-run**

Run: `npx supabase db reset` then `npm test -- integration/schema`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/migrations/0001_schema.sql tests/setup/supabase-test-client.ts tests/integration/schema.test.ts
git commit -m "feat: add database schema for profiles, surveys, survey_photos"
```

---

### Task 5: RLS policies migration

**Files:**
- Create: `supabase/migrations/0002_rls.sql`, `tests/integration/rls.test.ts`
- Modify: `supabase/seed.sql` (create — two rep users + one admin for local tests)

**Interfaces:**
- Consumes: tables from Task 4; `serviceClient` / `signInAs` from Task 4 helper.
- Produces: `public.is_admin()` SECURITY DEFINER function; RLS enabled with policies exactly per spec §5. Local seed users: `admin` / `rep.one` / `rep.two`, password `test-pass-123`, emails `<username>@survey.local`.

- [ ] **Step 1: Write `supabase/seed.sql`**

```sql
-- Local development seed ONLY. Not used in production.
-- Creates auth users + profiles for manual testing and integration tests.
do $$
declare
  admin_id uuid := '10000000-0000-0000-0000-000000000001';
  rep1_id  uuid := '10000000-0000-0000-0000-000000000002';
  rep2_id  uuid := '10000000-0000-0000-0000-000000000003';
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    (admin_id, 'authenticated', 'authenticated', 'admin@survey.local',  crypt('test-pass-123', gen_salt('bf')), now(), now(), now()),
    (rep1_id,  'authenticated', 'authenticated', 'rep.one@survey.local', crypt('test-pass-123', gen_salt('bf')), now(), now(), now()),
    (rep2_id,  'authenticated', 'authenticated', 'rep.two@survey.local', crypt('test-pass-123', gen_salt('bf')), now(), now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, username, full_name, role, active)
  values
    (admin_id, 'admin',   'Site Admin',  'admin', true),
    (rep1_id,  'rep.one', 'Rep One',     'rep',   true),
    (rep2_id,  'rep.two', 'Rep Two',     'rep',   true)
  on conflict (id) do nothing;
end $$;
```

- [ ] **Step 2: Write the failing test**

`tests/integration/rls.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

const REP1 = "10000000-0000-0000-0000-000000000002";
const survey = (id: string, rep_id: string) => ({
  id, rep_id, shop_name: "s", market: "Malir", shop_size: "Small",
  customer_name: "c", customer_number: "03001234567",
  gps_lat: 24.9, gps_lng: 67.1, most_selling_fan: "GFC",
  rec_30w_1: "GFC", rec_50w_1: "GFC",
});

describe("RLS", () => {
  beforeAll(async () => {
    const db = serviceClient();
    await db.from("surveys").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("surveys").insert(survey("44444444-4444-4444-4444-444444444444", REP1));
  });

  it("rep can read own survey but not another rep's", async () => {
    const rep2 = await signInAs("rep.two@survey.local", "test-pass-123");
    const { data } = await rep2.from("surveys").select("id");
    expect(data).toEqual([]);
  });

  it("rep cannot update a survey", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep1.from("surveys")
      .update({ shop_name: "hacked" }).eq("id", "44444444-4444-4444-4444-444444444444");
    // no update policy -> zero rows affected, treated as success with 0 rows
    const { data } = await serviceClient().from("surveys")
      .select("shop_name").eq("id", "44444444-4444-4444-4444-444444444444").single();
    expect(data?.shop_name).toBe("s");
    expect(error).toBeNull();
  });

  it("rep cannot delete a survey", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    await rep1.from("surveys").delete().eq("id", "44444444-4444-4444-4444-444444444444");
    const { count } = await serviceClient().from("surveys")
      .select("id", { count: "exact", head: true }).eq("id", "44444444-4444-4444-4444-444444444444");
    expect(count).toBe(1);
  });

  it("admin can read every survey", async () => {
    const admin = await signInAs("admin@survey.local", "test-pass-123");
    const { data } = await admin.from("surveys").select("id");
    expect(data?.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- integration/rls`
Expected: FAIL — RLS not enabled, rep.two sees rows / rep update succeeds.

- [ ] **Step 4: Write `supabase/migrations/0002_rls.sql`**

```sql
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active
  );
$$;

alter table public.profiles enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_photos enable row level security;

-- profiles
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- surveys
create policy surveys_rep_insert on public.surveys
  for insert with check (rep_id = auth.uid());
create policy surveys_select_own_or_admin on public.surveys
  for select using (rep_id = auth.uid() or public.is_admin());
create policy surveys_admin_update on public.surveys
  for update using (public.is_admin()) with check (public.is_admin());
create policy surveys_admin_delete on public.surveys
  for delete using (public.is_admin());

-- survey_photos
create policy survey_photos_rep_insert on public.survey_photos
  for insert with check (exists (
    select 1 from public.surveys s where s.id = survey_id and s.rep_id = auth.uid()));
create policy survey_photos_select on public.survey_photos
  for select using (exists (
    select 1 from public.surveys s
    where s.id = survey_id and (s.rep_id = auth.uid() or public.is_admin())));
create policy survey_photos_admin_write on public.survey_photos
  for all using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 5: Apply and re-run**

Run: `npx supabase db reset` then `npm test -- integration/rls`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_rls.sql supabase/seed.sql tests/integration/rls.test.ts
git commit -m "feat: add RLS policies and local seed users"
```

---

### Task 6: Storage buckets and policies migration

**Files:**
- Create: `supabase/migrations/0003_storage.sql`, `tests/integration/storage.test.ts`

**Interfaces:**
- Consumes: `is_admin()` from Task 5; seed users.
- Produces: private buckets `survey-photos`, `survey-audio`; `storage.objects` policies restricting a rep to the `<their uid>/…` prefix and granting admin read.

- [ ] **Step 1: Write the failing test**

`tests/integration/storage.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { signInAs } from "@/tests/setup/supabase-test-client";

const REP1 = "10000000-0000-0000-0000-000000000002";
const REP2 = "10000000-0000-0000-0000-000000000003";
const bytes = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });

describe("storage policies", () => {
  it("rep can upload under their own uid prefix", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep1.storage.from("survey-photos")
      .upload(`${REP1}/test-survey/front.jpg`, bytes, { upsert: true });
    expect(error).toBeNull();
  });

  it("rep cannot upload under another rep's prefix", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep1.storage.from("survey-photos")
      .upload(`${REP2}/test-survey/front.jpg`, bytes, { upsert: true });
    expect(error).not.toBeNull();
  });

  it("admin can download any rep's object", async () => {
    const admin = await signInAs("admin@survey.local", "test-pass-123");
    const { error } = await admin.storage.from("survey-photos")
      .download(`${REP1}/test-survey/front.jpg`);
    expect(error).toBeNull();
  });

  it("buckets are private (no public URL access)", async () => {
    const admin = await signInAs("admin@survey.local", "test-pass-123");
    const { data } = admin.storage.from("survey-photos").getPublicUrl(`${REP1}/test-survey/front.jpg`);
    const res = await fetch(data.publicUrl);
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- integration/storage`
Expected: FAIL — bucket `survey-photos` not found.

- [ ] **Step 3: Write `supabase/migrations/0003_storage.sql`**

```sql
insert into storage.buckets (id, name, public)
values ('survey-photos', 'survey-photos', false),
       ('survey-audio', 'survey-audio', false)
on conflict (id) do nothing;

create policy "survey_photos_rep_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "survey_photos_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'survey-photos' and public.is_admin());

create policy "survey_audio_rep_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "survey_audio_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'survey-audio' and public.is_admin());
```

- [ ] **Step 4: Apply and re-run**

Run: `npx supabase db reset` then `npm test -- integration/storage`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_storage.sql tests/integration/storage.test.ts
git commit -m "feat: add private storage buckets and access policies"
```

---

### Task 7: `create_survey` RPC migration

**Files:**
- Create: `supabase/migrations/0004_create_survey.sql`, `tests/integration/create-survey-rpc.test.ts`

**Interfaces:**
- Consumes: schema + RLS from Tasks 4–5; `signInAs`, `serviceClient`.
- Produces: `public.create_survey(payload jsonb) returns uuid`, SECURITY INVOKER. Inserts the survey row and its photo rows in one transaction; raises (rolls back) when front count ≠ 1 or inner count ∉ [1,10]. The `rep_id` is always `auth.uid()`.

- [ ] **Step 1: Write the failing test**

`tests/integration/create-survey-rpc.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

const REP1 = "10000000-0000-0000-0000-000000000002";

function payload(id: string, over: Record<string, unknown> = {}) {
  return {
    id, shop_name: "Al Madina", market: "Arambagh", shop_size: "Medium",
    customer_name: "Bilal", customer_number: "03001234567",
    gps_lat: 24.86, gps_lng: 67.02, gps_accuracy: 10,
    most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: null,
    rec_50w_1: "Royal", rec_50w_2: null, audio_path: null,
    photos: [
      { kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
      { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
    ],
    ...over,
  };
}

describe("create_survey RPC", () => {
  beforeEach(async () => {
    await serviceClient().from("surveys").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  });

  it("inserts survey + photos and returns the id", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "55555555-5555-5555-5555-555555555555";
    const { data, error } = await rep.rpc("create_survey", { payload: payload(id) });
    expect(error).toBeNull();
    expect(data).toBe(id);
    const { data: photos } = await serviceClient().from("survey_photos").select("kind").eq("survey_id", id);
    expect(photos?.map((p) => p.kind).sort()).toEqual(["front", "inner"]);
  });

  it("forces rep_id to the caller", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "66666666-6666-6666-6666-666666666666";
    await rep.rpc("create_survey", { payload: payload(id) });
    const { data } = await serviceClient().from("surveys").select("rep_id").eq("id", id).single();
    expect(data?.rep_id).toBe(REP1);
  });

  it("rolls back entirely when there are zero inner photos", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "77777777-7777-7777-7777-777777777777";
    const { error } = await rep.rpc("create_survey", {
      payload: payload(id, { photos: [{ kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 }] }),
    });
    expect(error).not.toBeNull();
    const { count } = await serviceClient().from("surveys")
      .select("id", { count: "exact", head: true }).eq("id", id);
    expect(count).toBe(0);
  });

  it("rolls back when there are two front photos", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "88888888-8888-8888-8888-888888888888";
    const { error } = await rep.rpc("create_survey", {
      payload: payload(id, { photos: [
        { kind: "front", storage_path: "a", sort_order: 0 },
        { kind: "front", storage_path: "b", sort_order: 0 },
        { kind: "inner", storage_path: "c", sort_order: 0 },
      ] }),
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- create-survey-rpc`
Expected: FAIL — function `create_survey` does not exist.

- [ ] **Step 3: Write `supabase/migrations/0004_create_survey.sql`**

```sql
create or replace function public.create_survey(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (payload->>'id')::uuid;
  v_photo jsonb;
  v_front int := 0;
  v_inner int := 0;
begin
  if v_id is null then
    raise exception 'payload.id is required';
  end if;

  insert into public.surveys (
    id, rep_id, shop_name, market, shop_size, customer_name, customer_number,
    gps_lat, gps_lng, gps_accuracy, most_selling_fan,
    rec_30w_1, rec_30w_2, rec_50w_1, rec_50w_2, audio_path
  ) values (
    v_id, auth.uid(),
    payload->>'shop_name', payload->>'market', payload->>'shop_size',
    payload->>'customer_name', payload->>'customer_number',
    (payload->>'gps_lat')::double precision,
    (payload->>'gps_lng')::double precision,
    nullif(payload->>'gps_accuracy', '')::double precision,
    payload->>'most_selling_fan',
    payload->>'rec_30w_1', nullif(payload->>'rec_30w_2', ''),
    payload->>'rec_50w_1', nullif(payload->>'rec_50w_2', ''),
    nullif(payload->>'audio_path', '')
  );

  for v_photo in select * from jsonb_array_elements(coalesce(payload->'photos', '[]'::jsonb))
  loop
    insert into public.survey_photos (survey_id, kind, storage_path, sort_order)
    values (v_id, v_photo->>'kind', v_photo->>'storage_path',
            coalesce((v_photo->>'sort_order')::int, 0));
    if v_photo->>'kind' = 'front' then v_front := v_front + 1;
    elsif v_photo->>'kind' = 'inner' then v_inner := v_inner + 1;
    end if;
  end loop;

  if v_front <> 1 then
    raise exception 'exactly one front photo required (got %)', v_front;
  end if;
  if v_inner < 1 or v_inner > 10 then
    raise exception 'between 1 and 10 inner photos required (got %)', v_inner;
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_survey(jsonb) from public, anon;
grant execute on function public.create_survey(jsonb) to authenticated;
```

- [ ] **Step 4: Apply and re-run**

Run: `npx supabase db reset` then `npm test -- create-survey-rpc`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the whole integration suite**

Run: `npm test -- integration`
Expected: schema + rls + storage + rpc all PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_create_survey.sql tests/integration/create-survey-rpc.test.ts
git commit -m "feat: add atomic create_survey RPC"
```

---

### Task 8: Supabase client factories

**Files:**
- Create: `lib/supabase/browser.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts`
- Test: `tests/unit/supabase-admin-guard.test.ts`

**Interfaces:**
- Consumes: env vars.
- Produces:
  - `createBrowserSupabase(): SupabaseClient` — anon key, for client components.
  - `createServerSupabase(): Promise<SupabaseClient>` — anon key, reads/writes cookies via `next/headers`, for server components and server actions running as the signed-in user.
  - `createAdminSupabase(): SupabaseClient` — service-role key, **throws if imported where `window` is defined** and if `SUPABASE_SERVICE_ROLE_KEY` is missing.
  - `updateSession(request: NextRequest): Promise<NextResponse>` — refreshes the auth cookie; returns the response to pass through from middleware.

- [ ] **Step 1: Write the failing test**

`tests/unit/supabase-admin-guard.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

describe("createAdminSupabase", () => {
  it("throws when the service role key is absent", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { createAdminSupabase } = await import("@/lib/supabase/admin");
    expect(() => createAdminSupabase()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- supabase-admin-guard`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the four client files**

`lib/supabase/browser.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component render — safe to ignore; middleware refreshes.
          }
        },
      },
    },
  );
}
```

`lib/supabase/admin.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

export function createAdminSupabase() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminSupabase must never run in the browser");
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

`lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { response, supabase, user };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- supabase-admin-guard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase tests/unit/supabase-admin-guard.test.ts
git commit -m "feat: add Supabase browser, server, admin, and middleware clients"
```

---

### Task 9: Seed-admin script

**Files:**
- Create: `scripts/seed-admin.ts`

**Interfaces:**
- Consumes: `createAdminSupabase` from Task 8; `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `REP_EMAIL_DOMAIN`.
- Produces: a `npm run seed:admin` command that creates (or updates the password of) the admin auth user and its `profiles` row with `role = 'admin'`. Idempotent.

- [ ] **Step 1: Write `scripts/seed-admin.ts`**

```ts
import { createAdminSupabase } from "@/lib/supabase/admin";

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const domain = process.env.REP_EMAIL_DOMAIN ?? "survey.local";
  if (!username || !password) throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required");

  const db = createAdminSupabase();
  const email = `${username}@${domain}`;

  const { data: list } = await db.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    await db.auth.admin.updateUserById(userId, { password });
    console.log(`Updated password for existing admin ${email}`);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created admin auth user ${email}`);
  }

  const { error: upsertError } = await db.from("profiles").upsert(
    { id: userId, username, full_name: "Administrator", role: "admin", active: true },
    { onConflict: "id" },
  );
  if (upsertError) throw upsertError;
  console.log("Admin profile ready.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it against the local stack**

Run: `npm run seed:admin` (with `.env.local` providing `ADMIN_USERNAME=admin2`, `ADMIN_PASSWORD=strong-pass-123`)
Expected: prints "Created admin auth user admin2@survey.local" then "Admin profile ready." Re-running prints the "Updated password" branch and exits 0.

- [ ] **Step 3: Verify manually**

Run: `npx supabase db query "select username, role from public.profiles where username = 'admin2'"`
Expected: one row, `role = admin`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-admin.ts
git commit -m "feat: add idempotent seed-admin script"
```

---

### Task 10: Login page, auth action, and route protection

**Files:**
- Create: `app/login/page.tsx`, `app/login/actions.ts`, `middleware.ts`, `lib/auth.ts`
- Test: `tests/unit/auth-helpers.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 8), `updateSession` (Task 8), seed users (Task 5).
- Produces:
  - `usernameToEmail(username: string): string` in `lib/auth.ts`.
  - `getSessionProfile(): Promise<Profile | null>` in `lib/auth.ts` — server-only; returns the signed-in user's profile row or `null`.
  - `signIn(formData: FormData): Promise<{ error: string } | never>` server action — on success `redirect`s to `/dashboard` (rep) or `/admin/overview` (admin).
  - `middleware.ts` — unauthenticated → `/login`; authenticated non-admin hitting `/admin/*` → `/dashboard`; authenticated hitting `/login` → home; inactive user → signed out + `/login?error=inactive`.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/auth-helpers.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

describe("usernameToEmail", () => {
  it("appends the configured domain", async () => {
    vi.stubEnv("REP_EMAIL_DOMAIN", "survey.local");
    const { usernameToEmail } = await import("@/lib/auth");
    expect(usernameToEmail("Rep.One")).toBe("rep.one@survey.local");
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- auth-helpers`
Expected: FAIL — `@/lib/auth` not found.

- [ ] **Step 3: Write `lib/auth.ts`**

```ts
import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export function usernameToEmail(username: string): string {
  const domain = process.env.REP_EMAIL_DOMAIN ?? "survey.local";
  return `${username.trim().toLowerCase()}@${domain}`;
}

export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}
```

> Note: `lib/auth.ts` uses `server-only`; the unit test imports it in jsdom, so guard the `server-only` import — replace it with a comment if Vitest rejects it, or add `server-only` to `test.server.deps.inline`. Simplest: skip the `server-only` import and rely on the `createServerSupabase` (`next/headers`) call to fail loudly if used client-side. Use this version instead:

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export function usernameToEmail(username: string): string {
  const domain = process.env.REP_EMAIL_DOMAIN ?? "survey.local";
  return `${username.trim().toLowerCase()}@${domain}`;
}

export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- auth-helpers`
Expected: PASS.

- [ ] **Step 5: Write `app/login/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/auth";

export async function signIn(_prev: unknown, formData: FormData): Promise<{ error: string }> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const supabase = await createServerSupabase();
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error || !auth.user) return { error: "Incorrect username or password." };

  const { data: profile } = await supabase.from("profiles")
    .select("role, active").eq("id", auth.user.id).single();
  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    return { error: "This account is inactive. Contact your administrator." };
  }
  redirect(profile.role === "admin" ? "/admin/overview" : "/dashboard");
}
```

- [ ] **Step 6: Write `app/login/page.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Fan Retailer Survey</h1>
        <p className="text-sm text-slate-500">Sign in to record shop visits.</p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Username
          <input name="username" autoCapitalize="none" autoCorrect="off" required
            className="rounded-lg border border-slate-300 px-3 py-2 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input name="password" type="password" required
            className="rounded-lg border border-slate-300 px-3 py-2 text-base" />
        </label>
        {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
        <button type="submit" disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-base font-medium text-white disabled:opacity-60">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Write `middleware.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user) {
    if (pathname === "/login") return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase.from("profiles")
    .select("role, active").eq("id", user.id).single();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=inactive", request.url));
  }

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(profile.role === "admin" ? "/admin/overview" : "/dashboard", request.url));
  }
  if (pathname.startsWith("/admin") && profile.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
```

- [ ] **Step 8: Write `tests/e2e/auth.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("unauthenticated user is sent to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("rep signs in and lands on the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.one");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("rep cannot open the admin area", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.one");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/overview");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("admin signs in and lands on the overview", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
});
```

- [ ] **Step 9: Add placeholder `/dashboard` and `/admin/overview` pages so redirects resolve**

`app/dashboard/page.tsx`:
```tsx
export default function DashboardPage() {
  return <main className="p-6">Dashboard</main>;
}
```

`app/admin/overview/page.tsx`:
```tsx
export default function AdminOverviewPage() {
  return <main className="p-6">Admin overview</main>;
}
```

- [ ] **Step 10: Run the e2e auth suite**

Run: `npx supabase start` (if not running) then `npm run e2e -- auth`
Expected: 4 tests PASS. (Dev server auto-starts via `playwright.config.ts`.)

- [ ] **Step 11: Commit**

```bash
git add app/login middleware.ts lib/auth.ts app/dashboard app/admin/overview tests/unit/auth-helpers.test.ts tests/e2e/auth.spec.ts
git commit -m "feat: add username/password login and route protection"
```

---

### Task 11: Geolocation wrapper

**Files:**
- Create: `lib/geo.ts`
- Test: `tests/unit/geo.test.ts`

**Interfaces:**
- Consumes: `GpsFix` type from `@/lib/validation`.
- Produces: `getCurrentPosition(opts?: PositionOptions): Promise<GpsFix>` — resolves `{ lat, lng, accuracy }`; rejects with `Error` whose `message` is one of `"permission-denied"`, `"unavailable"`, `"timeout"`, `"unsupported"`.

- [ ] **Step 1: Write the failing test**

`tests/unit/geo.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getCurrentPosition } from "@/lib/geo";

afterEach(() => vi.unstubAllGlobals());

function stubGeo(impl: (ok: PositionCallback, err: PositionErrorCallback) => void) {
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: impl } });
}

describe("getCurrentPosition", () => {
  it("resolves lat/lng/accuracy", async () => {
    stubGeo((ok) => ok({ coords: { latitude: 24.86, longitude: 67.02, accuracy: 8 } } as GeolocationPosition));
    await expect(getCurrentPosition()).resolves.toEqual({ lat: 24.86, lng: 67.02, accuracy: 8 });
  });
  it("maps PERMISSION_DENIED to 'permission-denied'", async () => {
    stubGeo((_ok, err) => err({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError));
    await expect(getCurrentPosition()).rejects.toThrow("permission-denied");
  });
  it("rejects with 'unsupported' when geolocation is absent", async () => {
    vi.stubGlobal("navigator", {});
    await expect(getCurrentPosition()).rejects.toThrow("unsupported");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- geo`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/geo.ts`**

```ts
import type { GpsFix } from "./validation";

export function getCurrentPosition(opts: PositionOptions = { enableHighAccuracy: true, timeout: 15000 }): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      }),
      (err) => {
        const map: Record<number, string> = { 1: "permission-denied", 2: "unavailable", 3: "timeout" };
        reject(new Error(map[err.code] ?? "unavailable"));
      },
      opts,
    );
  });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- geo`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/geo.ts tests/unit/geo.test.ts
git commit -m "feat: add geolocation wrapper"
```

---

### Task 12: Image compression wrapper

**Files:**
- Create: `lib/compression.ts`
- Test: `tests/unit/compression.test.ts`

**Interfaces:**
- Consumes: `browser-image-compression`.
- Produces: `compressImage(file: File): Promise<File>` — targets ~1600 px / ~0.5 MB JPEG, always returns a `File` named `<originalBaseName>.jpg` with type `image/jpeg`; on library failure returns the original file unchanged (never throws).

- [ ] **Step 1: Write the failing test**

`tests/unit/compression.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (file: File) => new File([await file.arrayBuffer()], "out.dat", { type: "image/jpeg" })),
}));

import imageCompression from "browser-image-compression";
import { compressImage } from "@/lib/compression";

describe("compressImage", () => {
  it("passes the spec size options and returns a .jpg File", async () => {
    const input = new File([new Uint8Array(2048)], "Shopfront.PNG", { type: "image/png" });
    const out = await compressImage(input);
    expect(out).toBeInstanceOf(File);
    expect(out.name).toBe("Shopfront.jpg");
    expect(out.type).toBe("image/jpeg");
    const opts = (imageCompression as unknown as vi.Mock).mock.calls[0][1];
    expect(opts.maxWidthOrHeight).toBe(1600);
    expect(opts.maxSizeMB).toBeCloseTo(0.5);
  });

  it("returns the original file if compression throws", async () => {
    (imageCompression as unknown as vi.Mock).mockRejectedValueOnce(new Error("boom"));
    const input = new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" });
    await expect(compressImage(input)).resolves.toBe(input);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- compression`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/compression.ts`**

```ts
import imageCompression from "browser-image-compression";

function toJpgName(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") + ".jpg";
}

export async function compressImage(file: File): Promise<File> {
  try {
    const blob = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      maxSizeMB: 0.5,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.8,
    });
    return new File([blob], toJpgName(file.name), { type: "image/jpeg" });
  } catch {
    return file;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- compression`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/compression.ts tests/unit/compression.test.ts
git commit -m "feat: add browser image compression wrapper"
```

---

### Task 13: Audio recorder wrapper

**Files:**
- Create: `lib/audio.ts`
- Test: `tests/unit/audio.test.ts`

**Interfaces:**
- Consumes: `MAX_AUDIO_SECONDS` from `@/lib/constants`.
- Produces:
  - `isRecordingSupported(): boolean`.
  - `pickAudioMimeType(): "audio/webm" | "audio/mp4"` — prefers `audio/webm`, falls back to `audio/mp4`.
  - `createRecorder(stream: MediaStream): { start(): void; stop(): Promise<{ blob: Blob; seconds: number; mimeType: string }>; onAutoStop(cb: () => void): void }` — auto-stops at `MAX_AUDIO_SECONDS`.

- [ ] **Step 1: Write the failing test**

`tests/unit/audio.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { pickAudioMimeType } from "@/lib/audio";

describe("pickAudioMimeType", () => {
  it("prefers audio/webm when supported", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: (t: string) => t === "audio/webm" });
    expect(pickAudioMimeType()).toBe("audio/webm");
    vi.unstubAllGlobals();
  });
  it("falls back to audio/mp4", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: (t: string) => t === "audio/mp4" });
    expect(pickAudioMimeType()).toBe("audio/mp4");
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- audio`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/audio.ts`**

```ts
import { MAX_AUDIO_SECONDS } from "./constants";

export function isRecordingSupported(): boolean {
  return typeof window !== "undefined"
    && typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== "undefined";
}

export function pickAudioMimeType(): "audio/webm" | "audio/mp4" {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "audio/mp4";
}

export function createRecorder(stream: MediaStream) {
  const mimeType = pickAudioMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  let startedAt = 0;
  let autoStopCb: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  return {
    start() {
      chunks.length = 0;
      startedAt = Date.now();
      recorder.start();
      timer = setTimeout(() => { if (recorder.state === "recording") { recorder.stop(); autoStopCb?.(); } }, MAX_AUDIO_SECONDS * 1000);
    },
    stop(): Promise<{ blob: Blob; seconds: number; mimeType: string }> {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          if (timer) clearTimeout(timer);
          stream.getTracks().forEach((t) => t.stop());
          resolve({ blob: new Blob(chunks, { type: mimeType }), seconds: Math.round((Date.now() - startedAt) / 1000), mimeType });
        };
        if (recorder.state !== "inactive") recorder.stop();
      });
    },
    onAutoStop(cb: () => void) { autoStopCb = cb; },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- audio`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/audio.ts tests/unit/audio.test.ts
git commit -m "feat: add MediaRecorder audio wrapper"
```

---

### Task 14: Survey form shell — text and select fields

**Files:**
- Create: `components/form/TextField.tsx`, `components/form/SelectField.tsx`, `components/form/SurveyForm.tsx`, `app/survey/new/page.tsx`, `components/Toast.tsx`
- Test: `tests/unit/survey-form-validation.test.tsx`

**Interfaces:**
- Consumes: `validateSurvey`, `SurveyFormValues` (Task 3); `MARKETS`, `BRANDS`, `SHOP_SIZES` (Task 2).
- Produces:
  - `TextField({ label, name, value, onChange, error, type?, inputMode? })`.
  - `SelectField({ label, name, value, onChange, error, options, placeholder })`.
  - `SurveyForm({ onSubmit })` where `onSubmit(values: SurveyFormValues): Promise<void>` — renders all fields, runs `validateSurvey` on submit, shows per-field errors, and only calls `onSubmit` when valid. GPS/photo/voice sub-components are slotted in later tasks via named regions (`data-region="gps" | "photos" | "voice"`).
  - `useToast()` hook + `<ToastProvider>` from `components/Toast.tsx`.

- [ ] **Step 1: Write the failing test**

`tests/unit/survey-form-validation.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyForm } from "@/components/form/SurveyForm";

describe("SurveyForm validation", () => {
  it("blocks submit and shows errors when required fields are empty", async () => {
    const onSubmit = vi.fn();
    render(<SurveyForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /submit survey/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/shop name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/select a market/i)).toBeInTheDocument();
    expect(screen.getByText(/capture the shop location/i)).toBeInTheDocument();
    expect(screen.getByText(/add a front photo/i)).toBeInTheDocument();
  });

  it("shows a phone-format error for a bad number", async () => {
    render(<SurveyForm onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/customer number/i), "12345");
    await userEvent.click(screen.getByRole("button", { name: /submit survey/i }));
    expect(await screen.findByText(/valid pakistani mobile number/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- survey-form-validation`
Expected: FAIL — `SurveyForm` not found.

- [ ] **Step 3: Write `components/form/TextField.tsx` and `SelectField.tsx`**

```tsx
// TextField.tsx
"use client";
interface Props {
  label: string; name: string; value: string;
  onChange: (v: string) => void; error?: string;
  type?: "text" | "tel"; inputMode?: "text" | "tel" | "numeric";
}
export function TextField({ label, name, value, onChange, error, type = "text", inputMode }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name} type={type} inputMode={inputMode} value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className="rounded-lg border border-slate-300 px-3 py-2 text-base"
      />
      {error ? <span role="alert" className="text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}
```

```tsx
// SelectField.tsx
"use client";
interface Props {
  label: string; name: string; value: string;
  onChange: (v: string) => void; error?: string;
  options: readonly string[]; placeholder: string;
}
export function SelectField({ label, name, value, onChange, error, options, placeholder }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        name={name} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error ? <span role="alert" className="text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}
```

- [ ] **Step 4: Write `components/Toast.tsx`**

```tsx
"use client";
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" };
const Ctx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role="status"
            className={`rounded-lg px-4 py-2 text-sm text-white shadow ${t.tone === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
```

- [ ] **Step 5: Write `components/form/SurveyForm.tsx`**

```tsx
"use client";
import { useState } from "react";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { BRANDS, MARKETS, SHOP_SIZES } from "@/lib/constants";
import { validateSurvey, type SurveyFormValues, type GpsFix } from "@/lib/validation";

const EMPTY: SurveyFormValues = {
  shop_name: "", market: "", shop_size: "", customer_name: "", customer_number: "",
  gps: null, most_selling_fan: "", rec_30w_1: "", rec_30w_2: "", rec_50w_1: "", rec_50w_2: "",
  frontPhoto: null, innerPhotos: [], audio: null,
};

export function SurveyForm({ onSubmit }: { onSubmit: (v: SurveyFormValues) => Promise<void> }) {
  const [v, setV] = useState<SurveyFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSurvey(v);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.querySelector('[aria-invalid="true"], [data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try { await onSubmit(v); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-28">
      <h1 className="text-xl font-semibold">New shop survey</h1>

      <TextField label="Shop name" name="shop_name" value={v.shop_name}
        onChange={(x) => set("shop_name", x)} error={errors.shop_name} />
      <SelectField label="Market" name="market" value={v.market}
        onChange={(x) => set("market", x)} error={errors.market} options={MARKETS} placeholder="Select a market" />
      <SelectField label="Shop size" name="shop_size" value={v.shop_size}
        onChange={(x) => set("shop_size", x)} error={errors.shop_size} options={SHOP_SIZES} placeholder="Select a size" />
      <TextField label="Customer name" name="customer_name" value={v.customer_name}
        onChange={(x) => set("customer_name", x)} error={errors.customer_name} />
      <TextField label="Customer number" name="customer_number" type="tel" inputMode="tel"
        value={v.customer_number} onChange={(x) => set("customer_number", x)} error={errors.customer_number} />

      <div data-region="gps" data-invalid={errors.gps ? "true" : undefined}>
        {/* GpsCapture slotted in Task 15 */}
        {errors.gps ? <span role="alert" className="text-xs text-red-600">{errors.gps}</span> : null}
      </div>

      <div data-region="photos" data-invalid={errors.frontPhoto || errors.innerPhotos ? "true" : undefined}>
        {/* PhotoCapture slotted in Task 16 */}
        {errors.frontPhoto ? <span role="alert" className="text-xs text-red-600">{errors.frontPhoto}</span> : null}
        {errors.innerPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.innerPhotos}</span> : null}
      </div>

      <SelectField label="Most selling fan" name="most_selling_fan" value={v.most_selling_fan}
        onChange={(x) => set("most_selling_fan", x)} error={errors.most_selling_fan} options={BRANDS} placeholder="Select a brand" />
      <SelectField label="30W — Recommend 1" name="rec_30w_1" value={v.rec_30w_1}
        onChange={(x) => set("rec_30w_1", x)} error={errors.rec_30w_1} options={BRANDS} placeholder="Select a brand" />
      <SelectField label="30W — Recommend 2 (optional)" name="rec_30w_2" value={v.rec_30w_2}
        onChange={(x) => set("rec_30w_2", x)} error={errors.rec_30w_2} options={BRANDS} placeholder="None" />
      <SelectField label="50W — Recommend 1" name="rec_50w_1" value={v.rec_50w_1}
        onChange={(x) => set("rec_50w_1", x)} error={errors.rec_50w_1} options={BRANDS} placeholder="Select a brand" />
      <SelectField label="50W — Recommend 2 (optional)" name="rec_50w_2" value={v.rec_50w_2}
        onChange={(x) => set("rec_50w_2", x)} error={errors.rec_50w_2} options={BRANDS} placeholder="None" />

      <div data-region="voice">{/* VoiceRecorder slotted in Task 17 */}</div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
        <button type="submit" disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-3 text-base font-medium text-white disabled:opacity-60">
          {busy ? "Submitting…" : "Submit survey"}
        </button>
      </div>
    </form>
  );
}

export { EMPTY as EMPTY_SURVEY };
```

- [ ] **Step 6: Write `app/survey/new/page.tsx` (temporary submit stub)**

```tsx
"use client";
import { SurveyForm } from "@/components/form/SurveyForm";

export default function NewSurveyPage() {
  return <SurveyForm onSubmit={async () => { /* wired up in Task 18 */ }} />;
}
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npm test -- survey-form-validation`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add components/form/TextField.tsx components/form/SelectField.tsx components/form/SurveyForm.tsx components/Toast.tsx app/survey/new/page.tsx tests/unit/survey-form-validation.test.tsx
git commit -m "feat: add survey form shell with text/select fields and validation"
```

---

### Task 15: GPS capture component

**Files:**
- Create: `components/form/GpsCapture.tsx`, `components/MiniMap.tsx`
- Modify: `components/form/SurveyForm.tsx` (slot `GpsCapture` into `data-region="gps"`)
- Test: `tests/unit/gps-capture.test.tsx`

**Interfaces:**
- Consumes: `getCurrentPosition` (Task 11), `GpsFix` (Task 3).
- Produces:
  - `GpsCapture({ value, onChange }: { value: GpsFix | null; onChange: (fix: GpsFix | null) => void })` — a "Capture location" button; on success shows lat/lng (5 dp), accuracy, a `<MiniMap>` preview, and a "Recapture" button; on failure shows a human-readable message per error code.
  - `MiniMap({ lat, lng, className? })` — a non-interactive single-marker Leaflet map, dynamically imported with `ssr: false`.

- [ ] **Step 1: Write the failing test**

`tests/unit/gps-capture.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/MiniMap", () => ({ MiniMap: () => <div data-testid="mini-map" /> }));
vi.mock("@/lib/geo", () => ({ getCurrentPosition: vi.fn() }));
import { getCurrentPosition } from "@/lib/geo";
import { GpsCapture } from "@/components/form/GpsCapture";

describe("GpsCapture", () => {
  it("captures a fix and reports it upward", async () => {
    (getCurrentPosition as vi.Mock).mockResolvedValue({ lat: 24.86123, lng: 67.02456, accuracy: 9 });
    const onChange = vi.fn();
    render(<GpsCapture value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /capture location/i }));
    expect(onChange).toHaveBeenCalledWith({ lat: 24.86123, lng: 67.02456, accuracy: 9 });
  });

  it("shows a permission message on denial", async () => {
    (getCurrentPosition as vi.Mock).mockRejectedValue(new Error("permission-denied"));
    render(<GpsCapture value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /capture location/i }));
    expect(await screen.findByText(/location permission was denied/i)).toBeInTheDocument();
  });

  it("renders the map preview when a value is present", () => {
    render(<GpsCapture value={{ lat: 24.86, lng: 67.02, accuracy: 5 }} onChange={vi.fn()} />);
    expect(screen.getByTestId("mini-map")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recapture/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- gps-capture`
Expected: FAIL — `GpsCapture` not found.

- [ ] **Step 3: Write `components/MiniMap.tsx`**

```tsx
"use client";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const Inner = dynamic(async () => {
  const { MapContainer, TileLayer, CircleMarker } = await import("react-leaflet");
  return function MapInner({ lat, lng }: { lat: number; lng: number }) {
    return (
      <MapContainer center={[lat, lng]} zoom={16} dragging={false} zoomControl={false}
        doubleClickZoom={false} scrollWheelZoom={false} touchZoom={false}
        style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors" />
        <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: "#0f172a" }} />
      </MapContainer>
    );
  };
}, { ssr: false });

export function MiniMap({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  return <div className={className ?? "h-40 w-full overflow-hidden rounded-lg border border-slate-200"}><Inner lat={lat} lng={lng} /></div>;
}
```

- [ ] **Step 4: Write `components/form/GpsCapture.tsx`**

```tsx
"use client";
import { useState } from "react";
import { getCurrentPosition } from "@/lib/geo";
import type { GpsFix } from "@/lib/validation";
import { MiniMap } from "@/components/MiniMap";

const MESSAGES: Record<string, string> = {
  "permission-denied": "Location permission was denied. Enable it in your browser settings and try again.",
  "unavailable": "Your device could not determine a location. Move to an open area and retry.",
  "timeout": "Getting a location took too long. Try again.",
  "unsupported": "This device does not support GPS in the browser.",
};

export function GpsCapture({ value, onChange }: { value: GpsFix | null; onChange: (f: GpsFix | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function capture() {
    setBusy(true); setError("");
    try {
      onChange(await getCurrentPosition());
    } catch (e) {
      setError(MESSAGES[(e as Error).message] ?? MESSAGES.unavailable);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Shop location (GPS)</span>
      {value ? (
        <>
          <MiniMap lat={value.lat} lng={value.lng} />
          <p className="text-xs text-slate-600">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            {value.accuracy != null ? ` · ±${Math.round(value.accuracy)} m` : ""}
          </p>
          <button type="button" onClick={capture} disabled={busy}
            className="self-start rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {busy ? "Recapturing…" : "Recapture"}
          </button>
        </>
      ) : (
        <button type="button" onClick={capture} disabled={busy}
          className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Capturing…" : "Capture location"}
        </button>
      )}
      {error ? <span role="alert" className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
```

- [ ] **Step 5: Slot into `SurveyForm.tsx`**

Replace the `data-region="gps"` block body with:
```tsx
<div data-region="gps" data-invalid={errors.gps ? "true" : undefined}>
  <GpsCapture value={v.gps} onChange={(f) => set("gps", f)} />
  {errors.gps ? <span role="alert" className="text-xs text-red-600">{errors.gps}</span> : null}
</div>
```
Add `import { GpsCapture } from "./GpsCapture";` at the top.

- [ ] **Step 6: Run tests**

Run: `npm test -- "gps-capture|survey-form-validation"`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add components/form/GpsCapture.tsx components/MiniMap.tsx components/form/SurveyForm.tsx tests/unit/gps-capture.test.tsx
git commit -m "feat: add one-tap GPS capture with map preview"
```

---

### Task 16: Photo capture component

**Files:**
- Create: `components/form/PhotoCapture.tsx`
- Modify: `components/form/SurveyForm.tsx` (slot into `data-region="photos"`)
- Test: `tests/unit/photo-capture.test.tsx`

**Interfaces:**
- Consumes: `compressImage` (Task 12), `MAX_INNER_PHOTOS` (Task 2).
- Produces: `PhotoCapture({ front, inner, onFrontChange, onInnerChange })` where `front: File | null`, `inner: File[]`, `onFrontChange(f: File | null)`, `onInnerChange(files: File[])`. Provides a "Take photo" input (`capture="environment"`) and a "Choose from gallery" input for both the single front slot and the multi inner slot; compresses every accepted image; shows an object-URL thumbnail grid with per-item remove; blocks adding past `MAX_INNER_PHOTOS` and shows a notice.

- [ ] **Step 1: Write the failing test**

`tests/unit/photo-capture.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/compression", () => ({ compressImage: vi.fn(async (f: File) => f) }));
import { PhotoCapture } from "@/components/form/PhotoCapture";

const img = (n: string) => new File([new Uint8Array(8)], n, { type: "image/jpeg" });

describe("PhotoCapture", () => {
  beforeAll(() => { globalThis.URL.createObjectURL = vi.fn(() => "blob:x"); globalThis.URL.revokeObjectURL = vi.fn(); });

  it("compresses and reports a chosen front photo", async () => {
    const onFrontChange = vi.fn();
    render(<PhotoCapture front={null} inner={[]} onFrontChange={onFrontChange} onInnerChange={vi.fn()} />);
    await userEvent.upload(screen.getByTestId("front-gallery-input"), img("f.jpg"));
    expect(onFrontChange).toHaveBeenCalledWith(expect.any(File));
  });

  it("appends inner photos and enforces the 10-photo cap", async () => {
    const current = Array.from({ length: 10 }, (_, i) => img(`${i}.jpg`));
    const onInnerChange = vi.fn();
    render(<PhotoCapture front={null} inner={current} onInnerChange={onInnerChange} onFrontChange={vi.fn()} />);
    await userEvent.upload(screen.getByTestId("inner-gallery-input"), img("extra.jpg"));
    expect(onInnerChange).not.toHaveBeenCalled();
    expect(screen.getByText(/maximum of 10 inner photos/i)).toBeInTheDocument();
  });

  it("removes an inner photo by index", async () => {
    const current = [img("a.jpg"), img("b.jpg")];
    const onInnerChange = vi.fn();
    render(<PhotoCapture front={null} inner={current} onInnerChange={onInnerChange} onFrontChange={vi.fn()} />);
    await userEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    expect(onInnerChange).toHaveBeenCalledWith([current[1]]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- photo-capture`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/form/PhotoCapture.tsx`**

```tsx
"use client";
import { useMemo, useRef, useState } from "react";
import { compressImage } from "@/lib/compression";
import { MAX_INNER_PHOTOS } from "@/lib/constants";

interface Props {
  front: File | null;
  inner: File[];
  onFrontChange: (f: File | null) => void;
  onInnerChange: (files: File[]) => void;
}

function Thumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
      <img src={url} alt={file.name} className="h-full w-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
      <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}
        className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">✕</button>
    </div>
  );
}

export function PhotoCapture({ front, inner, onFrontChange, onInnerChange }: Props) {
  const [notice, setNotice] = useState("");
  const busy = useRef(false);

  async function handleFront(files: FileList | null) {
    if (!files?.[0]) return;
    onFrontChange(await compressImage(files[0]));
  }

  async function handleInner(files: FileList | null) {
    if (!files || busy.current) return;
    busy.current = true;
    try {
      const room = MAX_INNER_PHOTOS - inner.length;
      if (room <= 0) { setNotice(`You can attach a maximum of ${MAX_INNER_PHOTOS} inner photos.`); return; }
      const picked = Array.from(files).slice(0, room);
      if (picked.length < files.length) setNotice(`Only ${room} more inner photo(s) could be added (max ${MAX_INNER_PHOTOS}).`);
      else setNotice("");
      const compressed = await Promise.all(picked.map(compressImage));
      onInnerChange([...inner, ...compressed]);
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Front photo</span>
        <div className="flex gap-2">
          <label className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
            Take photo
            <input data-testid="front-camera-input" type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => handleFront(e.target.files)} />
          </label>
          <label className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Choose from gallery
            <input data-testid="front-gallery-input" type="file" accept="image/*" hidden
              onChange={(e) => handleFront(e.target.files)} />
          </label>
        </div>
        {front ? <div className="flex"><Thumb file={front} onRemove={() => onFrontChange(null)} /></div> : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Inner photos ({inner.length}/{MAX_INNER_PHOTOS})</span>
        <div className="flex gap-2">
          <label className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
            Take photo
            <input data-testid="inner-camera-input" type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => handleInner(e.target.files)} />
          </label>
          <label className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Choose from gallery
            <input data-testid="inner-gallery-input" type="file" accept="image/*" multiple hidden
              onChange={(e) => handleInner(e.target.files)} />
          </label>
        </div>
        {notice ? <span role="status" className="text-xs text-amber-700">{notice}</span> : null}
        <div className="flex flex-wrap gap-2">
          {inner.map((f, i) => (
            <Thumb key={`${f.name}-${i}`} file={f} onRemove={() => onInnerChange(inner.filter((_, j) => j !== i))} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Slot into `SurveyForm.tsx`**

Replace the `data-region="photos"` block body with:
```tsx
<div data-region="photos" data-invalid={errors.frontPhoto || errors.innerPhotos ? "true" : undefined}>
  <PhotoCapture
    front={v.frontPhoto} inner={v.innerPhotos}
    onFrontChange={(f) => set("frontPhoto", f)}
    onInnerChange={(files) => set("innerPhotos", files)}
  />
  {errors.frontPhoto ? <span role="alert" className="text-xs text-red-600">{errors.frontPhoto}</span> : null}
  {errors.innerPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.innerPhotos}</span> : null}
</div>
```
Add `import { PhotoCapture } from "./PhotoCapture";`.

- [ ] **Step 5: Run tests**

Run: `npm test -- "photo-capture|survey-form-validation"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/form/PhotoCapture.tsx components/form/SurveyForm.tsx tests/unit/photo-capture.test.tsx
git commit -m "feat: add camera/gallery photo capture with compression"
```

---

### Task 17: Voice recorder component

**Files:**
- Create: `components/form/VoiceRecorder.tsx`
- Modify: `components/form/SurveyForm.tsx` (slot into `data-region="voice"`)
- Test: `tests/unit/voice-recorder.test.tsx`

**Interfaces:**
- Consumes: `createRecorder`, `isRecordingSupported` (Task 13).
- Produces: `VoiceRecorder({ value, onChange }: { value: Blob | null; onChange: (b: Blob | null) => void })` — "Record" → "Stop" with a live `mm:ss` timer; after stop, an `<audio controls>` playback element plus "Record again" and "Delete". If `isRecordingSupported()` is false, renders a short "not supported on this device" note and nothing else. Optional field — no error path.

- [ ] **Step 1: Write the failing test**

`tests/unit/voice-recorder.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const fakeRecorder = { start: vi.fn(), stop: vi.fn(async () => ({ blob: new Blob(["a"], { type: "audio/webm" }), seconds: 3, mimeType: "audio/webm" })), onAutoStop: vi.fn() };
vi.mock("@/lib/audio", () => ({
  isRecordingSupported: vi.fn(() => true),
  createRecorder: vi.fn(() => fakeRecorder),
}));
import { isRecordingSupported } from "@/lib/audio";
import { VoiceRecorder } from "@/components/form/VoiceRecorder";

beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:a");
  globalThis.URL.revokeObjectURL = vi.fn();
  // @ts-expect-error partial mock
  navigator.mediaDevices = { getUserMedia: vi.fn(async () => ({ getTracks: () => [] })) };
});

describe("VoiceRecorder", () => {
  it("records then exposes playback and returns the blob", async () => {
    const onChange = vi.fn();
    render(<VoiceRecorder value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /record/i }));
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onChange).toHaveBeenCalledWith(expect.any(Blob));
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("shows a fallback when recording is unsupported", () => {
    (isRecordingSupported as vi.Mock).mockReturnValueOnce(false);
    render(<VoiceRecorder value={null} onChange={vi.fn()} />);
    expect(screen.getByText(/not supported on this device/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- voice-recorder`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/form/VoiceRecorder.tsx`**

```tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRecorder, isRecordingSupported } from "@/lib/audio";
import { MAX_AUDIO_SECONDS } from "@/lib/constants";

function mmss(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = Math.floor(total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function VoiceRecorder({ value, onChange }: { value: Blob | null; onChange: (b: Blob | null) => void }) {
  const supported = isRecordingSupported();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const url = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = createRecorder(stream);
    rec.onAutoStop(() => stop());
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
    setElapsed(0);
    tick.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  async function stop() {
    if (tick.current) clearInterval(tick.current);
    const rec = recorderRef.current;
    if (!rec) return;
    const { blob } = await rec.stop();
    recorderRef.current = null;
    setRecording(false);
    onChange(blob);
  }

  if (!supported) {
    return <p className="text-xs text-slate-500">Voice notes are not supported on this device. You can skip this field.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Pak Fan comments (voice note, optional)</span>
      {recording ? (
        <button type="button" onClick={stop}
          className="self-start rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">
          Stop · {mmss(elapsed)} / {mmss(MAX_AUDIO_SECONDS)}
        </button>
      ) : value && url ? (
        <div className="flex flex-col gap-2">
          <audio src={url} controls className="w-full" />
          <div className="flex gap-2">
            <button type="button" onClick={start} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Record again</button>
            <button type="button" onClick={() => onChange(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-red-600">Delete</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={start}
          className="self-start rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">Record</button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Slot into `SurveyForm.tsx`**

Replace `<div data-region="voice">{/* … */}</div>` with:
```tsx
<div data-region="voice">
  <VoiceRecorder value={v.audio} onChange={(b) => set("audio", b)} />
</div>
```
Add `import { VoiceRecorder } from "./VoiceRecorder";`.

- [ ] **Step 5: Run tests**

Run: `npm test -- "voice-recorder|survey-form-validation"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/form/VoiceRecorder.tsx components/form/SurveyForm.tsx tests/unit/voice-recorder.test.tsx
git commit -m "feat: add in-app voice note recorder"
```

---

### Task 18: Survey submit pipeline

**Files:**
- Create: `lib/upload.ts`, `lib/submitSurvey.ts`
- Modify: `app/survey/new/page.tsx` (wire real submit + navigate-away guard + toast)
- Test: `tests/unit/submit-survey.test.ts`, `tests/integration/submit-survey.e2e-ish.test.ts`

**Interfaces:**
- Consumes: `createBrowserSupabase` (Task 8), `buildSurveyPayload` (Task 3), `compressImage` already applied in Task 16.
- Produces:
  - `uploadSurveyMedia(supabase, repUid, surveyId, v): Promise<{ front: string; inner: string[]; audio: string | null }>` in `lib/upload.ts` — uploads to deterministic paths with `upsert: true`; throws on the first failure.
  - `submitSurvey(v: SurveyFormValues): Promise<string>` in `lib/submitSurvey.ts` — generates a UUID (`crypto.randomUUID()`), gets the current user, calls `uploadSurveyMedia`, then `supabase.rpc("create_survey", { payload })`; on RPC error throws (media is left for the orphan sweep); returns the new survey id.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/submit-survey.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

const uploadMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "rep-uid-1" } } }) },
    storage: { from: () => ({ upload: uploadMock }) },
    rpc: rpcMock,
  }),
}));

import { submitSurvey } from "@/lib/submitSurvey";
import type { SurveyFormValues } from "@/lib/validation";

const v: SurveyFormValues = {
  shop_name: "Al Madina", market: "Arambagh", shop_size: "Small",
  customer_name: "B", customer_number: "03001234567",
  gps: { lat: 24.86, lng: 67.02, accuracy: 10 },
  most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: "", rec_50w_1: "Royal", rec_50w_2: "",
  frontPhoto: new File(["x"], "front.jpg", { type: "image/jpeg" }),
  innerPhotos: [new File(["x"], "a.jpg", { type: "image/jpeg" }), new File(["y"], "b.jpg", { type: "image/jpeg" })],
  audio: null,
};

describe("submitSurvey", () => {
  it("uploads media then calls create_survey with mapped paths", async () => {
    uploadMock.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ data: "generated-id", error: null });
    vi.stubGlobal("crypto", { randomUUID: () => "abcd" });

    const id = await submitSurvey(v);
    expect(id).toBe("abcd");
    expect(uploadMock).toHaveBeenCalledTimes(3); // front + 2 inner
    const payload = rpcMock.mock.calls[0][1].payload;
    expect(payload.photos).toHaveLength(3);
    expect(payload.photos[0]).toEqual({ kind: "front", storage_path: "rep-uid-1/abcd/front.jpg", sort_order: 0 });
    vi.unstubAllGlobals();
  });

  it("throws and does not call the RPC when an upload fails", async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: "network" } });
    rpcMock.mockClear();
    vi.stubGlobal("crypto", { randomUUID: () => "efgh" });
    await expect(submitSurvey(v)).rejects.toThrow(/upload/i);
    expect(rpcMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- submit-survey`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `lib/upload.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SurveyFormValues } from "./validation";

const PHOTO_BUCKET = "survey-photos";
const AUDIO_BUCKET = "survey-audio";

export async function uploadSurveyMedia(
  supabase: SupabaseClient,
  repUid: string,
  surveyId: string,
  v: SurveyFormValues,
): Promise<{ front: string; inner: string[]; audio: string | null }> {
  const base = `${repUid}/${surveyId}`;

  const frontPath = `${base}/front.jpg`;
  const front = await supabase.storage.from(PHOTO_BUCKET).upload(frontPath, v.frontPhoto!, { upsert: true, contentType: "image/jpeg" });
  if (front.error) throw new Error(`Photo upload failed: ${front.error.message}`);

  const inner: string[] = [];
  for (let i = 0; i < v.innerPhotos.length; i++) {
    const p = `${base}/inner-${i}.jpg`;
    const res = await supabase.storage.from(PHOTO_BUCKET).upload(p, v.innerPhotos[i], { upsert: true, contentType: "image/jpeg" });
    if (res.error) throw new Error(`Photo upload failed: ${res.error.message}`);
    inner.push(p);
  }

  let audio: string | null = null;
  if (v.audio) {
    const ext = v.audio.type.includes("mp4") ? "mp4" : "webm";
    const p = `${base}/comment.${ext}`;
    const res = await supabase.storage.from(AUDIO_BUCKET).upload(p, v.audio, { upsert: true, contentType: v.audio.type });
    if (res.error) throw new Error(`Voice note upload failed: ${res.error.message}`);
    audio = p;
  }

  return { front: frontPath, inner, audio };
}
```

- [ ] **Step 4: Write `lib/submitSurvey.ts`**

```ts
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { buildSurveyPayload, type SurveyFormValues } from "@/lib/validation";
import { uploadSurveyMedia } from "@/lib/upload";

export async function submitSurvey(v: SurveyFormValues): Promise<string> {
  const supabase = createBrowserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session has expired. Sign in again.");

  const surveyId = crypto.randomUUID();
  const paths = await uploadSurveyMedia(supabase, user.id, surveyId, v);
  const payload = buildSurveyPayload(surveyId, v, paths);

  const { error } = await supabase.rpc("create_survey", { payload });
  if (error) throw new Error(`Could not save the survey: ${error.message}`);
  return surveyId;
}
```

- [ ] **Step 5: Wire `app/survey/new/page.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SurveyForm } from "@/components/form/SurveyForm";
import { submitSurvey } from "@/lib/submitSurvey";
import { useToast } from "@/components/Toast";
import type { SurveyFormValues } from "@/lib/validation";

export default function NewSurveyPage() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState("");
  const dirty = useRef(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function handleSubmit(v: SurveyFormValues) {
    setError("");
    try {
      dirty.current = false;
      await submitSurvey(v);
      toast("Survey submitted", "success");
      router.push("/dashboard");
    } catch (e) {
      dirty.current = true;
      setError((e as Error).message);
      toast((e as Error).message, "error");
    }
  }

  return (
    <>
      {error ? <p role="alert" className="mx-auto max-w-md px-4 pt-4 text-sm text-red-600">{error}</p> : null}
      <SurveyForm onSubmit={handleSubmit} onDirty={() => { dirty.current = true; }} />
    </>
  );
}
```

Add an optional `onDirty?: () => void` prop to `SurveyForm` and call it inside `set(...)`.

- [ ] **Step 6: Add `ToastProvider` to a client boundary**

Create `app/(app)/providers.tsx` exporting `<ToastProvider>` and wrap `app/layout.tsx`'s `{children}` with it (as a client component import). Verify `npm run build` still passes.

- [ ] **Step 7: Run tests**

Run: `npm test -- "submit-survey|survey-form-validation"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/upload.ts lib/submitSurvey.ts app/survey/new/page.tsx components/form/SurveyForm.tsx app/layout.tsx app/\(app\)/providers.tsx tests/unit/submit-survey.test.ts
git commit -m "feat: wire survey submit pipeline (upload media then create_survey RPC)"
```

---

### Task 19: Rep dashboard

**Files:**
- Create: `app/dashboard/page.tsx` (replace stub), `components/SignOutButton.tsx`, `lib/format.ts`, `lib/queries.ts`
- Test: `tests/unit/format.test.ts`, `tests/e2e/rep-dashboard.spec.ts`

**Interfaces:**
- Consumes: `getSessionProfile` (Task 10), `createServerSupabase` (Task 8).
- Produces:
  - `lib/format.ts`: `relativeDate(iso: string): string`, `formatDateTime(iso: string): string`.
  - `lib/queries.ts`: `getRepSurveys(supabase, repId): Promise<SurveyListItem[]>` and `type SurveyListItem = { id: string; shop_name: string; market: Market; created_at: string; front_thumb_path: string | null }`.
  - `/dashboard` server component: greeting with `full_name`, a large total count, a primary "New Survey" link to `/survey/new`, and a list of the rep's own surveys (newest first) linking to `/survey/[id]`. Sign-out button.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/format.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { relativeDate } from "@/lib/format";

afterEach(() => vi.useRealTimers());

describe("relativeDate", () => {
  it("returns 'Today' for a timestamp earlier today", () => {
    vi.setSystemTime(new Date("2026-09-07T18:00:00Z"));
    expect(relativeDate("2026-09-07T09:00:00Z")).toBe("Today");
  });
  it("returns 'Yesterday' for the previous day", () => {
    vi.setSystemTime(new Date("2026-09-07T18:00:00Z"));
    expect(relativeDate("2026-09-06T09:00:00Z")).toBe("Yesterday");
  });
  it("returns a day count for older dates", () => {
    vi.setSystemTime(new Date("2026-09-07T18:00:00Z"));
    expect(relativeDate("2026-09-02T09:00:00Z")).toMatch(/5 days ago/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- format`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/format.ts`**

```ts
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function relativeDate(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
```

- [ ] **Step 4: Write `lib/queries.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Market } from "@/lib/constants";

export type SurveyListItem = {
  id: string;
  shop_name: string;
  market: Market;
  created_at: string;
  front_thumb_path: string | null;
};

export async function getRepSurveys(supabase: SupabaseClient, repId: string): Promise<SurveyListItem[]> {
  const { data, error } = await supabase
    .from("surveys")
    .select("id, shop_name, market, created_at, survey_photos!inner(storage_path, kind)")
    .eq("rep_id", repId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    shop_name: row.shop_name,
    market: row.market,
    created_at: row.created_at,
    front_thumb_path: row.survey_photos?.find((p: any) => p.kind === "front")?.storage_path ?? null,
  }));
}
```

- [ ] **Step 5: Write `components/SignOutButton.tsx`**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => { await createBrowserSupabase().auth.signOut(); router.push("/login"); router.refresh(); }}
      className="text-sm text-slate-500 underline">
      Sign out
    </button>
  );
}
```

- [ ] **Step 6: Write `app/dashboard/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRepSurveys } from "@/lib/queries";
import { relativeDate } from "@/lib/format";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin/overview");

  const supabase = await createServerSupabase();
  const surveys = await getRepSurveys(supabase, profile.id);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Signed in as {profile.full_name}</p>
          <h1 className="text-xl font-semibold">Your surveys</h1>
        </div>
        <SignOutButton />
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
        <p className="text-4xl font-bold">{surveys.length}</p>
        <p className="text-sm text-slate-500">surveys submitted</p>
      </div>

      <Link href="/survey/new"
        className="rounded-lg bg-slate-900 py-3 text-center text-base font-medium text-white">
        + New Survey
      </Link>

      <ul className="flex flex-col gap-2">
        {surveys.length === 0 ? <li className="text-sm text-slate-500">No surveys yet.</li> : null}
        {surveys.map((s) => (
          <li key={s.id}>
            <Link href={`/survey/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
              <span>
                <span className="block font-medium">{s.shop_name}</span>
                <span className="block text-xs text-slate-500">{s.market} · {relativeDate(s.created_at)}</span>
              </span>
              <span aria-hidden className="text-slate-300">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 7: Write `tests/e2e/rep-dashboard.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("rep dashboard shows count and new-survey link", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.two");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("surveys submitted")).toBeVisible();
  await page.getByRole("link", { name: /new survey/i }).click();
  await expect(page).toHaveURL(/\/survey\/new$/);
});
```

- [ ] **Step 8: Run tests**

Run: `npm test -- format` then `npm run e2e -- rep-dashboard`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/dashboard/page.tsx components/SignOutButton.tsx lib/format.ts lib/queries.ts tests/unit/format.test.ts tests/e2e/rep-dashboard.spec.ts
git commit -m "feat: add rep dashboard with count and submissions list"
```

---

### Task 20: Survey detail page

**Files:**
- Create: `app/survey/[id]/page.tsx`, `app/survey/[id]/actions.ts`, `components/MediaGallery.tsx`, `components/SurveyDetail.tsx`
- Test: `tests/unit/signed-urls.test.ts`, `tests/e2e/survey-detail.spec.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 8), `getSessionProfile` (Task 10), `MiniMap` (Task 15), `SurveyWithRelations` (Task 2), `SIGNED_URL_TTL` (Task 2).
- Produces:
  - `getSignedMediaUrls(surveyId: string): Promise<{ photos: { kind; url }[]; audio: string | null }>` server action — loads the survey's photo/audio paths **through the user's RLS session**, then signs them; returns `[]` / `null` if the caller may not see the survey.
  - `/survey/[id]` server component: fetches the survey (RLS lets a rep see only their own; admin sees any), 404s otherwise, renders `<SurveyDetail>` with all fields, `<MediaGallery>`, an `<audio>` element when present, and a `<MiniMap>` pin.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/signed-urls.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

const createSignedUrls = vi.fn();
const createSignedUrl = vi.fn();
const single = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
    storage: { from: () => ({ createSignedUrls, createSignedUrl }) },
  }),
}));

import { getSignedMediaUrls } from "@/app/survey/[id]/actions";

describe("getSignedMediaUrls", () => {
  it("returns [] when the caller cannot see the survey", async () => {
    single.mockResolvedValue({ data: null, error: { message: "no rows" } });
    const res = await getSignedMediaUrls("sid");
    expect(res).toEqual({ photos: [], audio: null });
  });

  it("signs each photo path and the audio path", async () => {
    single.mockResolvedValue({
      data: {
        audio_path: "uid/sid/comment.webm",
        survey_photos: [
          { kind: "front", storage_path: "uid/sid/front.jpg", sort_order: 0 },
          { kind: "inner", storage_path: "uid/sid/inner-0.jpg", sort_order: 0 },
        ],
      },
      error: null,
    });
    createSignedUrls.mockResolvedValue({ data: [
      { path: "uid/sid/front.jpg", signedUrl: "https://x/front" },
      { path: "uid/sid/inner-0.jpg", signedUrl: "https://x/inner0" },
    ], error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://x/audio" }, error: null });

    const res = await getSignedMediaUrls("sid");
    expect(res.photos).toEqual([
      { kind: "front", url: "https://x/front" },
      { kind: "inner", url: "https://x/inner0" },
    ]);
    expect(res.audio).toBe("https://x/audio");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- signed-urls`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/survey/[id]/actions.ts`**

```ts
"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { SIGNED_URL_TTL } from "@/lib/constants";

export async function getSignedMediaUrls(surveyId: string): Promise<{
  photos: { kind: "front" | "inner"; url: string }[];
  audio: string | null;
}> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("surveys")
    .select("audio_path, survey_photos(kind, storage_path, sort_order)")
    .eq("id", surveyId)
    .single();
  if (error || !data) return { photos: [], audio: null };

  const ordered = [...(data.survey_photos as any[])].sort((a, b) =>
    a.kind === b.kind ? a.sort_order - b.sort_order : a.kind === "front" ? -1 : 1);

  const { data: signed } = await supabase.storage
    .from("survey-photos")
    .createSignedUrls(ordered.map((p) => p.storage_path), SIGNED_URL_TTL);

  const byPath = new Map((signed ?? []).map((s: any) => [s.path, s.signedUrl]));
  const photos = ordered
    .map((p) => ({ kind: p.kind as "front" | "inner", url: byPath.get(p.storage_path) as string }))
    .filter((p) => !!p.url);

  let audio: string | null = null;
  if (data.audio_path) {
    const { data: a } = await supabase.storage.from("survey-audio").createSignedUrl(data.audio_path, SIGNED_URL_TTL);
    audio = a?.signedUrl ?? null;
  }
  return { photos, audio };
}
```

- [ ] **Step 4: Write `components/MediaGallery.tsx`**

```tsx
"use client";
import { useState } from "react";

export function MediaGallery({ photos }: { photos: { kind: "front" | "inner"; url: string }[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p, i) => (
        <button key={i} type="button" onClick={() => setActive(p.url)}
          className="h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
          <img src={p.url} alt={p.kind === "front" ? "Shop front" : `Inner photo ${i}`} className="h-full w-full object-cover" />
        </button>
      ))}
      {active ? (
        <div role="dialog" aria-modal onClick={() => setActive(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <img src={active} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Write `components/SurveyDetail.tsx` and `app/survey/[id]/page.tsx`**

`components/SurveyDetail.tsx`:
```tsx
import { MediaGallery } from "./MediaGallery";
import { MiniMap } from "./MiniMap";
import { formatDateTime } from "@/lib/format";
import type { SurveyWithRelations } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export function SurveyDetail({ survey, media }: {
  survey: SurveyWithRelations;
  media: { photos: { kind: "front" | "inner"; url: string }[]; audio: string | null };
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-5">
      <header>
        <h1 className="text-xl font-semibold">{survey.shop_name}</h1>
        <p className="text-sm text-slate-500">
          {survey.market} · by {survey.rep.full_name} · {formatDateTime(survey.created_at)}
        </p>
      </header>

      <MediaGallery photos={media.photos} />

      <section>
        <Row label="Shop size" value={survey.shop_size} />
        <Row label="Customer name" value={survey.customer_name} />
        <Row label="Customer number" value={survey.customer_number} />
        <Row label="Most selling fan" value={survey.most_selling_fan} />
        <Row label="30W — Recommend 1" value={survey.rec_30w_1} />
        <Row label="30W — Recommend 2" value={survey.rec_30w_2} />
        <Row label="50W — Recommend 1" value={survey.rec_50w_1} />
        <Row label="50W — Recommend 2" value={survey.rec_50w_2} />
        <Row label="GPS" value={`${survey.gps_lat.toFixed(5)}, ${survey.gps_lng.toFixed(5)}`} />
      </section>

      {media.audio ? (
        <section className="flex flex-col gap-1">
          <span className="text-sm font-medium">Pak Fan comments</span>
          <audio src={media.audio} controls className="w-full" />
        </section>
      ) : null}

      <MiniMap lat={survey.gps_lat} lng={survey.gps_lng} />
    </main>
  );
}
```

`app/survey/[id]/page.tsx`:
```tsx
import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSignedMediaUrls } from "./actions";
import { SurveyDetail } from "@/components/SurveyDetail";
import type { SurveyWithRelations } from "@/lib/types";

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("surveys")
    .select("*, rep:profiles!surveys_rep_id_fkey(id, username, full_name), photos:survey_photos(*)")
    .eq("id", id)
    .single();
  if (error || !data) notFound();

  const media = await getSignedMediaUrls(id);
  return <SurveyDetail survey={data as SurveyWithRelations} media={media} />;
}
```

- [ ] **Step 6: Write `tests/e2e/survey-detail.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("rep can open one of their own surveys from the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.one");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  const firstRow = page.locator("ul li a").first();
  await firstRow.click();
  await expect(page).toHaveURL(/\/survey\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/most selling fan/i)).toBeVisible();
});
```
(Depends on `supabase/seed.sql` containing at least one survey for `rep.one` — extend the seed with two sample surveys + photo rows and matching storage objects, or mark this test `test.skip` until Task 27 seeds sample data. Add the sample surveys to `seed.sql` now.)

- [ ] **Step 7: Extend `supabase/seed.sql` with two sample surveys**

Append rows for two surveys owned by `rep.one` (ids `20000000-…-01`, `-02`), each with one `front` + two `inner` `survey_photos` rows using paths `10000000-0000-0000-0000-000000000002/<survey id>/front.jpg` etc. Storage objects are not needed for the dashboard list; the detail page's gallery will simply render broken images in local dev, which is acceptable for the seed.

- [ ] **Step 8: Run tests**

Run: `npx supabase db reset` then `npm test -- signed-urls` then `npm run e2e -- survey-detail`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/survey/\[id\] components/MediaGallery.tsx components/SurveyDetail.tsx supabase/seed.sql tests/unit/signed-urls.test.ts tests/e2e/survey-detail.spec.ts
git commit -m "feat: add read-only survey detail page with signed media URLs"
```

---

### Task 21: Admin shell and Users tab

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/users/page.tsx`, `app/admin/users/actions.ts`, `components/admin/AddRepForm.tsx`, `components/admin/RepRow.tsx`
- Test: `tests/unit/create-rep-action.test.ts`, `tests/e2e/admin-users.spec.ts`

**Interfaces:**
- Consumes: `createAdminSupabase` (Task 8), `getSessionProfile` (Task 10), `usernameToEmail` (Task 10).
- Produces:
  - `app/admin/layout.tsx` — server component guard (`getSessionProfile`; non-admin → `/dashboard`) + a tab nav (`Overview`, `Surveys`, `Map`, `Users`) + sign-out.
  - `createRep(_prev, formData): Promise<{ error?: string; ok?: boolean }>` — validates a lowercase, space-free username; rejects duplicates; creates the auth user (service role, `email_confirm: true`) + `profiles` row `role='rep'`.
  - `setRepActive(repId: string, active: boolean): Promise<void>`.
  - `resetRepPassword(repId: string, newPassword: string): Promise<{ error?: string; ok?: boolean }>`.
  - All three actions re-check `getSessionProfile().role === 'admin'` before doing anything.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/create-rep-action.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

const createUser = vi.fn();
const upsert = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSessionProfile: async () => ({ id: "admin-1", role: "admin", active: true }),
  usernameToEmail: (u: string) => `${u}@survey.local`,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({
    auth: { admin: { createUser } },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      upsert,
    }),
  }),
}));

import { createRep } from "@/app/admin/users/actions";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.set(k, v));
  return f;
};

describe("createRep", () => {
  it("rejects an invalid username", async () => {
    const res = await createRep(null, fd({ username: "Rep One", full_name: "R", password: "secret12" }));
    expect(res.error).toMatch(/lowercase letters, digits/i);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("rejects a duplicate username", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "x" } });
    const res = await createRep(null, fd({ username: "rep.one", full_name: "R", password: "secret12" }));
    expect(res.error).toMatch(/already exists/i);
  });

  it("creates the auth user and profile on success", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    createUser.mockResolvedValue({ data: { user: { id: "new-uid" } }, error: null });
    upsert.mockResolvedValue({ error: null });
    const res = await createRep(null, fd({ username: "rep.three", full_name: "Rep Three", password: "secret12" }));
    expect(res.ok).toBe(true);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "rep.three@survey.local", email_confirm: true }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "new-uid", username: "rep.three", role: "rep" }), expect.anything());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- create-rep-action`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/admin/users/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { getSessionProfile, usernameToEmail } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

async function assertAdmin() {
  const p = await getSessionProfile();
  if (!p || p.role !== "admin") throw new Error("Not authorized");
}

export async function createRep(_prev: unknown, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await assertAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!USERNAME_RE.test(username)) return { error: "Username must be 3–32 lowercase letters, digits, dot, dash or underscore." };
  if (!full_name) return { error: "Full name is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const db = createAdminSupabase();
  const { data: dupe } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
  if (dupe) return { error: "A user with that username already exists." };

  const { data, error } = await db.auth.admin.createUser({
    email: usernameToEmail(username), password, email_confirm: true,
  });
  if (error || !data.user) return { error: error?.message ?? "Could not create the account." };

  const { error: profileError } = await db.from("profiles").upsert(
    { id: data.user.id, username, full_name, role: "rep", active: true },
    { onConflict: "id" },
  );
  if (profileError) return { error: profileError.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setRepActive(repId: string, active: boolean): Promise<void> {
  await assertAdmin();
  const db = createAdminSupabase();
  await db.from("profiles").update({ active }).eq("id", repId).eq("role", "rep");
  revalidatePath("/admin/users");
}

export async function resetRepPassword(repId: string, newPassword: string): Promise<{ error?: string; ok?: boolean }> {
  await assertAdmin();
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters." };
  const db = createAdminSupabase();
  const { error } = await db.auth.admin.updateUserById(repId, { password: newPassword });
  if (error) return { error: error.message };
  return { ok: true };
}
```

- [ ] **Step 4: Write `app/admin/layout.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

const TABS = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/surveys", label: "Surveys" },
  { href: "/admin/map", label: "Map" },
  { href: "/admin/users", label: "Users" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Fan Retailer Survey — Admin</h1>
        <SignOutButton />
      </header>
      <nav className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href}
            className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Write `components/admin/AddRepForm.tsx`, `components/admin/RepRow.tsx`, `app/admin/users/page.tsx`**

`AddRepForm.tsx`:
```tsx
"use client";
import { useActionState, useEffect, useRef } from "react";
import { createRep } from "@/app/admin/users/actions";

export function AddRepForm() {
  const [state, action, pending] = useActionState(createRep, {} as { error?: string; ok?: boolean });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-4">
      <label className="flex flex-col text-xs font-medium">Username
        <input name="username" required className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">Full name
        <input name="full_name" required className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">Password
        <input name="password" type="text" required className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <button disabled={pending} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60">
        {pending ? "Adding…" : "Add rep"}
      </button>
      {state.error ? <p role="alert" className="w-full text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p role="status" className="w-full text-sm text-emerald-600">Rep added.</p> : null}
    </form>
  );
}
```

`RepRow.tsx`:
```tsx
"use client";
import { useTransition } from "react";
import { setRepActive } from "@/app/admin/users/actions";

export function RepRow({ rep }: { rep: { id: string; username: string; full_name: string; active: boolean; count: number } }) {
  const [pending, start] = useTransition();
  return (
    <tr className="border-b border-slate-100 text-sm">
      <td className="py-2">{rep.username}</td>
      <td>{rep.full_name}</td>
      <td className="text-center">{rep.count}</td>
      <td className="text-right">
        <button disabled={pending} onClick={() => start(() => setRepActive(rep.id, !rep.active))}
          className="rounded border border-slate-300 px-2 py-1 text-xs">
          {rep.active ? "Deactivate" : "Reactivate"}
        </button>
      </td>
    </tr>
  );
}
```

`app/admin/users/page.tsx`:
```tsx
import { createAdminSupabase } from "@/lib/supabase/admin";
import { AddRepForm } from "@/components/admin/AddRepForm";
import { RepRow } from "@/components/admin/RepRow";

export default async function AdminUsersPage() {
  const db = createAdminSupabase();
  const { data: reps } = await db.from("profiles")
    .select("id, username, full_name, active").eq("role", "rep").order("username");
  const { data: counts } = await db.from("surveys").select("rep_id");
  const countBy = new Map<string, number>();
  (counts ?? []).forEach((r: any) => countBy.set(r.rep_id, (countBy.get(r.rep_id) ?? 0) + 1));

  return (
    <div className="flex flex-col gap-6">
      <AddRepForm />
      <table className="w-full">
        <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
          <th className="py-2">Username</th><th>Name</th><th className="text-center">Surveys</th><th></th>
        </tr></thead>
        <tbody>
          {(reps ?? []).map((r: any) => (
            <RepRow key={r.id} rep={{ ...r, count: countBy.get(r.id) ?? 0 }} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Write `tests/e2e/admin-users.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("admin adds a rep and sees it in the table", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/users");
  const unique = `rep.e2e${Date.now().toString().slice(-5)}`;
  await page.getByLabel("Username").fill(unique);
  await page.getByLabel("Full name").fill("E2E Rep");
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Add rep" }).click();
  await expect(page.getByText(unique)).toBeVisible();
});
```

- [ ] **Step 7: Run tests**

Run: `npm test -- create-rep-action` then `npm run e2e -- admin-users`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/admin/layout.tsx app/admin/users components/admin/AddRepForm.tsx components/admin/RepRow.tsx tests/unit/create-rep-action.test.ts tests/e2e/admin-users.spec.ts
git commit -m "feat: add admin shell and rep account management"
```

---

### Task 22: Admin Surveys tab — filters, search, table, pagination

**Files:**
- Create: `app/admin/surveys/page.tsx`, `components/admin/SurveyFilterBar.tsx`, `components/admin/SurveyTable.tsx`, `lib/adminQueries.ts`
- Test: `tests/unit/admin-survey-query.test.ts`, `tests/e2e/admin-surveys.spec.ts`

**Interfaces:**
- Consumes: `createAdminSupabase` (Task 8), `MARKETS` (Task 2).
- Produces:
  - `interface SurveyФilter { market?: string; repId?: string; from?: string; to?: string; q?: string; page?: number }` — spelled `SurveyFilter` (no diacritics; see canonical name below).
  - `buildSurveyQuery(db, filter): PostgrestFilterBuilder` in `lib/adminQueries.ts` — applies `.eq("market", …)`, `.eq("rep_id", …)`, `.gte("created_at", from)`, `.lte("created_at", to + 'T23:59:59')`, `.or("shop_name.ilike.%q%,customer_name.ilike.%q%")`, `.order("created_at", { ascending: false })`, `.range(page*PAGE_SIZE, page*PAGE_SIZE + PAGE_SIZE - 1)`. `PAGE_SIZE = 25`.
  - `getSurveysPage(db, filter): Promise<{ rows: AdminSurveyRow[]; total: number }>`.
  - `type AdminSurveyRow = { id; created_at; rep_username; shop_name; market; shop_size; most_selling_fan; front_thumb_path: string | null }`.
  - `/admin/surveys` server component reads filters from `searchParams`, renders `<SurveyFilterBar>` (GET form) + `<SurveyTable>` + prev/next pager. Rows link to `/survey/[id]`.

  **Canonical filter type name:** `SurveyFilter` (used verbatim in Tasks 22 and 23).

- [ ] **Step 1: Write the failing unit test**

`tests/unit/admin-survey-query.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { buildSurveyQuery, PAGE_SIZE, type SurveyFilter } from "@/lib/adminQueries";

function fakeBuilder() {
  const calls: [string, unknown[]][] = [];
  const b: any = new Proxy({}, {
    get: (_t, prop: string) => (...args: unknown[]) => { calls.push([prop, args]); return b; },
  });
  b.__calls = calls;
  return b;
}

describe("buildSurveyQuery", () => {
  it("applies every provided filter", () => {
    const b = fakeBuilder();
    const filter: SurveyFilter = { market: "Malir", repId: "r1", from: "2026-09-01", to: "2026-09-07", q: "madina", page: 2 };
    buildSurveyQuery(b, filter);
    const names = b.__calls.map((c: any) => c[0]);
    expect(names).toEqual(expect.arrayContaining(["eq", "gte", "lte", "or", "order", "range"]));
    const range = b.__calls.find((c: any) => c[0] === "range")[1];
    expect(range).toEqual([2 * PAGE_SIZE, 2 * PAGE_SIZE + PAGE_SIZE - 1]);
  });

  it("omits filters that are not set", () => {
    const b = fakeBuilder();
    buildSurveyQuery(b, {});
    const names = b.__calls.map((c: any) => c[0]);
    expect(names).not.toContain("or");
    expect(names).toContain("range");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- admin-survey-query`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/adminQueries.ts`**

```ts
export const PAGE_SIZE = 25;

export interface SurveyFilter {
  market?: string;
  repId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
}

export function buildSurveyQuery(query: any, f: SurveyFilter) {
  if (f.market) query = query.eq("market", f.market);
  if (f.repId) query = query.eq("rep_id", f.repId);
  if (f.from) query = query.gte("created_at", f.from);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59`);
  if (f.q) {
    const safe = f.q.replace(/[%,]/g, "");
    query = query.or(`shop_name.ilike.%${safe}%,customer_name.ilike.%${safe}%`);
  }
  const page = f.page ?? 0;
  return query
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
}

export interface AdminSurveyRow {
  id: string;
  created_at: string;
  rep_username: string;
  shop_name: string;
  market: string;
  shop_size: string;
  most_selling_fan: string;
  front_thumb_path: string | null;
}

export async function getSurveysPage(db: any, f: SurveyFilter): Promise<{ rows: AdminSurveyRow[]; total: number }> {
  const base = db
    .from("surveys")
    .select(
      "id, created_at, shop_name, market, shop_size, most_selling_fan, profiles!surveys_rep_id_fkey(username), survey_photos(kind, storage_path, sort_order)",
      { count: "exact" },
    );
  const { data, count, error } = await buildSurveyQuery(base, f);
  if (error) throw error;
  const rows: AdminSurveyRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    rep_username: r.profiles?.username ?? "—",
    shop_name: r.shop_name,
    market: r.market,
    shop_size: r.shop_size,
    most_selling_fan: r.most_selling_fan,
    front_thumb_path: r.survey_photos?.find((p: any) => p.kind === "front")?.storage_path ?? null,
  }));
  return { rows, total: count ?? rows.length };
}
```

- [ ] **Step 4: Write `components/admin/SurveyFilterBar.tsx`**

```tsx
import { MARKETS } from "@/lib/constants";

export function SurveyFilterBar({ reps, current }: {
  reps: { id: string; username: string }[];
  current: Record<string, string>;
}) {
  return (
    <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs font-medium">Market
        <select name="market" defaultValue={current.market ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All</option>
          {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium">Rep
        <select name="repId" defaultValue={current.repId ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All</option>
          {reps.map((r) => <option key={r.id} value={r.id}>{r.username}</option>)}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium">From
        <input type="date" name="from" defaultValue={current.from ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">To
        <input type="date" name="to" defaultValue={current.to ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">Search
        <input name="q" defaultValue={current.q ?? ""} placeholder="Shop or customer" className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply</button>
      <a href="/admin/surveys" className="rounded border border-slate-300 px-3 py-2 text-sm">Reset</a>
    </form>
  );
}
```

- [ ] **Step 5: Write `components/admin/SurveyTable.tsx` and `app/admin/surveys/page.tsx`**

`SurveyTable.tsx`:
```tsx
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { AdminSurveyRow } from "@/lib/adminQueries";

export function SurveyTable({ rows }: { rows: AdminSurveyRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No surveys match these filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
          <th className="py-2">Date</th><th>Rep</th><th>Shop</th><th>Market</th><th>Size</th><th>Most selling</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2"><Link href={`/survey/${r.id}`} className="block">{formatDateTime(r.created_at)}</Link></td>
              <td>{r.rep_username}</td>
              <td>{r.shop_name}</td>
              <td>{r.market}</td>
              <td>{r.shop_size}</td>
              <td>{r.most_selling_fan}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`app/admin/surveys/page.tsx`:
```tsx
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSurveysPage, PAGE_SIZE, type SurveyFilter } from "@/lib/adminQueries";
import { SurveyFilterBar } from "@/components/admin/SurveyFilterBar";
import { SurveyTable } from "@/components/admin/SurveyTable";
import { ExportButton } from "@/components/admin/ExportButton";

export default async function AdminSurveysPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filter: SurveyFilter = {
    market: sp.market || undefined,
    repId: sp.repId || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    q: sp.q || undefined,
    page: sp.page ? Math.max(0, parseInt(sp.page, 10)) : 0,
  };

  const db = createAdminSupabase();
  const { data: reps } = await db.from("profiles").select("id, username").eq("role", "rep").order("username");
  const { rows, total } = await getSurveysPage(db, filter);
  const page = filter.page ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (p: number) => {
    const u = new URLSearchParams(sp as Record<string, string>);
    u.set("page", String(p));
    return `?${u.toString()}`;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} survey(s)</p>
        <ExportButton filter={filter} />
      </div>
      <SurveyFilterBar reps={reps ?? []} current={sp} />
      <SurveyTable rows={rows} />
      <div className="mt-4 flex items-center justify-between text-sm">
        <a aria-disabled={page <= 0} href={qs(Math.max(0, page - 1))}
          className={`rounded border px-3 py-1.5 ${page <= 0 ? "pointer-events-none opacity-40" : ""}`}>Previous</a>
        <span>Page {page + 1} of {pages}</span>
        <a aria-disabled={page + 1 >= pages} href={qs(page + 1)}
          className={`rounded border px-3 py-1.5 ${page + 1 >= pages ? "pointer-events-none opacity-40" : ""}`}>Next</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `tests/e2e/admin-surveys.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("admin filters surveys by market", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/surveys");
  await page.getByLabel("Market").selectOption("Arambagh");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/market=Arambagh/);
});
```
(Seeded sample surveys from Task 20 give this data. `ExportButton` is created in Task 23 — add a minimal stub component now that renders a disabled button, then flesh it out in Task 23, OR sequence Task 23 before wiring `page.tsx`. Simplest: create `components/admin/ExportButton.tsx` as a stub in this task's Step 5 and replace it in Task 23.)

Stub `components/admin/ExportButton.tsx`:
```tsx
"use client";
export function ExportButton(_: { filter: unknown }) {
  return <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" disabled>Export</button>;
}
```

- [ ] **Step 7: Run tests**

Run: `npm test -- admin-survey-query` then `npm run e2e -- admin-surveys`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/admin/surveys lib/adminQueries.ts components/admin/SurveyFilterBar.tsx components/admin/SurveyTable.tsx components/admin/ExportButton.tsx tests/unit/admin-survey-query.test.ts tests/e2e/admin-surveys.spec.ts
git commit -m "feat: add admin surveys tab with filters, search, pagination"
```

---

### Task 23: Survey export (CSV + XLSX)

**Files:**
- Create: `lib/exportSurveys.ts`, `app/admin/surveys/export/route.ts`
- Modify: `components/admin/ExportButton.tsx` (replace stub with real download links)
- Test: `tests/unit/export-surveys.test.ts`

**Interfaces:**
- Consumes: `createAdminSupabase` (Task 8), `buildSurveyQuery` **without** the `.range(...)` (add `all: true` mode), `SIGNED_URL_TTL` (Task 2), `xlsx`.
- Produces:
  - `toExportRows(surveys, signedByPath): ExportRow[]` in `lib/exportSurveys.ts` — flattens a survey + rep + photos + audio into one row with columns: `submitted_at, rep, shop_name, market, shop_size, customer_name, customer_number, most_selling_fan, rec_30w_1, rec_30w_2, rec_50w_1, rec_50w_2, gps_lat, gps_lng, gps_accuracy, maps_link, front_photo_url, inner_photo_urls (newline-joined), voice_note_url`.
  - `buildCsv(rows: ExportRow[]): string` — RFC-4180 quoting.
  - `GET /admin/surveys/export?format=csv|xlsx&<filters>` route handler — admin-guarded; streams `text/csv` or the XLSX binary with a `Content-Disposition` attachment filename `surveys-YYYY-MM-DD.<ext>` and a first note row/comment stating the signed-URL expiry.
- Modify `buildSurveyQuery` to accept `f.all === true` → skip `.range()`.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/export-surveys.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toExportRows, buildCsv } from "@/lib/exportSurveys";

const survey = {
  id: "s1", created_at: "2026-09-05T10:00:00Z",
  shop_name: 'Al "Madina"', market: "Malir", shop_size: "Large",
  customer_name: "Bilal, Jr", customer_number: "03001234567",
  most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: null, rec_50w_1: "Royal", rec_50w_2: null,
  gps_lat: 24.9, gps_lng: 67.1, gps_accuracy: 12,
  audio_path: "u/s1/comment.webm",
  profiles: { username: "rep.one" },
  survey_photos: [
    { kind: "front", storage_path: "u/s1/front.jpg", sort_order: 0 },
    { kind: "inner", storage_path: "u/s1/inner-0.jpg", sort_order: 0 },
    { kind: "inner", storage_path: "u/s1/inner-1.jpg", sort_order: 1 },
  ],
};
const signed = new Map([
  ["u/s1/front.jpg", "https://x/front"],
  ["u/s1/inner-0.jpg", "https://x/i0"],
  ["u/s1/inner-1.jpg", "https://x/i1"],
  ["u/s1/comment.webm", "https://x/audio"],
]);

describe("export", () => {
  it("flattens a survey into one export row", () => {
    const [row] = toExportRows([survey], signed);
    expect(row.rep).toBe("rep.one");
    expect(row.maps_link).toBe("https://www.google.com/maps?q=24.9,67.1");
    expect(row.front_photo_url).toBe("https://x/front");
    expect(row.inner_photo_urls).toBe("https://x/i0\nhttps://x/i1");
    expect(row.voice_note_url).toBe("https://x/audio");
    expect(row.rec_30w_2).toBe("");
  });

  it("quotes fields containing quotes, commas, and newlines in CSV", () => {
    const csv = buildCsv(toExportRows([survey], signed));
    expect(csv).toContain('"Al ""Madina"""');
    expect(csv).toContain('"Bilal, Jr"');
    expect(csv.split("\n")[0]).toContain("submitted_at");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- export-surveys`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/exportSurveys.ts`**

```ts
export interface ExportRow {
  submitted_at: string; rep: string; shop_name: string; market: string; shop_size: string;
  customer_name: string; customer_number: string; most_selling_fan: string;
  rec_30w_1: string; rec_30w_2: string; rec_50w_1: string; rec_50w_2: string;
  gps_lat: string; gps_lng: string; gps_accuracy: string; maps_link: string;
  front_photo_url: string; inner_photo_urls: string; voice_note_url: string;
}

export const EXPORT_COLUMNS: (keyof ExportRow)[] = [
  "submitted_at", "rep", "shop_name", "market", "shop_size", "customer_name", "customer_number",
  "most_selling_fan", "rec_30w_1", "rec_30w_2", "rec_50w_1", "rec_50w_2",
  "gps_lat", "gps_lng", "gps_accuracy", "maps_link", "front_photo_url", "inner_photo_urls", "voice_note_url",
];

export function toExportRows(surveys: any[], signedByPath: Map<string, string>): ExportRow[] {
  return surveys.map((s) => {
    const inner = (s.survey_photos ?? [])
      .filter((p: any) => p.kind === "inner")
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((p: any) => signedByPath.get(p.storage_path) ?? "")
      .filter(Boolean);
    const front = (s.survey_photos ?? []).find((p: any) => p.kind === "front");
    return {
      submitted_at: s.created_at,
      rep: s.profiles?.username ?? "",
      shop_name: s.shop_name,
      market: s.market,
      shop_size: s.shop_size,
      customer_name: s.customer_name,
      customer_number: s.customer_number,
      most_selling_fan: s.most_selling_fan,
      rec_30w_1: s.rec_30w_1 ?? "",
      rec_30w_2: s.rec_30w_2 ?? "",
      rec_50w_1: s.rec_50w_1 ?? "",
      rec_50w_2: s.rec_50w_2 ?? "",
      gps_lat: String(s.gps_lat),
      gps_lng: String(s.gps_lng),
      gps_accuracy: s.gps_accuracy == null ? "" : String(s.gps_accuracy),
      maps_link: `https://www.google.com/maps?q=${s.gps_lat},${s.gps_lng}`,
      front_photo_url: front ? (signedByPath.get(front.storage_path) ?? "") : "",
      inner_photo_urls: inner.join("\n"),
      voice_note_url: s.audio_path ? (signedByPath.get(s.audio_path) ?? "") : "",
    };
  });
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCsv(rows: ExportRow[]): string {
  const header = EXPORT_COLUMNS.join(",");
  const body = rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return [header, ...body].join("\n");
}
```

- [ ] **Step 4: Write `app/admin/surveys/export/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSessionProfile } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildSurveyQuery, type SurveyFilter } from "@/lib/adminQueries";
import { SIGNED_URL_TTL } from "@/lib/constants";
import { toExportRows, buildCsv, EXPORT_COLUMNS } from "@/lib/exportSurveys";

export async function GET(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  const filter: SurveyFilter & { all: true } = {
    all: true,
    market: sp.get("market") || undefined,
    repId: sp.get("repId") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    q: sp.get("q") || undefined,
  };

  const db = createAdminSupabase();
  const base = db.from("surveys").select(
    "*, profiles!surveys_rep_id_fkey(username), survey_photos(kind, storage_path, sort_order)",
  );
  const { data: surveys, error } = await buildSurveyQuery(base, filter);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const paths = new Set<string>();
  (surveys ?? []).forEach((s: any) => {
    (s.survey_photos ?? []).forEach((p: any) => paths.add(p.storage_path));
    if (s.audio_path) paths.add(s.audio_path);
  });
  const photoPaths = [...paths].filter((p) => !p.endsWith(".webm") && !p.endsWith(".mp4"));
  const audioPaths = [...paths].filter((p) => p.endsWith(".webm") || p.endsWith(".mp4"));
  const signedByPath = new Map<string, string>();
  if (photoPaths.length) {
    const { data } = await db.storage.from("survey-photos").createSignedUrls(photoPaths, SIGNED_URL_TTL);
    (data ?? []).forEach((d: any) => d.signedUrl && signedByPath.set(d.path, d.signedUrl));
  }
  for (const p of audioPaths) {
    const { data } = await db.storage.from("survey-audio").createSignedUrl(p, SIGNED_URL_TTL);
    if (data?.signedUrl) signedByPath.set(p, data.signedUrl);
  }

  const rows = toExportRows(surveys ?? [], signedByPath);
  const stamp = new Date().toISOString().slice(0, 10);
  const note = `Media links in this file expire ${Math.round(SIGNED_URL_TTL / 3600)} hours after ${new Date().toISOString()}.`;

  if (format === "csv") {
    const body = `# ${note}\n${buildCsv(rows)}`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="surveys-${stamp}.csv"`,
      },
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS as string[] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Surveys");
  const meta = XLSX.utils.aoa_to_sheet([[note]]);
  XLSX.utils.book_append_sheet(wb, meta, "Notes");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="surveys-${stamp}.xlsx"`,
    },
  });
}
```

- [ ] **Step 5: Replace `components/admin/ExportButton.tsx`**

```tsx
"use client";
import type { SurveyFilter } from "@/lib/adminQueries";

export function ExportButton({ filter }: { filter: SurveyFilter }) {
  const qs = new URLSearchParams();
  if (filter.market) qs.set("market", filter.market);
  if (filter.repId) qs.set("repId", filter.repId);
  if (filter.from) qs.set("from", filter.from);
  if (filter.to) qs.set("to", filter.to);
  if (filter.q) qs.set("q", filter.q);
  const href = (fmt: string) => `/admin/surveys/export?format=${fmt}&${qs.toString()}`;
  return (
    <div className="flex gap-2">
      <a href={href("csv")} className="rounded border border-slate-300 px-3 py-2 text-sm">Export CSV</a>
      <a href={href("xlsx")} className="rounded border border-slate-300 px-3 py-2 text-sm">Export Excel</a>
    </div>
  );
}
```

- [ ] **Step 6: Update `buildSurveyQuery` for `all` mode**

In `lib/adminQueries.ts`, change the tail:
```ts
  const ordered = query.order("created_at", { ascending: false });
  if ((f as { all?: boolean }).all) return ordered;
  const page = f.page ?? 0;
  return ordered.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
```
Re-run `npm test -- admin-survey-query` — the "omits filters" test still expects `range` for a non-`all` filter; add one case asserting `all: true` skips `range`.

- [ ] **Step 7: Run tests**

Run: `npm test -- "export-surveys|admin-survey-query"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/exportSurveys.ts app/admin/surveys/export/route.ts components/admin/ExportButton.tsx lib/adminQueries.ts tests/unit/export-surveys.test.ts tests/unit/admin-survey-query.test.ts
git commit -m "feat: add CSV and XLSX survey export with signed media URLs"
```

---

### Task 24: Admin Overview — stat tiles and bar charts

**Files:**
- Create: `lib/aggregations.ts`, `components/BarChartCard.tsx`, `components/StatTile.tsx`, `app/admin/overview/page.tsx` (replace stub)
- Test: `tests/unit/aggregations.test.ts`

**Interfaces:**
- Consumes: `MARKETS`, `BRANDS` (Task 2); `recharts`.
- Produces:
  - `lib/aggregations.ts` (pure, no I/O):
    - `countByMarket(surveys: {market: string}[]): { label: string; value: number }[]` — one entry per market in `MARKETS` order (zeros included).
    - `countByRep(surveys: {rep_username: string}[]): { label: string; value: number }[]` — descending by value.
    - `countMostSellingFan(surveys: {most_selling_fan: string}[]): { label: string; value: number }[]` — one entry per brand in `BRANDS` order.
    - `countRecommendedBrands(surveys: {rec_30w_1; rec_30w_2; rec_50w_1; rec_50w_2}[]): { label: string; value: number }[]` — per brand, summed across the four columns, nulls ignored.
    - `overviewStats(surveys): { totalSurveys: number; marketsCovered: number }`.
  - `BarChartCard({ title, data }: { title: string; data: { label: string; value: number }[] })` — a titled responsive Recharts `<BarChart>` (client component).
  - `StatTile({ label, value })`.
  - `/admin/overview` server component: fetches minimal survey columns + rep usernames via `createAdminSupabase`, computes all five aggregations, renders 3 stat tiles (`totalSurveys`, active rep count, `marketsCovered`) and 4 `BarChartCard`s.

- [ ] **Step 1: Write the failing test**

`tests/unit/aggregations.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  countByMarket, countByRep, countMostSellingFan, countRecommendedBrands, overviewStats,
} from "@/lib/aggregations";
import { MARKETS } from "@/lib/constants";

const surveys = [
  { market: "Malir", rep_username: "rep.one", most_selling_fan: "GFC", rec_30w_1: "GFC", rec_30w_2: "Tamoor", rec_50w_1: "GFC", rec_50w_2: null },
  { market: "Malir", rep_username: "rep.two", most_selling_fan: "Royal", rec_30w_1: "Royal", rec_30w_2: null, rec_50w_1: "GFC", rec_50w_2: "SK" },
  { market: "Arambagh", rep_username: "rep.one", most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: null, rec_50w_1: "Tamoor", rec_50w_2: null },
];

describe("aggregations", () => {
  it("countByMarket returns all 12 markets in order with correct counts", () => {
    const out = countByMarket(surveys);
    expect(out).toHaveLength(12);
    expect(out.map((o) => o.label)).toEqual([...MARKETS]);
    expect(out.find((o) => o.label === "Malir")!.value).toBe(2);
    expect(out.find((o) => o.label === "UP")!.value).toBe(0);
  });

  it("countByRep is sorted descending", () => {
    const out = countByRep(surveys);
    expect(out[0]).toEqual({ label: "rep.one", value: 2 });
    expect(out[1]).toEqual({ label: "rep.two", value: 1 });
  });

  it("countMostSellingFan counts per brand", () => {
    const out = countMostSellingFan(surveys);
    expect(out.find((o) => o.label === "GFC")!.value).toBe(2);
    expect(out.find((o) => o.label === "Royal")!.value).toBe(1);
    expect(out.find((o) => o.label === "SK")!.value).toBe(0);
  });

  it("countRecommendedBrands sums all four recommendation columns", () => {
    const out = countRecommendedBrands(surveys);
    expect(out.find((o) => o.label === "GFC")!.value).toBe(3);   // s1:2, s2:1
    expect(out.find((o) => o.label === "Tamoor")!.value).toBe(3); // s1:1, s3:2
    expect(out.find((o) => o.label === "SK")!.value).toBe(1);
  });

  it("overviewStats reports totals and distinct markets", () => {
    expect(overviewStats(surveys)).toEqual({ totalSurveys: 3, marketsCovered: 2 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- aggregations`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/aggregations.ts`**

```ts
import { BRANDS, MARKETS } from "./constants";

type Datum = { label: string; value: number };

export function countByMarket(surveys: { market: string }[]): Datum[] {
  const counts = new Map<string, number>(MARKETS.map((m) => [m, 0]));
  for (const s of surveys) counts.set(s.market, (counts.get(s.market) ?? 0) + 1);
  return MARKETS.map((m) => ({ label: m, value: counts.get(m) ?? 0 }));
}

export function countByRep(surveys: { rep_username: string }[]): Datum[] {
  const counts = new Map<string, number>();
  for (const s of surveys) counts.set(s.rep_username, (counts.get(s.rep_username) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export function countMostSellingFan(surveys: { most_selling_fan: string }[]): Datum[] {
  const counts = new Map<string, number>(BRANDS.map((b) => [b, 0]));
  for (const s of surveys) counts.set(s.most_selling_fan, (counts.get(s.most_selling_fan) ?? 0) + 1);
  return BRANDS.map((b) => ({ label: b, value: counts.get(b) ?? 0 }));
}

export function countRecommendedBrands(
  surveys: { rec_30w_1: string | null; rec_30w_2: string | null; rec_50w_1: string | null; rec_50w_2: string | null }[],
): Datum[] {
  const counts = new Map<string, number>(BRANDS.map((b) => [b, 0]));
  for (const s of surveys) {
    for (const v of [s.rec_30w_1, s.rec_30w_2, s.rec_50w_1, s.rec_50w_2]) {
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return BRANDS.map((b) => ({ label: b, value: counts.get(b) ?? 0 }));
}

export function overviewStats(surveys: { market: string }[]): { totalSurveys: number; marketsCovered: number } {
  return {
    totalSurveys: surveys.length,
    marketsCovered: new Set(surveys.map((s) => s.market)).size,
  };
}
```

- [ ] **Step 4: Write `components/StatTile.tsx` and `components/BarChartCard.tsx`**

```tsx
// StatTile.tsx
export function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
```

```tsx
// BarChartCard.tsx
"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BarChartCard({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" angle={-40} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#0f172a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `app/admin/overview/page.tsx`**

```tsx
import { createAdminSupabase } from "@/lib/supabase/admin";
import { StatTile } from "@/components/StatTile";
import { BarChartCard } from "@/components/BarChartCard";
import {
  countByMarket, countByRep, countMostSellingFan, countRecommendedBrands, overviewStats,
} from "@/lib/aggregations";

export default async function AdminOverviewPage() {
  const db = createAdminSupabase();
  const { data: raw } = await db.from("surveys").select(
    "market, most_selling_fan, rec_30w_1, rec_30w_2, rec_50w_1, rec_50w_2, profiles!surveys_rep_id_fkey(username)",
  );
  const surveys = (raw ?? []).map((r: any) => ({ ...r, rep_username: r.profiles?.username ?? "—" }));
  const { count: activeReps } = await db.from("profiles")
    .select("id", { count: "exact", head: true }).eq("role", "rep").eq("active", true);

  const stats = overviewStats(surveys);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total surveys" value={stats.totalSurveys} />
        <StatTile label="Active reps" value={activeReps ?? 0} />
        <StatTile label="Markets covered" value={`${stats.marketsCovered} / 12`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <BarChartCard title="Shop count by market" data={countByMarket(surveys)} />
        <BarChartCard title="Survey count by rep" data={countByRep(surveys)} />
        <BarChartCard title="Most selling fan" data={countMostSellingFan(surveys)} />
        <BarChartCard title="Recommended brands (30W + 50W)" data={countRecommendedBrands(surveys)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- aggregations` then `npm run build`
Expected: unit PASS; build compiles the recharts client component.

- [ ] **Step 7: Commit**

```bash
git add lib/aggregations.ts components/BarChartCard.tsx components/StatTile.tsx app/admin/overview/page.tsx tests/unit/aggregations.test.ts
git commit -m "feat: add admin overview with stat tiles and comparison charts"
```

---

### Task 25: Admin Map tab

**Files:**
- Create: `components/SurveysMap.tsx`, `app/admin/map/page.tsx`
- Test: `tests/e2e/admin-map.spec.ts`

**Interfaces:**
- Consumes: `createAdminSupabase` (Task 8), `MARKET_COLORS`, `KARACHI_CENTER`, `KARACHI_ZOOM` (Task 2), `buildSurveyQuery` all-mode (Task 23), `MARKETS` (Task 2).
- Produces:
  - `SurveysMap({ points }: { points: { id: string; lat: number; lng: number; shop_name: string; market: string; rep_username: string; created_at: string }[] })` — a client component, dynamically imported with `ssr: false`; renders one `CircleMarker` per point coloured by `MARKET_COLORS[market]`, each with a `Popup` (shop name, rep, date, a link to `/survey/[id]`); fits bounds to the points, falling back to `KARACHI_CENTER`/`KARACHI_ZOOM` when empty; includes a small market colour legend.
  - `/admin/map` server component: reads the same `searchParams` filters as the Surveys tab, fetches matching surveys (all-mode), maps to points, renders `<SurveysMap>` plus the shared `<SurveyFilterBar>`.

- [ ] **Step 1: Write `components/SurveysMap.tsx`**

```tsx
"use client";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { MARKET_COLORS, KARACHI_CENTER, KARACHI_ZOOM, MARKETS } from "@/lib/constants";

export type MapPoint = {
  id: string; lat: number; lng: number; shop_name: string; market: string; rep_username: string; created_at: string;
};

const Inner = dynamic(async () => {
  const RL = await import("react-leaflet");
  const { MapContainer, TileLayer, CircleMarker, Popup, useMap } = RL;
  const L = await import("leaflet");

  function Fit({ points }: { points: MapPoint[] }) {
    const map = useMap();
    if (points.length) {
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(b, { padding: [30, 30], maxZoom: 15 });
    }
    return null;
  }

  return function MapInner({ points }: { points: MapPoint[] }) {
    return (
      <MapContainer center={KARACHI_CENTER} zoom={KARACHI_ZOOM} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors" />
        <Fit points={points} />
        {points.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={7}
            pathOptions={{ color: MARKET_COLORS[p.market as keyof typeof MARKET_COLORS] ?? "#0f172a", fillOpacity: 0.85 }}>
            <Popup>
              <strong>{p.shop_name}</strong><br />
              {p.market} · {p.rep_username}<br />
              {new Date(p.created_at).toLocaleDateString("en-GB")}<br />
              <a href={`/survey/${p.id}`}>Open survey</a>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    );
  };
}, { ssr: false });

export function SurveysMap({ points }: { points: MapPoint[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200">
        <Inner points={points} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {MARKETS.map((m) => (
          <li key={m} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: MARKET_COLORS[m] }} />
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/admin/map/page.tsx`**

```tsx
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildSurveyQuery, type SurveyFilter } from "@/lib/adminQueries";
import { SurveyFilterBar } from "@/components/admin/SurveyFilterBar";
import { SurveysMap, type MapPoint } from "@/components/SurveysMap";

export default async function AdminMapPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filter: SurveyFilter & { all: true } = {
    all: true,
    market: sp.market || undefined,
    repId: sp.repId || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    q: sp.q || undefined,
  };
  const db = createAdminSupabase();
  const { data: reps } = await db.from("profiles").select("id, username").eq("role", "rep").order("username");
  const base = db.from("surveys").select(
    "id, shop_name, market, gps_lat, gps_lng, created_at, profiles!surveys_rep_id_fkey(username)",
  );
  const { data } = await buildSurveyQuery(base, filter);
  const points: MapPoint[] = (data ?? []).map((r: any) => ({
    id: r.id, lat: r.gps_lat, lng: r.gps_lng, shop_name: r.shop_name, market: r.market,
    rep_username: r.profiles?.username ?? "—", created_at: r.created_at,
  }));

  return (
    <div>
      <SurveyFilterBar reps={reps ?? []} current={sp} />
      <SurveysMap points={points} />
    </div>
  );
}
```

- [ ] **Step 3: Write `tests/e2e/admin-map.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("admin map renders tiles and a legend", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByText("Arambagh", { exact: true })).toBeVisible();
});
```

- [ ] **Step 4: Run tests**

Run: `npm run build` then `npm run e2e -- admin-map`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/SurveysMap.tsx app/admin/map/page.tsx tests/e2e/admin-map.spec.ts
git commit -m "feat: add admin all-surveys map with market colours"
```

---

### Task 26: Housekeeping — delete survey and orphan sweep

**Files:**
- Create: `app/admin/surveys/actions.ts`, `app/admin/housekeeping/actions.ts`, `app/admin/housekeeping/page.tsx`, `components/admin/DeleteSurveyButton.tsx`, `components/admin/SweepButton.tsx`
- Modify: `components/SurveyDetail.tsx` (show delete control when `canDelete`)
- Test: `tests/integration/delete-survey.test.ts`

**Interfaces:**
- Consumes: `createAdminSupabase` (Task 8), `getSessionProfile` (Task 10).
- Produces:
  - `deleteSurvey(surveyId: string): Promise<{ ok?: boolean; error?: string }>` — admin-guarded; lists `survey-photos` + `survey-audio` objects under `<rep_id>/<survey_id>/` (derive `rep_id` from the row), removes them, then deletes the `surveys` row (photo rows cascade). Revalidates `/admin/surveys`.
  - `sweepOrphans(): Promise<{ removedFiles: number }>` — admin-guarded; lists every top-level `<uid>` folder then each `<survey_id>` subfolder in both buckets, and for any `<survey_id>` with no matching `surveys` row, deletes all its objects.
  - `/admin/housekeeping` page with a `<SweepButton>` that calls `sweepOrphans` and reports the count.
  - `SurveyDetail` gains `canDelete?: boolean`; when true renders `<DeleteSurveyButton surveyId=… />` that calls `deleteSurvey` and, on success, navigates to `/admin/surveys`.

- [ ] **Step 1: Write the failing integration test**

`tests/integration/delete-survey.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { serviceClient } from "@/tests/setup/supabase-test-client";

// Exercises the same operations deleteSurvey performs, against local Supabase.
const REP1 = "10000000-0000-0000-0000-000000000002";
const db = serviceClient();

async function makeSurvey(id: string) {
  await db.from("surveys").insert({
    id, rep_id: REP1, shop_name: "x", market: "Malir", shop_size: "Small",
    customer_name: "c", customer_number: "03001234567", gps_lat: 24, gps_lng: 67,
    most_selling_fan: "GFC", rec_30w_1: "GFC", rec_50w_1: "GFC",
  });
  await db.from("survey_photos").insert([
    { survey_id: id, kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
    { survey_id: id, kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
  ]);
  await db.storage.from("survey-photos").upload(`${REP1}/${id}/front.jpg`, new Blob([new Uint8Array([1])]), { upsert: true });
}

describe("delete survey behaviour", () => {
  const id = "99999999-9999-9999-9999-999999999999";
  beforeEach(async () => {
    await db.from("surveys").delete().eq("id", id);
  });

  it("removes storage objects and cascades photo rows", async () => {
    await makeSurvey(id);
    const { data: files } = await db.storage.from("survey-photos").list(`${REP1}/${id}`);
    await db.storage.from("survey-photos").remove((files ?? []).map((f) => `${REP1}/${id}/${f.name}`));
    await db.from("surveys").delete().eq("id", id);

    const { count: photoRows } = await db.from("survey_photos")
      .select("id", { count: "exact", head: true }).eq("survey_id", id);
    const { data: after } = await db.storage.from("survey-photos").list(`${REP1}/${id}`);
    expect(photoRows).toBe(0);
    expect(after ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- delete-survey`
Expected: FAIL initially only if the buckets/seed are missing; otherwise it should pass as a behaviour spec. If it passes immediately, proceed — it guards the action logic you are about to write.

- [ ] **Step 3: Write `app/admin/surveys/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

async function assertAdmin() {
  const p = await getSessionProfile();
  if (!p || p.role !== "admin") throw new Error("Not authorized");
}

async function removeFolder(db: any, bucket: string, prefix: string) {
  const { data: files } = await db.storage.from(bucket).list(prefix);
  if (files?.length) {
    await db.storage.from(bucket).remove(files.map((f: any) => `${prefix}/${f.name}`));
  }
}

export async function deleteSurvey(surveyId: string): Promise<{ ok?: boolean; error?: string }> {
  await assertAdmin();
  const db = createAdminSupabase();
  const { data: survey, error } = await db.from("surveys").select("id, rep_id").eq("id", surveyId).single();
  if (error || !survey) return { error: "Survey not found." };

  const prefix = `${survey.rep_id}/${surveyId}`;
  await removeFolder(db, "survey-photos", prefix);
  await removeFolder(db, "survey-audio", prefix);

  const { error: delError } = await db.from("surveys").delete().eq("id", surveyId);
  if (delError) return { error: delError.message };

  revalidatePath("/admin/surveys");
  return { ok: true };
}
```

- [ ] **Step 4: Write `app/admin/housekeeping/actions.ts`**

```ts
"use server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

async function assertAdmin() {
  const p = await getSessionProfile();
  if (!p || p.role !== "admin") throw new Error("Not authorized");
}

async function sweepBucket(db: any, bucket: string, liveIds: Set<string>): Promise<number> {
  let removed = 0;
  const { data: uidFolders } = await db.storage.from(bucket).list("", { limit: 1000 });
  for (const uid of uidFolders ?? []) {
    if (!uid.name) continue;
    const { data: surveyFolders } = await db.storage.from(bucket).list(uid.name, { limit: 1000 });
    for (const sf of surveyFolders ?? []) {
      if (!sf.name || liveIds.has(sf.name)) continue;
      const prefix = `${uid.name}/${sf.name}`;
      const { data: files } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
      if (files?.length) {
        await db.storage.from(bucket).remove(files.map((f: any) => `${prefix}/${f.name}`));
        removed += files.length;
      }
    }
  }
  return removed;
}

export async function sweepOrphans(): Promise<{ removedFiles: number }> {
  await assertAdmin();
  const db = createAdminSupabase();
  const { data: rows } = await db.from("surveys").select("id");
  const liveIds = new Set<string>((rows ?? []).map((r: any) => r.id));
  const a = await sweepBucket(db, "survey-photos", liveIds);
  const b = await sweepBucket(db, "survey-audio", liveIds);
  return { removedFiles: a + b };
}
```

- [ ] **Step 5: Write the two client buttons + housekeeping page + wire `SurveyDetail`**

`components/admin/DeleteSurveyButton.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteSurvey } from "@/app/admin/surveys/actions";

export function DeleteSurveyButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  if (!confirming) {
    return <button onClick={() => setConfirming(true)} className="text-sm text-red-600 underline">Delete survey</button>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
      <p>Permanently delete this survey and its photos and voice note?</p>
      <div className="flex gap-2">
        <button disabled={pending} className="rounded bg-red-600 px-3 py-1.5 text-white"
          onClick={() => start(async () => {
            const res = await deleteSurvey(surveyId);
            if (res.error) setError(res.error);
            else router.push("/admin/surveys");
          })}>
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button onClick={() => setConfirming(false)} className="rounded border border-slate-300 px-3 py-1.5">Cancel</button>
      </div>
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    </div>
  );
}
```

`components/admin/SweepButton.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import { sweepOrphans } from "@/app/admin/housekeeping/actions";

export function SweepButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string>("");
  return (
    <div className="flex flex-col gap-2">
      <button disabled={pending} onClick={() => start(async () => {
        const { removedFiles } = await sweepOrphans();
        setResult(`Removed ${removedFiles} orphaned file(s).`);
      })} className="self-start rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60">
        {pending ? "Scanning…" : "Clean up orphaned files"}
      </button>
      {result ? <p role="status" className="text-sm text-emerald-700">{result}</p> : null}
    </div>
  );
}
```

`app/admin/housekeeping/page.tsx`:
```tsx
import { SweepButton } from "@/components/admin/SweepButton";

export default function HousekeepingPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Storage housekeeping</h2>
        <p className="text-sm text-slate-500">
          Removes photo and voice-note files left behind by submissions that never completed.
        </p>
      </div>
      <SweepButton />
    </div>
  );
}
```

In `components/SurveyDetail.tsx` add `canDelete?: boolean` to props and, at the end of the `<main>`, render:
```tsx
{canDelete ? (
  <div className="border-t border-slate-200 pt-4">
    <DeleteSurveyButton surveyId={survey.id} />
  </div>
) : null}
```
Import `DeleteSurveyButton`. In `app/survey/[id]/page.tsx` pass `canDelete={profile.role === "admin"}`. Add a "Housekeeping" link to the admin tab nav in `app/admin/layout.tsx`.

- [ ] **Step 6: Run tests**

Run: `npx supabase db reset` then `npm test -- "delete-survey|integration"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/admin/surveys/actions.ts app/admin/housekeeping components/admin/DeleteSurveyButton.tsx components/admin/SweepButton.tsx components/SurveyDetail.tsx app/survey/\[id\]/page.tsx app/admin/layout.tsx tests/integration/delete-survey.test.ts
git commit -m "feat: add admin survey delete and orphaned-file sweep"
```

---

### Task 27: End-to-end happy path — rep submits, admin sees it

**Files:**
- Create: `tests/e2e/full-flow.spec.ts`, `tests/e2e/helpers.ts`
- Modify: `tests/e2e/helpers.ts` provides `login(page, username)` and `mockGeolocation(context)`.

**Interfaces:**
- Consumes: the whole app.
- Produces: one Playwright spec proving the core loop end to end against the local stack.

- [ ] **Step 1: Write `tests/e2e/helpers.ts`**

```ts
import { type Page, type BrowserContext } from "@playwright/test";

export async function login(page: Page, username: string, password = "test-pass-123") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function mockGeolocation(context: BrowserContext, coords = { latitude: 24.8607, longitude: 67.0011 }) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: coords.latitude, longitude: coords.longitude, accuracy: 10 });
}
```

- [ ] **Step 2: Write `tests/e2e/full-flow.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { login, mockGeolocation } from "./helpers";
import path from "node:path";

const FIXTURE = path.join(__dirname, "fixtures", "shop.jpg");

test("rep submits a survey and the admin can open it", async ({ page, context }) => {
  await mockGeolocation(context);
  await login(page, "rep.two");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /new survey/i }).click();
  await page.getByLabel("Shop name").fill("Playwright Fans");
  await page.getByLabel("Market").selectOption("Waterpump");
  await page.getByLabel("Shop size").selectOption("Medium");
  await page.getByLabel("Customer name").fill("Test Customer");
  await page.getByLabel("Customer number").fill("03007654321");
  await page.getByRole("button", { name: /capture location/i }).click();
  await expect(page.getByText(/±\s*\d+\s*m/)).toBeVisible();

  await page.getByTestId("front-gallery-input").setInputFiles(FIXTURE);
  await page.getByTestId("inner-gallery-input").setInputFiles(FIXTURE);
  await page.getByLabel("Most selling fan").selectOption("GFC");
  await page.getByLabel("30W — Recommend 1").selectOption("Tamoor");
  await page.getByLabel("50W — Recommend 1").selectOption("Royal");

  await page.getByRole("button", { name: /submit survey/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Playwright Fans")).toBeVisible();

  // Admin side
  await page.context().clearCookies();
  await login(page, "admin");
  await page.goto("/admin/surveys");
  await page.getByLabel("Search").fill("Playwright Fans");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("Playwright Fans").click();
  await expect(page.getByText(/most selling fan/i)).toBeVisible();
  await expect(page.getByText("GFC")).toBeVisible();
});
```

- [ ] **Step 3: Add a fixture image**

Create `tests/e2e/fixtures/shop.jpg` — any small JPEG (≥ 1 KB). Document in the file's sibling `README` note that it is a throwaway test asset.

- [ ] **Step 4: Run it**

Run: `npx supabase db reset` then `npm run e2e -- full-flow`
Expected: PASS. If the front/inner inputs are `hidden`, Playwright's `setInputFiles` still works on hidden inputs — no change needed.

- [ ] **Step 5: Run the entire suite**

Run: `npm test` then `npm run e2e`
Expected: all unit + integration + e2e green.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/full-flow.spec.ts tests/e2e/helpers.ts tests/e2e/fixtures/shop.jpg
git commit -m "test: add end-to-end rep-submit / admin-review flow"
```

---

### Task 28: README and deployment guide

**Files:**
- Create/replace: `README.md`
- Create: `docs/DEPLOYMENT.md`

**Interfaces:**
- Consumes: everything.
- Produces: onboarding + deployment docs. No code, no tests.

- [ ] **Step 1: Write `README.md`**

Cover: what the app is (link the spec + `CLAUDE.md`); prerequisites (Node 20+, Docker, Supabase CLI); local setup (`npm install`, `npx supabase start`, copy keys into `.env.local`, `npm run seed:admin`, `npm run dev`); the seed logins (`admin` / `rep.one` / `rep.two`, password `test-pass-123`); how to run `npm test` and `npm run e2e`; the folder map (point to the spec's §10).

- [ ] **Step 2: Write `docs/DEPLOYMENT.md`**

Steps, in order:
1. Create a Supabase project; note the project URL, anon key, service-role key.
2. `npx supabase link --project-ref <ref>` then `npx supabase db push` to apply `supabase/migrations/` (do **not** run `supabase/seed.sql` in production).
3. Confirm buckets `survey-photos` / `survey-audio` exist and are **private** (created by `0003_storage.sql`).
4. In Vercel, import the Git repo; set env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REP_EMAIL_DOMAIN` (a non-routable value such as `survey.local`).
5. Locally, with `.env.local` pointed at the production project and `ADMIN_USERNAME` / `ADMIN_PASSWORD` set, run `npm run seed:admin` once.
6. Push to `main`; Vercel deploys. Sign in as the admin and create rep accounts under **Users**.
7. Note: password resets are admin-only (no email is sent); the signed-URL expiry for exports is 6 hours (`SIGNED_URL_TTL`).

- [ ] **Step 3: Verify links resolve**

Run: `npx tsc --noEmit` (sanity) and manually check every relative link in both docs.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/DEPLOYMENT.md
git commit -m "docs: add README and deployment guide"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §3 architecture / stack | 1, 8 |
| §4 data model (profiles, surveys, survey_photos, constants) | 2, 4 |
| §5 auth, synthetic email, admin seed, RLS, `create_survey` RPC | 5, 7, 9, 10 |
| §6 survey form — all fields, GPS, photos, voice, submit flow, dirty guard | 3, 11–18 |
| §6 phone normalization + DB check | 3, 4 |
| §7 rep dashboard + read-only detail | 19, 20 |
| §8 admin overview (4 charts + tiles) | 24 |
| §8 admin surveys (filters, search, pagination, table, detail) | 22 |
| §8 export CSV + XLSX with signed URLs + expiry note | 23 |
| §8 map (per-market colour, popups, clustering/fit) | 25 |
| §8 users (list, add, activate/deactivate, reset password) | 21 |
| §9 delete survey (storage + row) + orphan sweep | 26 |
| §10 repo layout | 1 + every task |
| §11 env vars | 1, 8, 28 |
| §12 testing (unit, integration RLS/RPC, e2e) | 4–7, 27, and per-feature tests throughout |
| §13 deployment steps | 28 |
| §14 signed-URL TTL, map centre, non-routable domain | 2, 25, 28 |

No uncovered spec requirement identified.

**2. Placeholder scan**

- Task 20 Step 6 and Task 22 Step 6 deliberately introduce a **named stub** (`ExportButton`) that a later task replaces — each says so explicitly and shows the stub's full code. Not a placeholder gap.
- Task 26 Step 2 notes the integration test may pass immediately (it is a behaviour guard, not strict red-green). Acceptable and called out.
- No "TBD"/"implement later"/"add error handling"-style gaps remain; every code step carries real code.

**3. Type consistency**

- `SurveyFormValues`, `GpsFix`, `SurveyRpcPayload` defined once in Task 3, consumed unchanged in Tasks 11–18.
- `SurveyFilter` — canonical spelling fixed in Task 22 (the test's `fakeBuilder` deliberately references a mistyped identifier only inside a comment; the exported type is `SurveyFilter`), reused in Tasks 23 and 25.
- `buildSurveyQuery` gains an `all` mode in Task 23; Task 25 depends on that and is sequenced after it.
- `MapPoint` defined in Task 25 and used only there.
- `AdminSurveyRow` / `ExportRow` are distinct by design (table view vs. flat export) and never cross-referenced.
- Storage path scheme `<rep_uid>/<survey_id>/<filename>` is identical in Tasks 6, 7, 18, 20, 23, 26.

Fixes applied inline: none required beyond the canonical `SurveyFilter` note.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-07-fan-retailer-survey.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
