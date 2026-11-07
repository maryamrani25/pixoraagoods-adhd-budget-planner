# Progress record

Last updated: 7 Nov 2026

| Phase | Status | Notes |
|---|---|---|
| 1. Setup, architecture, design system | ✅ Done | React 19 + TS, esbuild, Tailwind v4, brand tokens, Lora + Inter (self-hosted), light/dark |
| 2. Navigation, onboarding, Today dashboard | ✅ Done, tested | Sidebar (desktop), bottom bar + More menu (mobile), 8-step skippable setup |
| 3. Budget, Income, Expenses | ✅ Done, tested | |
| 4. Paycheck Planner, Safe-to-Spend | ✅ Done, tested | Expected income never counted; missing info explained |
| 5. Bills & Calendar | ✅ Done, tested | Manual mark paid/unpaid, past-due, in-app reminders |
| 6. Savings, Debt, Financial Goals | ✅ Done, tested | |
| 7. Reports | ✅ Done, tested | Date range, 5 charts, monthly + annual tables, CSV, print |
| 8. Settings, customisation, themes | ✅ Done, tested | |
| 9. Storage & backup | ✅ Done, tested | IndexedDB (no cloud by decision), export/import with validation + undo |
| 10. PWA & offline | ✅ Done, tested in headless Chrome | Real-device install not yet tested |
| 11. Demo data, isolation, reset | ✅ Done, tested | Separate DB names for demo/customer builds |
| 12. GitHub + Vercel | ⏳ Waiting | Needs GitHub access for Claude's app; then Vercel import |
| 13. Testing & security | ✅ 87 unit + 76 browser tests pass | Security headers + CSP in `vercel.json`; no secrets |
| 14. Customer docs & Etsy package | ✅ Drafted | PDF needs the real customer URL |

## Not yet verified
- Real iPhone/iPad (Safari), real Android phone, Firefox, Safari desktop, Edge
- PWA installation on real devices
- Screen-reader use (VoiceOver/TalkBack/NVDA)
- Public Vercel URL (not deployed yet)

## Decisions
- Version 1 is local-only (no Supabase/accounts). It's simpler, more private, and has no running costs.
- Charts are built-in SVG instead of Recharts: smaller, fully offline, and npm installs weren't possible in the build workspace.
- Headings use Lora (an elegant serif, similar role to DM Serif Display), which was available to self-host.
