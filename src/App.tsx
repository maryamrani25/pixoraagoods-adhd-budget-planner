import React, { useEffect, useState } from 'react';
import { LuSun, LuRocket, LuWallet, LuBanknote, LuShieldCheck, LuReceipt, LuHandCoins, LuCalendarDays, LuPiggyBank, LuCreditCard, LuTarget, LuChartColumn, LuSettings, LuPlus, LuEllipsis, LuX, LuWifiOff, LuRotateCcw, LuSparkles } from 'react-icons/lu';
import { useStore } from './lib/store';
import { ConfirmHost, cx, Button, confirmAction } from './components/ui';
import { QuickHost } from './components/QuickForms';
import Dashboard from './pages/Dashboard';
import GettingStarted, { OnboardingWizard } from './pages/GettingStarted';
import Budget from './pages/Budget';
import Paycheck from './pages/Paycheck';
import SafeToSpendPage from './pages/SafeToSpend';
import Expenses from './pages/Expenses';
import Income from './pages/Income';
import Bills from './pages/Bills';
import Savings from './pages/Savings';
import Debt from './pages/Debt';
import Goals from './pages/Goals';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export const NAV = [
  { id: 'today', label: 'Today', icon: LuSun, el: Dashboard },
  { id: 'start', label: 'Getting Started', icon: LuRocket, el: GettingStarted },
  { id: 'budget', label: 'Monthly Budget', icon: LuWallet, el: Budget },
  { id: 'paycheck', label: 'Paycheck Planner', icon: LuBanknote, el: Paycheck },
  { id: 'safe', label: 'Safe-to-Spend', icon: LuShieldCheck, el: SafeToSpendPage },
  { id: 'expenses', label: 'Expenses', icon: LuReceipt, el: Expenses },
  { id: 'income', label: 'Income', icon: LuHandCoins, el: Income },
  { id: 'bills', label: 'Bills & Calendar', icon: LuCalendarDays, el: Bills },
  { id: 'savings', label: 'Savings Goals', icon: LuPiggyBank, el: Savings },
  { id: 'debt', label: 'Debt Tracker', icon: LuCreditCard, el: Debt },
  { id: 'goals', label: 'Financial Goals', icon: LuTarget, el: Goals },
  { id: 'reports', label: 'Reports', icon: LuChartColumn, el: Reports },
  { id: 'settings', label: 'Settings', icon: LuSettings, el: Settings },
] as const;
export type RouteId = (typeof NAV)[number]['id'];

const readRoute = (): RouteId => { const h = location.hash.replace(/^#\/?/, '').split('?')[0]; return (NAV.some((n) => n.id === h) ? h : 'today') as RouteId; };
export const go = (id: string) => { location.hash = `#/${id}`; };

function Logo() {
  return (
    <a href="#/today" className="flex items-center gap-3 rounded-xl px-1" aria-label="PixoraaGoods ADHD Budget Planner, go to Today">
      <img src="/icons/favicon.svg" alt="" className="h-9 w-9 rounded-xl" />
      <span className="leading-tight"><span className="block font-serif text-[17px] text-ink">PixoraaGoods</span><span className="block text-[11px] tracking-wide text-muted uppercase">Budget Planner</span></span>
    </a>
  );
}

function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => { const a = () => setOn(true), b = () => setOn(false); addEventListener('online', a); addEventListener('offline', b); return () => { removeEventListener('online', a); removeEventListener('offline', b); }; }, []);
  return on;
}

function useServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || location.hostname === 'localhost' && location.port === '5999') return;
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(nw); });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
    // Reload only when an update replaces an existing version (not on the very first install).
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  }, []);
  return { waiting, apply: () => waiting?.postMessage('SKIP_WAITING') };
}

export default function App() {
  const { ready, data, toast, undo, dismissToast, openQuick, resetDemo, saveError } = useStore();
  const [route, setRoute] = useState<RouteId>(readRoute());
  const [more, setMore] = useState(false);
  const [wizard, setWizard] = useState(false);
  const online = useOnline();
  const sw = useServiceWorker();

  useEffect(() => { const f = () => { setRoute(readRoute()); setMore(false); window.scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (ready && !data.settings.onboarded && !data.isDemo) setWizard(true); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return; const t = setTimeout(dismissToast, toast.undo ? 7000 : 3500); return () => clearTimeout(t); }, [toast, dismissToast]);
  useEffect(() => { const n = NAV.find((x) => x.id === route); document.title = `${n?.label ?? 'Today'} · PixoraaGoods Budget Planner${data.isDemo ? ' (Demo)' : ''}`; }, [route, data.isDemo]);

  if (!ready) return <div className="flex min-h-dvh items-center justify-center text-muted">Opening your planner…</div>;
  const Page = NAV.find((n) => n.id === route)!.el;
  const mobileTabs: RouteId[] = ['today', 'expenses', 'safe'];

  return (
    <div className="min-h-dvh">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2">Skip to content</a>
      {data.isDemo && (
        <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-plum px-4 py-2 text-center text-[13px] text-white">
          <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold tracking-wider text-plum">DEMO</span>
          <span>Sample data only. Anything you change stays in this browser.</span>
          <button className="inline-flex items-center gap-1 font-medium text-gold underline-offset-4 hover:underline" onClick={async () => { if (await confirmAction({ title: 'Reset demo data?', message: 'This puts the sample data back the way it started. Your changes in this demo will be removed.', confirmLabel: 'Reset demo' })) resetDemo(); }}><LuRotateCcw aria-hidden /> Reset demo</button>
        </div>
      )}
      {!online && <div role="status" className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-1.5 text-[13px] text-ink"><LuWifiOff aria-hidden /> You're offline. Everything still works and saves on this device.</div>}
      {sw.waiting && <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-success-soft px-4 py-2 text-[13px] text-ink"><LuSparkles aria-hidden /> A new version is ready. <button className="font-semibold underline" onClick={sw.apply}>Update now</button></div>}
      {saveError && <div role="alert" className="bg-danger-soft px-4 py-2 text-center text-[13px] text-ink">{saveError}</div>}

      <div className="mx-auto flex max-w-[1400px]">
        <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line px-4 py-6 lg:flex" aria-label="Main navigation">
          <Logo />
          <Button onClick={() => openQuick('expense')} icon={<LuPlus aria-hidden />}>Add expense</Button>
          <nav><ul className="grid gap-0.5">
            {NAV.map((n) => (
              <li key={n.id}><a href={`#/${n.id}`} aria-current={route === n.id ? 'page' : undefined}
                className={cx('flex min-h-10 items-center gap-3 rounded-xl px-3 text-[14.5px] transition', route === n.id ? 'bg-primary font-medium text-on-primary' : 'text-ink hover:bg-surface-2')}>
                <n.icon aria-hidden className="h-[18px] w-[18px] shrink-0" />{n.label}</a></li>
            ))}
          </ul></nav>
          <p className="mt-auto px-3 text-xs text-muted">Your Money, Made Simpler.<br />Data saved on this device only.</p>
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-5 pb-28 outline-none sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">
          <div className="mb-5 flex items-center justify-between lg:hidden"><Logo /></div>
          <Page />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main navigation" className="no-print safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-end">
          {mobileTabs.slice(0, 2).map((id) => <MobileTab key={id} id={id} active={route === id} />)}
          <li className="flex justify-center"><button onClick={() => openQuick('expense')} aria-label="Add expense" className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl text-on-primary shadow-lg"><LuPlus aria-hidden /></button></li>
          {mobileTabs.slice(2).map((id) => <MobileTab key={id} id={id} active={route === id} />)}
          <li><button onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more} className={cx('flex min-h-16 w-full flex-col items-center justify-center gap-1 text-[11px]', !mobileTabs.includes(route) ? 'font-semibold text-mauve' : 'text-muted')}><LuEllipsis aria-hidden className="h-5 w-5" />More</button></li>
        </ul>
      </nav>
      {more && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
          <button className="absolute inset-0 bg-plum/40" aria-label="Close menu" onClick={() => setMore(false)} />
          <div className="safe-bottom absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-surface p-5">
            <div className="mb-3 flex items-center justify-between"><p className="font-serif text-xl">All sections</p><button onClick={() => setMore(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-surface-2" aria-label="Close"><LuX aria-hidden /></button></div>
            <ul className="grid grid-cols-3 gap-2">
              {NAV.map((n) => <li key={n.id}><a href={`#/${n.id}`} className={cx('flex h-full min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center text-[13px]', route === n.id ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink')}><n.icon aria-hidden className="h-5 w-5" />{n.label}</a></li>)}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => { setMore(false); openQuick('income'); }}>Add income</Button>
              <Button variant="secondary" onClick={() => { setMore(false); openQuick('bill'); }}>Add bill</Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6">
          <div className="flex items-center gap-4 rounded-2xl bg-plum px-4 py-3 text-sm text-white shadow-xl dark:bg-gold dark:text-plum">
            <span>{toast.message}</span>
            {toast.undo && <button className="font-semibold text-gold underline-offset-4 hover:underline dark:text-plum" onClick={undo}>Undo</button>}
            <button aria-label="Dismiss" onClick={dismissToast} className="opacity-70 hover:opacity-100"><LuX aria-hidden /></button>
          </div>
        </div>
      )}
      <QuickHost />
      <ConfirmHost />
      {wizard && <OnboardingWizard onClose={() => setWizard(false)} />}
    </div>
  );
}

function MobileTab({ id, active }: { id: RouteId; active: boolean }) {
  const n = NAV.find((x) => x.id === id)!;
  const short: Record<string, string> = { today: 'Today', expenses: 'Expenses', safe: 'Safe', bills: 'Bills' };
  return (
    <li><a href={`#/${id}`} aria-current={active ? 'page' : undefined} className={cx('flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]', active ? 'font-semibold text-mauve' : 'text-muted')}>
      <n.icon aria-hidden className="h-5 w-5" />{short[id]}</a></li>
  );
}
