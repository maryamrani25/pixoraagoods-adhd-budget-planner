import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppData } from './types';
import { loadData, saveData, clearData, APP_MODE, requestPersistence } from './db';
import { emptyData } from './defaults';
import { buildDemoData } from './demo';
import { todayISO, formatDate } from './dates';
import { formatMoney } from './money';

export type QuickKind = 'expense' | 'income' | 'bill' | 'savings';
interface Toast { id: number; message: string; undo?: AppData; }
interface Ctx {
  data: AppData; today: string; ready: boolean;
  update: (fn: (d: AppData) => void, opts?: { toast?: string; undoable?: boolean }) => void;
  replace: (d: AppData, toast?: string) => void;
  resetDemo: () => void; clearAll: () => Promise<void>;
  money: (c: number) => string; date: (s?: string, withYear?: boolean) => string;
  toast: Toast | null; showToast: (m: string, undo?: AppData) => void; dismissToast: () => void; undo: () => void;
  quick: { kind: QuickKind; editId?: string; preset?: Record<string, unknown> } | null;
  openQuick: (kind: QuickKind, editId?: string, preset?: Record<string, unknown>) => void; closeQuick: () => void;
  saveError: string | null;
}
const StoreCtx = createContext<Ctx | null>(null);
export const useStore = () => { const c = useContext(StoreCtx); if (!c) throw new Error('Store missing'); return c; };

export function applyTheme(theme: AppData['settings']['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', !!dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#30213F' : '#F8F5FA');
  try { localStorage.setItem('pg-theme', JSON.stringify(theme)); } catch { /* ignore */ }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => emptyData());
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [quick, setQuick] = useState<Ctx['quick']>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [today, setToday] = useState(todayISO());
  const dataRef = useRef(data); dataRef.current = data;
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      let d = await loadData();
      if (!d) { d = APP_MODE === 'demo' ? buildDemoData(todayISO()) : emptyData(); await saveData(d); }
      setData(d); setReady(true); requestPersistence();
    })();
    const iv = window.setInterval(() => setToday(todayISO()), 60_000);
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => { applyTheme(data.settings.theme); }, [data.settings.theme]);
  useEffect(() => {
    if (data.settings.theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system'); mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, [data.settings.theme]);

  const persist = useCallback((d: AppData) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveData(d).then(() => setSaveError(null)).catch(() => setSaveError("Your latest change couldn't be saved on this device. Please export a backup."));
    }, 120);
  }, []);
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') saveData(dataRef.current); };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, []);

  const showToast = useCallback((message: string, undo?: AppData) => setToast({ id: Date.now(), message, undo }), []);
  const update: Ctx['update'] = useCallback((fn, opts) => {
    const prev = dataRef.current;
    const next = structuredClone(prev) as AppData;
    fn(next); next.updatedAt = Date.now();
    dataRef.current = next; setData(next); persist(next);
    if (opts?.toast) showToast(opts.toast, opts.undoable ? prev : undefined);
  }, [persist, showToast]);
  const replace = useCallback((d: AppData, t?: string) => { const prev = dataRef.current; dataRef.current = d; setData(d); persist(d); if (t) showToast(t, prev); }, [persist, showToast]);
  const undo = useCallback(() => { setToast((t) => { if (t?.undo) { const u = t.undo; dataRef.current = u; setData(u); persist(u); } return null; }); }, [persist]);
  const resetDemo = useCallback(() => {
    const fresh = buildDemoData(todayISO());
    fresh.settings.theme = dataRef.current.settings.theme;
    replace(fresh, 'Demo data has been reset.');
  }, [replace]);
  const clearAll = useCallback(async () => {
    await clearData(); const e = emptyData(); e.settings.theme = dataRef.current.settings.theme;
    dataRef.current = e; setData(e); await saveData(e); showToast('All data was removed from this device.');
  }, [showToast]);

  const value = useMemo<Ctx>(() => ({
    data, today, ready, update, replace, resetDemo, clearAll,
    money: (c: number) => formatMoney(c, data.settings.currency),
    date: (s?: string, y = true) => formatDate(s, data.settings.dateFormat, y),
    toast, showToast, dismissToast: () => setToast(null), undo,
    quick, openQuick: (kind, editId, preset) => setQuick({ kind, editId, preset }), closeQuick: () => setQuick(null), saveError,
  }), [data, today, ready, update, replace, resetDemo, clearAll, toast, showToast, undo, quick, saveError]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
