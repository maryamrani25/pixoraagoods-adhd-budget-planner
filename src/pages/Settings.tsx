import React, { useEffect, useRef, useState } from 'react';
import { LuDownload, LuUpload, LuRotateCcw, LuTrash2, LuSmartphone, LuLock, LuSun, LuMoon, LuMonitor } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, Field, inputCls, Segmented, Modal, Notice, confirmAction, Badge } from '../components/ui';
import { CURRENCIES } from '../lib/money';
import { makeBackup, parseBackup, transactionsCSV, download, type ImportResult } from '../lib/backup';
import { storageKind, isPersisted, requestPersistence, APP_MODE } from '../lib/db';
import { buildDemoData } from '../lib/demo';
import { formatDate, freqLabel } from '../lib/dates';
import type { PayFrequency, Settings as S } from '../lib/types';

declare const __APP_VERSION__: string;
interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }>; }

export default function Settings() {
  const { data, update, replace, resetDemo, clearAll, today } = useStore();
  const s = data.settings;
  const set = (patch: Partial<S>, toast?: string) => update((d) => { d.settings = { ...d.settings, ...patch }; }, toast ? { toast } : undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importErr, setImportErr] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => { isPersisted().then(setPersisted); }, []);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as BIPEvent); };
    addEventListener('beforeinstallprompt', h); addEventListener('appinstalled', () => setInstalled(true));
    setInstalled(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    return () => removeEventListener('beforeinstallprompt', h);
  }, []);

  const onFile = async (f?: File | null) => {
    setImportErr('');
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return setImportErr('That file is too large to be a budget backup.');
    const res = parseBackup(await f.text());
    if (!res.ok) setImportErr(res.error); else setPreview(res);
    if (fileRef.current) fileRef.current.value = '';
  };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Make it yours. Sensible defaults are already set, so change only what you want." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="You & appearance">
          <div className="grid gap-4">
            <Field label="Your name" htmlFor="st-name" hint="Used for the greeting. Optional."><input id="st-name" className={inputCls} value={s.name} onChange={(e) => set({ name: e.target.value.slice(0, 40) })} /></Field>
            <Field label="Theme"><Segmented label="Theme" value={s.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Match device' }]} /></Field>
            <p className="flex gap-3 text-xs text-muted"><LuSun aria-hidden /> <LuMoon aria-hidden /> <LuMonitor aria-hidden /> Dark mode uses the Midnight Plum palette.</p>
          </div>
        </Card>

        <Card title="Money & dates">
          <div className="grid gap-4">
            <Field label="Currency" htmlFor="st-cur" hint="Changes how amounts are shown. It doesn't convert between currencies.">
              <select id="st-cur" className={inputCls} value={s.currency} onChange={(e) => set({ currency: e.target.value }, 'Currency updated.')}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
            <Field label="Date format" htmlFor="st-df"><select id="st-df" className={inputCls} value={s.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as S['dateFormat'] })}>
              <option value="MDY">MM/DD/YYYY ({formatDate(today, 'MDY')})</option><option value="DMY">DD/MM/YYYY ({formatDate(today, 'DMY')})</option><option value="YMD">YYYY-MM-DD ({formatDate(today, 'YMD')})</option></select></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Budget month starts on day" htmlFor="st-ms" hint="Handy if you're paid mid-month."><select id="st-ms" className={inputCls} value={s.monthStartDay} onChange={(e) => set({ monthStartDay: Number(e.target.value) }, 'Budget month start updated.')}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></Field>
              <Field label="Usual pay frequency" htmlFor="st-pf" hint="Default for new income."><select id="st-pf" className={inputCls} value={s.payFrequency} onChange={(e) => set({ payFrequency: e.target.value as PayFrequency })}>{(['weekly', 'biweekly', 'twice-monthly', 'monthly', 'irregular'] as PayFrequency[]).map((f) => <option key={f} value={f}>{freqLabel[f]}</option>)}</select></Field>
            </div>
          </div>
        </Card>

        <Card title="Today dashboard">
          <div className="grid gap-1">
            {([['showCheckIn', 'Daily check-in'], ['showGoals', 'Savings progress'], ['showDebt', 'Debt payoff'], ['showCharts', 'Income & spending chart']] as const).map(([k, label]) => (
              <label key={k} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 hover:bg-surface-2"><span>{label}</span>
                <input type="checkbox" className="h-5 w-5 accent-[var(--mauve)]" checked={s.dashboard[k]} onChange={(e) => update((d) => { d.settings.dashboard[k] = e.target.checked; })} /></label>
            ))}
          </div>
        </Card>

        <Card title="Reminders" subtitle="Gentle, in-app only. No pop-ups or phone notifications.">
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 hover:bg-surface-2"><span>Show "Soon" on bills that are nearly due</span>
            <input type="checkbox" className="h-5 w-5 accent-[var(--mauve)]" checked={s.remindersEnabled} onChange={(e) => set({ remindersEnabled: e.target.checked })} /></label>
          <Field className="mt-3" label="How many days before?" htmlFor="st-rd"><input id="st-rd" type="number" min={0} max={14} className={inputCls} value={s.reminderDays} onChange={(e) => set({ reminderDays: Math.max(0, Math.min(14, Number(e.target.value) || 0)) })} disabled={!s.remindersEnabled} /></Field>
          <p className="mt-3 text-sm text-muted">Categories can be added, renamed, recoloured or deleted on the <a href="#/budget" className="font-medium text-mauve hover:underline">Monthly Budget</a> page.</p>
        </Card>

        <Card title="Backup & restore" subtitle="Your data lives only in this browser. Back it up regularly." className="lg:col-span-2">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid content-start gap-3">
              <Notice icon={<LuLock aria-hidden className="mt-0.5 shrink-0" />}>
                Saved on this device in your browser's private database ({storageKind() === 'indexeddb' ? 'IndexedDB' : storageKind() === 'localstorage' ? 'local storage' : 'memory only, not saved!'}). {persisted === true ? 'Your browser has agreed to keep it.' : persisted === false ? 'Your browser may clear it if space runs low.' : ''}
              </Notice>
              {persisted === false && <Button size="sm" variant="secondary" onClick={async () => setPersisted(await requestPersistence())}>Ask browser to keep my data</Button>}
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Clearing browsing data, using private/incognito windows, or uninstalling the app can delete it.</li>
                <li>Data does not sync between devices or browsers. To move it, export a backup here and import it there.</li>
              </ul>
            </div>
            <div className="grid content-start gap-2">
              <Button icon={<LuDownload aria-hidden />} onClick={() => download(`pixoraagoods-budget-backup-${today}.json`, makeBackup(data))}>Export full backup (.json)</Button>
              <Button variant="secondary" icon={<LuDownload aria-hidden />} onClick={() => download(`pixoraagoods-transactions-${today}.csv`, transactionsCSV(data), 'text/csv')}>Export transactions (.csv for Excel / Sheets)</Button>
              <Button variant="secondary" icon={<LuUpload aria-hidden />} onClick={() => fileRef.current?.click()}>Import a backup…</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Choose backup file" onChange={(e) => onFile(e.target.files?.[0])} data-testid="import-input" />
              {importErr && <p role="alert" className="text-sm text-danger">{importErr}</p>}
              <div className="mt-2 border-t border-line pt-3" />
              {data.isDemo
                ? <Button variant="secondary" icon={<LuRotateCcw aria-hidden />} onClick={async () => { if (await confirmAction({ title: 'Reset demo data?', message: 'Puts the sample data back the way it started.', confirmLabel: 'Reset demo' })) resetDemo(); }}>Reset demo data</Button>
                : <Button variant="secondary" icon={<LuRotateCcw aria-hidden />} onClick={async () => { if (await confirmAction({ title: 'Load sample data?', message: 'This replaces your current data with fictional sample data so you can explore. Export a backup first if you want to keep your data. You can press Undo straight after.', confirmLabel: 'Load sample data', danger: true })) { const d = buildDemoData(today); d.isDemo = false; d.settings.theme = s.theme; replace(d, 'Sample data loaded.'); } }}>Explore with sample data</Button>}
              <Button variant="ghost" className="text-danger" icon={<LuTrash2 aria-hidden />} onClick={async () => {
                if (!(await confirmAction({ title: 'Delete all data?', message: 'Everything in this planner on this device will be permanently deleted. Export a backup first if you might want it later.', confirmLabel: 'Continue', danger: true }))) return;
                if (await confirmAction({ title: 'Are you completely sure?', message: 'This cannot be undone.', confirmLabel: 'Yes, delete everything', danger: true })) await clearAll();
              }}>Delete all data on this device</Button>
            </div>
          </div>
        </Card>

        <Card title="Install the app" subtitle="Open it like a normal app, even offline.">
          {installed ? <p className="text-success">Installed. You're using the app version.</p> : installEvt ? (
            <Button icon={<LuSmartphone aria-hidden />} onClick={async () => { await installEvt.prompt(); setInstallEvt(null); }}>Install PixoraaGoods Budget</Button>
          ) : (
            <div className="text-sm text-ink">
              {ios ? <p>On iPhone/iPad (Safari): tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</p> : <p>Chrome / Edge (computer or Android): use the <b>Install</b> icon in the address bar, or the browser menu → <b>Install app</b> / <b>Add to Home screen</b>.</p>}
              <p className="mt-2 text-muted">Firefox on computers doesn't support installing web apps, but the app still works in a normal tab and offline after your first visit.</p>
            </div>
          )}
        </Card>

        <Card title="Privacy">
          <div className="grid gap-2 text-sm text-ink">
            <p><b>No bank connection.</b> You type everything in yourself.</p>
            <p><b>No account, no cloud.</b> Your financial data is stored only in this browser on this device. It is never sent to us or anyone else.</p>
            <p><b>No ads, no tracking, no analytics</b> inside the app.</p>
            <p className="text-muted">The website host (Vercel) receives normal technical request logs, like any website, when the app files are downloaded. Your budget data is never part of those requests.</p>
          </div>
        </Card>

        <Card title="About" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>PixoraaGoods ADHD Budget Planner</span><Badge>v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</Badge>{APP_MODE === 'demo' && <Badge tone="gold">Demo build</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted">A budgeting and financial organisation tool. It is not financial, tax, legal or medical advice, and it does not diagnose or treat ADHD. Calculations depend on the information you enter.</p>
        </Card>
      </div>

      {preview && (
        <Modal open onClose={() => setPreview(null)} title="Restore this backup?"
          footer={<><Button variant="secondary" onClick={() => setPreview(null)}>Cancel</Button><Button onClick={() => { const d = preview.data; d.settings.onboarded = true; replace(d, 'Backup restored.'); setPreview(null); }}>Replace my data</Button></>}>
          <p className="mb-3">This backup contains:</p>
          <ul className="mb-4 grid gap-1 text-sm">{Object.entries(preview.counts).map(([k, v]) => <li key={k} className="flex justify-between rounded-lg bg-surface-2 px-3 py-1.5"><span className="capitalize">{k}</span><b className="num">{v}</b></li>)}</ul>
          <Notice tone="warning">Your current data will be replaced. You can press Undo straight after if you change your mind.</Notice>
        </Modal>
      )}
    </div>
  );
}
