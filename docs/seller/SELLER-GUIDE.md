# Seller Guide (for PixoraaGoods only, never give this to customers)

## How the product is delivered

1. **Public demo** (Vercel project `pixoraagoods-adhd-budget-planner`, `APP_MODE=demo`). Link it in your Etsy listing and on social media. It shows sample data and a DEMO banner.
2. **Customer app** (second Vercel project from the same GitHub repo, `APP_MODE=customer`). It starts empty with guided setup. This link goes **only** inside the buyer PDF.
3. **Etsy digital file:** `docs/customer/PixoraaGoods-Budget-Planner-Quick-Start-Guide.pdf`. Before uploading, replace `[YOUR-APP-LINK]` with the customer app URL and rebuild the PDF.

Both deployments are plain static websites. Each visitor's data stays in their own browser, so there is no shared database and no customer data on your side to protect or leak.

**Be aware:** anyone who gets the customer link can use the app. Because there are no accounts, this can't be prevented technically. The personal-use licence forbids sharing. If the link leaks widely, you can create a new Vercel project with a new URL and send it to past buyers via Etsy messages. Their data stays in their browser, but it is tied to the old address, so they would need Export → Import.

## Deploying (GitHub → Vercel)

- Repository: `maryamrani25/pixoraagoods-adhd-budget-planner` (private), branch `main`.
- Vercel: Add New → Project → Import repository → Framework **Other** (settings come from `vercel.json`).
- For the customer project, add the environment variable `APP_MODE=customer` (Production + Preview).
- Every push to `main` redeploys both projects automatically. Pull requests and other branches get preview URLs.
- No secrets are used. Never add API keys, `.env` files or customer backups to the repo.

## Updating the app safely

1. Make changes on a branch → open a pull request → check the Vercel **preview** URL.
2. Run the tests (see README).
3. Merge to `main`. Installed apps show "A new version is ready. Update now". Data is not touched.
4. **Never change the IndexedDB name** in `src/lib/db.ts`, or customers' data will look empty.

## Before you publish the listing

- [ ] Open the demo URL on a real iPhone (Safari) and an Android phone (Chrome): add an expense, install to the Home Screen, turn on airplane mode, reopen.
- [ ] Test in Firefox and Edge on a computer.
- [ ] Put the customer URL in the PDF and rebuild it.
- [ ] Upload the PDF as the Etsy digital file and check the download as a buyer would.
- [ ] Only claim what was tested (see "Claims" below).

## Claims you can make

Works in the browser on phone/tablet/computer; installable (Chrome/Edge/Android, Safari "Add to Home Screen"); works offline after the first visit; no bank connection; no account; data stays on the device; backup/restore; CSV export; light and dark mode; USD plus 9 other display currencies.

## Claims you must NOT make

Bank sync · device sync / cloud backup · push or email notifications · currency conversion · lifetime hosting · "treats ADHD" · financial advice · WCAG certification (basic accessibility was built in, but there was no formal audit or screen-reader test).

## Support message templates

**Lost data:** "I'm sorry that happened! Your data is saved inside the browser you used, so it can disappear if browsing data was cleared, a private window was used, or a different browser/device is open. If you have a backup file, open Settings → Import a backup. To stay safe in future, Settings → Export full backup once a month."

**Can't install:** "On iPhone, open the link in Safari, tap Share → Add to Home Screen. On Android or a computer, use Chrome or Edge and choose Install app from the menu. Firefox on computers can't install apps, but the link works in a normal tab."

**Wrong numbers:** "Safe-to-Spend starts from the bank balance you entered. Please open Safe-to-Spend → Update balance and type today's balance from your banking app. The 'How it's worked out' section shows every step of the calculation."
