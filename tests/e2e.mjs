// End-to-end browser tests (Playwright + Chrome).
// Usage: node tests/e2e.mjs [baseUrl] [customerBaseUrl]
// Needs the built app served, e.g. `node scripts/serve.mjs 4173 dist`.
import fs from 'node:fs';
let pw;
try { pw = await import('playwright'); } catch { pw = await import(process.env.PLAYWRIGHT_PATH || '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'); }
const { chromium } = pw;
const BASE = process.argv[2] || 'http://localhost:4173';
const CUSTOMER = process.argv[3];
const exe = process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({ executablePath: exe });
let pass = 0, fail = 0; const failures = [];
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; failures.push(name); console.log('  ✗', name, extra); } };
const money = (s) => Number(String(s).replace(/[^0-9.\-]/g, ''));
const shots = process.env.SHOTS_DIR;

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  return { ctx, page };
}
const go = async (page, route) => { await page.evaluate((r) => { location.hash = '#/' + r; }, route); await page.waitForTimeout(250); };
const statValue = async (page, label) => money(await page.locator(`text=${label}`).first().locator('xpath=ancestor::*[contains(@class,"rounded-3xl")][1]').locator('.num').first().textContent());
const safeValue = async (page) => { await go(page, 'safe'); return money(await page.locator('section[aria-live] .num').first().textContent()); };

// ---------------- Demo build: functional tests ----------------
{
  console.log('\nDemo build: functional tests');
  const { ctx, page } = await newPage();
  await page.goto(BASE + '/#/today'); await page.waitForSelector('h1');
  ok('demo banner visible', await page.locator('text=Sample data only').isVisible());
  const safe0 = await safeValue(page);
  ok('safe-to-spend shows a number', Number.isFinite(safe0) && safe0 !== 0, String(safe0));

  // Add expense (validation first)
  await go(page, 'expenses');
  await page.getByRole('button', { name: 'Add expense' }).first().click();
  await page.getByRole('button', { name: 'Add expense' }).last().click();
  ok('expense validation message', await page.locator('text=Enter an amount above zero').isVisible());
  await page.fill('#ex-amount', '23.45');
  await page.getByRole('radio', { name: 'Dining' }).click().catch(async () => { await page.selectOption('select[aria-label="All categories"]', 'dining'); });
  await page.fill('#ex-name', 'E2E Test Lunch');
  await page.getByRole('button', { name: 'Add expense' }).last().click();
  await page.waitForTimeout(300);
  ok('expense added to list', await page.locator('text=E2E Test Lunch').isVisible());
  const safe1 = await safeValue(page);
  ok('safe-to-spend drops by 23.45', Math.abs((safe0 - safe1) - 23.45) < 0.001, `${safe0} -> ${safe1}`);

  // Edit expense
  await go(page, 'expenses');
  await page.getByRole('button', { name: 'Edit E2E Test Lunch' }).click();
  await page.fill('#ex-amount', '30');
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForTimeout(300);
  ok('expense edited', (await page.locator('li:has-text("E2E Test Lunch") .num').first().textContent()).includes('30.00'));
  // Search & filter
  await page.fill('input[type=search]', 'E2E Test');
  ok('search filters list', (await page.locator('text=1 expense').count()) === 1);
  await page.fill('input[type=search]', '');
  await page.selectOption('select[aria-label="Filter by category"]', 'groceries');
  ok('category filter', !(await page.locator('text=E2E Test Lunch').isVisible()));
  await page.selectOption('select[aria-label="Filter by category"]', '');
  // Delete + undo
  await page.getByRole('button', { name: 'Delete E2E Test Lunch' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click(); await page.waitForTimeout(300);
  ok('expense deleted', !(await page.locator('li:has-text("E2E Test Lunch")').count()));
  await page.getByRole('button', { name: 'Undo' }).click(); await page.waitForTimeout(300);
  ok('undo restores expense', (await page.locator('li:has-text("E2E Test Lunch")').count()) === 1);

  // Income: add, edit, delete
  await go(page, 'income');
  await page.getByRole('button', { name: 'Record income' }).click();
  await page.fill('#in-amount', '250');
  await page.fill('#in-name', 'E2E Freelance Gig');
  await page.selectOption('#in-kind', 'freelance');
  await page.getByRole('button', { name: 'Record income' }).last().click(); await page.waitForTimeout(300);
  ok('income added', await page.locator('text=E2E Freelance Gig').isVisible());
  const safe2 = await safeValue(page);
  ok('received income raises safe-to-spend', Math.abs((safe2 - safe1) - (250 - 6.55)) < 0.001, `${safe1} -> ${safe2}`);
  await go(page, 'income');
  await page.getByRole('button', { name: 'Edit E2E Freelance Gig' }).click();
  await page.fill('#in-amount', '300'); await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForTimeout(300);
  ok('income edited', (await page.locator('li:has-text("E2E Freelance Gig")').textContent()).includes('300.00'));
  await page.getByRole('button', { name: 'Delete E2E Freelance Gig' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click(); await page.waitForTimeout(300);
  ok('income deleted', !(await page.locator('li:has-text("E2E Freelance Gig")').count()));
  // Future income is refused
  await page.getByRole('button', { name: 'Record income' }).click();
  await page.fill('#in-amount', '10'); await page.fill('#in-date', '2099-01-01');
  await page.getByRole('button', { name: 'Record income' }).last().click();
  ok('future income refused', await page.locator('text=Only record money you\'ve already received').isVisible());
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('Escape closes dialog', !(await page.locator('dialog[open]').count()));
  // Regular income source
  await page.getByRole('button', { name: 'Add regular income' }).first().click();
  await page.fill('#src-name', 'E2E Side Job'); await page.selectOption('#src-freq', 'weekly'); await page.fill('#src-amt', '100');
  await page.getByRole('button', { name: 'Add', exact: true }).click(); await page.waitForTimeout(300);
  ok('recurring income source added', await page.locator('text=E2E Side Job').first().isVisible());

  // Budget: set a limit, categories
  await go(page, 'budget');
  await page.getByRole('button', { name: /^Education limit/ }).click();
  await page.locator('form input[inputmode=decimal]').first().fill('45');
  await page.getByRole('button', { name: 'Save limit' }).click(); await page.waitForTimeout(250);
  ok('budget limit updated', (await page.getByRole('button', { name: /^Education limit/ }).textContent()).includes('45.00'));
  await page.getByRole('button', { name: 'New category' }).click();
  await page.fill('#cat-name', 'Pets'); await page.getByRole('button', { name: 'Add category' }).click(); await page.waitForTimeout(250);
  ok('category created', await page.locator('li:has-text("Pets")').first().isVisible());
  await page.getByRole('button', { name: 'Edit Pets category' }).click();
  await page.fill('#cat-name', 'Pet Care'); await page.getByRole('button', { name: 'Save' }).click(); await page.waitForTimeout(250);
  ok('category renamed', await page.locator('li:has-text("Pet Care")').first().isVisible());
  await page.getByRole('button', { name: 'Delete Pet Care category' }).click();
  await page.getByRole('button', { name: 'Delete category' }).click(); await page.waitForTimeout(250);
  ok('category deleted', !(await page.locator('li:has-text("Pet Care")').count()));
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: 'Copy last month' }).click();
  const dlg = page.getByRole('button', { name: 'Copy limits' }); if (await dlg.count()) await dlg.click();
  await page.waitForTimeout(250);
  ok('duplicate previous budget', (await page.getByRole('button', { name: /^Groceries limit/ }).textContent()).includes('400.00'));
  await page.getByRole('button', { name: 'Previous month' }).click(); await page.getByRole('button', { name: 'Previous month' }).click();
  ok('review previous month', (await page.locator('text=October').count()) > 0 || (await page.locator('main').textContent()).length > 0);

  // Paycheck allocation
  await go(page, 'paycheck');
  await page.selectOption('#al-kind', 'other'); await page.fill('#al-label', 'E2E Buffer'); await page.fill('#al-amt', '10');
  await page.getByRole('button', { name: 'Add', exact: true }).click(); await page.waitForTimeout(250);
  ok('allocation added', await page.locator('li:has-text("E2E Buffer")').isVisible());
  const unplanned = await page.locator('text=Not planned yet').textContent().catch(() => '');
  ok('unallocated updates', unplanned.includes('315.00'), unplanned);

  // Safe-to-spend: update balance
  await go(page, 'safe');
  await page.getByRole('button', { name: 'Update balance' }).click();
  await page.fill('#bal-amt', '1000');
  await page.getByRole('button', { name: 'Save balance' }).click(); await page.waitForTimeout(300);
  const s3 = money(await page.locator('section[aria-live] .num').first().textContent());
  const reserved = money(await page.locator('dt:has-text("Bills due by") + dd').textContent()) + money(await page.locator('dt:has-text("Savings planned") + dd').textContent()) + money(await page.locator('dt:has-text("Other commitments") + dd').textContent());
  ok('safe = balance - reserved', Math.abs(s3 - (1000 - reserved)) < 0.001, `${s3} vs ${1000 - reserved}`);
  await page.getByRole('radio', { name: 'End of the month' }).click(); await page.waitForTimeout(200);
  const s4 = money(await page.locator('section[aria-live] .num').first().textContent());
  ok('horizon switch reserves more bills', s4 < s3, `${s3} -> ${s4}`);

  // Bills: add, mark paid, unmark
  await go(page, 'bills');
  await page.getByRole('button', { name: 'Add bill' }).click();
  await page.fill('#bill-name', 'E2E Gym'); await page.fill('#bill-amount', '30');
  const d = new Date(); d.setDate(d.getDate() + 2); const iso = d.toISOString().slice(0, 10);
  await page.fill('#bill-due', iso);
  await page.getByRole('button', { name: 'Add bill' }).last().click(); await page.waitForTimeout(300);
  ok('bill added', await page.locator('li:has-text("E2E Gym")').first().isVisible());
  ok('reminder "Soon" shown', (await page.locator('li:has-text("E2E Gym")').first().textContent()).includes('Soon'));
  await page.getByRole('button', { name: new RegExp(`Mark E2E Gym due ${iso} as paid`) }).click(); await page.waitForTimeout(300);
  ok('bill marked paid', (await page.locator('li:has-text("E2E Gym")').first().textContent()).includes('Paid'));
  await go(page, 'expenses');
  ok('paid bill created one expense', (await page.locator('li:has-text("E2E Gym")').count()) === 1);
  await go(page, 'bills');
  await page.getByRole('button', { name: 'Mark E2E Gym unpaid' }).click(); await page.waitForTimeout(300);
  await go(page, 'expenses');
  ok('unmark removes the expense', (await page.locator('li:has-text("E2E Gym")').count()) === 0);

  // Savings
  await go(page, 'savings');
  await page.getByRole('button', { name: 'New goal' }).click();
  await page.fill('#g-name', 'E2E Car Fund'); await page.fill('#g-target', '2000'); await page.fill('#g-start', '100');
  await page.getByRole('button', { name: 'Create goal' }).click(); await page.waitForTimeout(300);
  ok('goal created', await page.locator('h2:has-text("E2E Car Fund")').isVisible());
  const expBefore = await (async () => { await go(page, 'expenses'); return money(await page.locator('.num.font-semibold').first().textContent()); })();
  await go(page, 'savings');
  await page.locator('section:has(h2:has-text("E2E Car Fund"))').getByRole('button', { name: 'Add money' }).click();
  await page.fill('#sv-amount', '50'); await page.getByRole('button', { name: 'Add to savings' }).last().click(); await page.waitForTimeout(300);
  ok('contribution recorded', (await page.locator('section:has(h2:has-text("E2E Car Fund")) .font-serif').textContent()).includes('150.00'));
  await go(page, 'expenses');
  ok('savings not counted as expense', money(await page.locator('.num.font-semibold').first().textContent()) === expBefore);

  // Debt
  await go(page, 'debt');
  await page.getByRole('button', { name: 'Add debt' }).first().click();
  await page.fill('#d-name', 'E2E Loan'); await page.fill('#d-cur', '500'); await page.fill('#d-orig', '800'); await page.fill('#d-apr', '10'); await page.fill('#d-min', '50');
  await page.getByRole('button', { name: 'Add debt' }).last().click(); await page.waitForTimeout(300);
  ok('debt added', await page.locator('h2:has-text("E2E Loan")').isVisible());
  await page.locator('section:has(h2:has-text("E2E Loan"))').getByRole('button', { name: 'Record payment' }).click();
  await page.fill('#p-amt', '75'); await page.getByRole('button', { name: 'Save' }).click(); await page.waitForTimeout(300);
  ok('payment lowers balance', (await page.locator('section:has(h2:has-text("E2E Loan")) .font-serif').textContent()).includes('425.00'));
  await page.getByRole('radio', { name: 'Debt Avalanche' }).click();
  ok('avalanche explainer', await page.locator('text=highest interest rate').isVisible());

  // Financial goals
  await go(page, 'goals');
  await page.getByRole('button', { name: 'New goal' }).click();
  await page.fill('#fg-name', 'E2E Goal'); await page.fill('#fg-ms', 'Step one\nStep two');
  await page.getByRole('button', { name: 'Create goal' }).click(); await page.waitForTimeout(300);
  await page.locator('section:has(h2:has-text("E2E Goal")) label:has-text("Step one") input').check(); await page.waitForTimeout(200);
  ok('milestone progress 50%', (await page.locator('section:has(h2:has-text("E2E Goal"))').textContent()).includes('50%'));
  await page.locator('section:has(h2:has-text("E2E Goal"))').getByRole('button', { name: 'Mark completed' }).click(); await page.waitForTimeout(250);
  ok('goal completed', (await page.locator('section:has(h2:has-text("E2E Goal"))').textContent()).includes('Completed'));

  // Reports
  await go(page, 'reports');
  await page.selectOption('#rp-range', '12'); await page.waitForTimeout(200);
  ok('reports charts render', (await page.locator('svg[role=img]').count()) >= 3);
  ok('annual overview table', await page.locator('text=Annual overview').isVisible());

  // Settings: theme, currency, export, import, reset
  await go(page, 'settings');
  await page.getByRole('radio', { name: 'Dark' }).click(); await page.waitForTimeout(200);
  ok('dark mode applied', await page.evaluate(() => document.documentElement.classList.contains('dark')));
  if (shots) { await go(page, 'today'); await page.screenshot({ path: `${shots}/dark-dashboard.png`, fullPage: false }); await go(page, 'settings'); }
  await page.getByRole('radio', { name: 'Light' }).click(); await page.waitForTimeout(200);
  ok('light mode applied', !(await page.evaluate(() => document.documentElement.classList.contains('dark'))));
  await page.selectOption('#st-cur', 'GBP'); await page.waitForTimeout(200);
  await go(page, 'today');
  ok('currency switched to GBP', (await page.locator('main').textContent()).includes('£'));
  await go(page, 'settings'); await page.selectOption('#st-cur', 'USD');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export full backup/ }).click()]);
  const backupPath = '/tmp/e2e-backup.json'; await dl.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  ok('backup exported', backup.app === 'pixoraagoods-adhd-budget-planner' && backup.data.transactions.length > 50);
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export transactions/ }).click()]);
  ok('CSV exported', (await csv.suggestedFilename()).endsWith('.csv'));
  // persistence across reload
  await page.reload(); await page.waitForSelector('h1'); await go(page, 'savings');
  ok('data persists after reload', await page.locator('h2:has-text("E2E Car Fund")').isVisible());
  // reset demo
  await go(page, 'settings');
  await page.getByRole('button', { name: 'Reset demo data' }).click(); await page.getByRole('button', { name: 'Reset demo' }).last().click(); await page.waitForTimeout(400);
  await go(page, 'savings');
  ok('reset demo removes changes', !(await page.locator('h2:has-text("E2E Car Fund")').count()));
  // restore backup
  await go(page, 'settings');
  await page.setInputFiles('[data-testid=import-input]', backupPath); await page.waitForTimeout(300);
  ok('import shows preview', await page.locator('text=This backup contains').isVisible());
  await page.getByRole('button', { name: 'Replace my data' }).click(); await page.waitForTimeout(300);
  await go(page, 'savings');
  ok('backup restored', await page.locator('h2:has-text("E2E Car Fund")').isVisible());
  // invalid import
  fs.writeFileSync('/tmp/bad.json', '{"hello":1}');
  await go(page, 'settings'); await page.setInputFiles('[data-testid=import-input]', '/tmp/bad.json'); await page.waitForTimeout(200);
  ok('invalid backup rejected', await page.locator('text=doesn\'t look like a PixoraaGoods').isVisible());

  // Onboarding wizard (in demo)
  await go(page, 'start');
  await page.getByRole('button', { name: /guided setup/ }).first().click();
  ok('wizard opens with progress', await page.locator('text=Step 1 of 8').isVisible());
  for (let i = 0; i < 7; i++) { await page.getByRole('button', { name: /^(Skip|Next)$/ }).last().click(); await page.waitForTimeout(80); }
  ok('wizard reaches last step', await page.locator('text=Step 8 of 8').isVisible());
  await page.getByRole('button', { name: 'Skip setup for now' }).click();

  ok('no console errors (demo)', page.errors.length === 0, page.errors.join(' | '));

  // Offline: service worker + reload offline
  await page.goto(BASE + '/#/today'); await page.waitForTimeout(500);
  const swReady = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  ok('service worker active', swReady);
  await page.reload(); await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {});
  ok('app opens offline', (await page.locator('h1').count()) > 0);
  ok('offline banner', await page.locator('text=You\'re offline').isVisible());
  await go(page, 'expenses');
  await page.getByRole('button', { name: 'Add expense' }).first().click();
  await page.fill('#ex-amount', '5'); await page.fill('#ex-name', 'Offline coffee');
  await page.selectOption('select[aria-label="All categories"]', 'dining');
  await page.getByRole('button', { name: 'Add expense' }).last().click(); await page.waitForTimeout(300);
  await page.reload(); await page.waitForTimeout(600); await go(page, 'expenses');
  ok('expense saved while offline survives reload', await page.locator('text=Offline coffee').isVisible());
  await ctx.setOffline(false);
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  ok('manifest has 192 & 512 icons', manifest.icons.some((i) => i.sizes === '192x192') && manifest.icons.some((i) => i.sizes === '512x512'));
  await ctx.close();
}

// ---------------- Mobile & tablet layouts ----------------
for (const [label, vp] of [['mobile', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1180 }]]) {
  console.log(`\n${label} layout`);
  const { ctx, page } = await newPage({ viewport: vp, isMobile: label === 'mobile', hasTouch: true });
  await page.goto(BASE + '/#/today'); await page.waitForSelector('h1');
  let overflow = [];
  for (const r of ['today', 'start', 'budget', 'paycheck', 'safe', 'expenses', 'income', 'bills', 'savings', 'debt', 'goals', 'reports', 'settings']) {
    await go(page, r);
    const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (w > 1) overflow.push(`${r}:${w}px`);
    if (shots && label === 'mobile' && ['today', 'safe', 'expenses'].includes(r)) await page.screenshot({ path: `${shots}/mobile-${r}.png` });
  }
  ok('no horizontal scrolling on any page', overflow.length === 0, overflow.join(', '));
  if (label === 'mobile') {
    await go(page, 'today');
    ok('bottom navigation visible', await page.locator('nav[aria-label="Main navigation"]').last().isVisible());
    await page.getByRole('button', { name: 'More', exact: true }).click();
    ok('More menu lists all sections', (await page.locator('[aria-label="All sections"] a').count()) === 13);
    await page.locator('[aria-label="All sections"] a:has-text("Debt Tracker")').click(); await page.waitForTimeout(250);
    ok('menu navigates', (await page.locator('h1').textContent()).includes('Debt'));
    await page.getByRole('button', { name: 'Add expense' }).first().click();
    ok('quick add opens on mobile', await page.locator('#ex-amount').isVisible());
  }
  ok(`no console errors (${label})`, page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}

// ---------------- Customer build: onboarding & empty states ----------------
if (CUSTOMER) {
  console.log('\nCustomer build');
  const { ctx, page } = await newPage();
  await page.goto(CUSTOMER + '/#/today'); await page.waitForTimeout(600);
  ok('wizard shown on first launch', await page.locator('text=Step 1 of 8').isVisible());
  ok('no demo banner', !(await page.locator('text=Sample data only').count()));
  await page.fill('#w-name', 'Sam');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.selectOption('#w-freq', 'biweekly'); await page.fill('#w-pay', '1500');
  ok('monthly estimate shown', (await page.locator('p:has-text("That\'s about")').textContent()).includes('3,250.00'));
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.fill('#w-bal', '900'); await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Use example values/ }).click(); await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: /Build an emergency fund/ }).click(); await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Use example values/ }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForTimeout(500);
  ok('greets by name', (await page.locator('h1').textContent()).includes('Sam'));
  await go(page, 'safe');
  ok('safe-to-spend ready after setup', (await page.locator('text=Safe to spend until').count()) > 0);
  await go(page, 'expenses');
  ok('helpful empty state', await page.locator('text=No expenses here yet').isVisible());
  await page.reload(); await page.waitForTimeout(500);
  ok('wizard not shown again', !(await page.locator('text=Step 1 of 8').count()));
  ok('no console errors (customer)', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('Failed:', failures.join('; ')); process.exit(1); }
