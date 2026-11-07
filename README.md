# PixoraaGoods ADHD Budget Planner

**Your Money, Made Simpler.**

A calm, ADHD-friendly budgeting web app (installable PWA) by PixoraaGoods. People type in their own numbers. There's no bank connection and no account, and data is stored only on the user's device. It works offline after the first visit.

> This is a budgeting and organisation tool. It is not financial, tax, legal or medical advice, and it does not diagnose or treat ADHD.

## Features

| Section | What it does |
|---|---|
| Today dashboard | Safe-to-spend, available money, reserved money, income/spending this month, next payday, upcoming bills, budget, savings, debt and goal progress, a daily check-in, and "Your Next Small Step" |
| Getting Started | Setup checklist and an 8-step guided setup (every step skippable, with example values) |
| Monthly Budget | Category limits, progress bars, gentle warnings, planned vs actual, previous months, copy last month, custom categories (add/rename/recolour/delete) |
| Paycheck Planner | Expected vs received paychecks, allocate a paycheck to bills, savings, spending and debt, unallocated money, history |
| Safe-to-Spend | A transparent breakdown: balance → available → minus bills, savings plans and other commitments. Expected income is never counted. It explains what's missing instead of guessing |
| Expenses | Quick add, edit, delete with undo, search, filter by category, payment method and date, category totals, CSV export |
| Income | One-off and recurring income, types, history |
| Bills & Calendar | Month calendar (bills, paydays, savings days, debt minimums), mark paid or unpaid (never automatic), past-due highlighting, in-app reminders |
| Savings Goals | Separate funds, contributions and withdrawals, history. Transfers are never counted as spending |
| Debt Tracker | Balances, APR, minimums, payments and charges, payoff estimates, Snowball/Avalanche explainer (educational) |
| Financial Goals | Goals with milestones, progress and completion |
| Reports | Date range, monthly income vs expenses, spending by category, planned vs actual, savings, debt over time, month-by-month table, annual overview, CSV and print |
| Settings | Currency, date format, light/dark/system theme, budget month start day, pay frequency, dashboard cards, reminders, backup export/import, sample data, reset, privacy, install help |

## Tech stack

- **React 19 + TypeScript**, bundled with **esbuild**
- **Tailwind CSS v4** (compiled by `scripts/build.mjs`)
- **Lucide icons** (via `react-icons/lu`)
- **Charts:** small built-in SVG components (`src/components/charts.tsx`), with no chart library, to keep the app small and fully offline
- **Storage:** IndexedDB in the browser (falls back to localStorage). No backend, no secrets
- **PWA:** web manifest, service worker (`src/sw.template.js`) with a precached app shell and a user-approved update banner
- **Fonts:** Inter (body) and Lora (headings), self-hosted, SIL Open Font License

## Folder structure

```
src/
  main.tsx, App.tsx        app shell, navigation, PWA registration
  lib/                     types, dates, money, calc (all financial maths), store, db (IndexedDB), backup, demo data, actions
  components/              ui (buttons, cards, modals, forms), charts, QuickForms (expense/income/bill/savings)
  pages/                   one file per section
  index.html, styles.css, sw.template.js
public/                    manifest, icons, fonts, theme-init.js
scripts/build.mjs          production build (APP_MODE=demo|customer)
scripts/serve.mjs          local static server
tests/calc.test.ts         calculation unit tests
tests/e2e.mjs              browser tests (Playwright)
docs/                      seller and customer documentation
```

## Run it locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run build          # demo build -> dist/
npm run serve          # http://localhost:4173
```

Customer (clean) build: `npm run build:customer`. It starts empty with guided setup, and has no demo banner.

## Tests

```bash
npm run test:unit                     # 87 calculation tests
npx playwright install chromium       # once
npm run build && npm run serve &      # in another terminal
APP_MODE=customer OUT_DIR=dist-customer node scripts/build.mjs && node scripts/serve.mjs 4174 dist-customer &
node tests/e2e.mjs http://localhost:4173 http://localhost:4174   # 76 browser tests
```

## Deploy to Vercel (via GitHub)

1. Push this repository to GitHub (branch `main`).
2. In Vercel: **Add New… → Project → Import** the repository.
3. Framework preset: **Other**. The build command (`npm run build`) and output directory (`dist`) come from `vercel.json`.
4. Environment variables: none are required. Optionally set `APP_MODE` = `demo` or `customer`.
5. Deploy. Every push to `main` deploys to production. Other branches and pull requests get preview URLs.

**Two deployments are recommended:** one Vercel project with `APP_MODE=demo` (the public demo), and a second project from the same repo with `APP_MODE=customer` (the link buyers receive). Both store data only in each visitor's own browser, so visitors can never see each other's data.

## Environment variables

| Name | Required | Values | Purpose |
|---|---|---|---|
| `APP_MODE` | No | `demo` (default) / `customer` | Demo data and banner vs. a clean customer app |

There are **no API keys or secrets**. Never commit `.env` files or customer backups (both are in `.gitignore`).

## Data, privacy and limitations

- Data lives in the browser's IndexedDB on one device. It **does not sync** between devices or browsers. Users move data with Export/Import backup.
- Clearing site data, private/incognito mode, or uninstalling can delete the data. The app asks the browser for persistent storage and encourages regular backups.
- Reminders are in-app only (no push or email notifications).
- Changing currency changes the display only (no conversion).
- Debt payoff figures are estimates.

## Licence

Source code © PixoraaGoods. All rights reserved (see `LICENSE`). Buyers receive a personal-use licence (see `docs/customer/LICENSE-personal-use.md`).
