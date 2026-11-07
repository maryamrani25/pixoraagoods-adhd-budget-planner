import React, { useMemo, useState } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuSearch, LuReceipt, LuDownload } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, EmptyState, IconButton, inputCls, confirmAction, Badge, Stat } from '../components/ui';
import { DonutChart } from '../components/charts';
import { currentMonthKey, rangeOfMonth, categorySpend } from '../lib/calc';
import { addDays, friendlyDate, shiftMonthKey } from '../lib/dates';
import { sum } from '../lib/money';
import { deleteTx } from '../lib/actions';
import { transactionsCSV, download } from '../lib/backup';
import { PAYMENT_METHODS } from '../lib/defaults';

type Preset = 'this' | 'last' | '30' | 'all' | 'custom';

export default function Expenses() {
  const { data, today, money, openQuick, update, date } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [method, setMethod] = useState('');
  const [preset, setPreset] = useState<Preset>('this');
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const key = currentMonthKey(data, today);
  const range = useMemo(() => {
    if (preset === 'this') return rangeOfMonth(data, key);
    if (preset === 'last') return rangeOfMonth(data, shiftMonthKey(key, -1));
    if (preset === '30') return { from: addDays(today, -29), to: today };
    if (preset === 'all') return { from: '0000-01-01', to: '9999-12-31' };
    return { from, to };
  }, [preset, from, to, key, data, today]);
  const catName = (id?: string) => data.categories.find((c) => c.id === id)?.name ?? 'Other';
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.transactions.filter((t) => t.type === 'expense' && t.date >= range.from && t.date <= range.to
      && (!cat || (t.categoryId || 'other') === cat) && (!method || t.paymentMethod === method)
      && (!term || t.name.toLowerCase().includes(term) || (t.notes ?? '').toLowerCase().includes(term) || catName(t.categoryId).toLowerCase().includes(term)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [data, q, cat, method, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = sum(list.map((t) => t.amount));
  const groups = useMemo(() => { const g: Record<string, typeof list> = {}; for (const t of list) (g[t.date] ||= []).push(t); return Object.entries(g); }, [list]);
  const byCat = categorySpend({ ...data, transactions: list }, range.from, range.to);
  const filtered = q || cat || method;

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Every expense you log, in one place. Quick to add, easy to find."
        actions={<><Button variant="secondary" icon={<LuDownload aria-hidden />} onClick={() => download(`expenses-${today}.csv`, transactionsCSV({ ...data, transactions: list }), 'text/csv')} disabled={!list.length}>Export CSV</Button><Button icon={<LuPlus aria-hidden />} onClick={() => openQuick('expense')}>Add expense</Button></>} />

      <Card className="mb-5" padded>
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <label className="relative"><span className="sr-only">Search expenses</span><LuSearch aria-hidden className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <input type="search" className={inputCls + ' pl-10'} placeholder="Search name, note or category" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <select aria-label="Filter by category" className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label="Filter by payment method" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All payment methods</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          <select aria-label="Date range" className={inputCls} value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            <option value="this">This month</option><option value="last">Last month</option><option value="30">Last 30 days</option><option value="all">All time</option><option value="custom">Custom dates…</option></select>
        </div>
        {preset === 'custom' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">From <input type="date" className={inputCls + ' w-auto'} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="flex items-center gap-2">To <input type="date" className={inputCls + ' w-auto'} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        )}
        {filtered && <button className="mt-3 text-sm font-medium text-mauve hover:underline" onClick={() => { setQ(''); setCat(''); setMethod(''); }}>Clear filters</button>}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <p className="text-sm text-muted"><b className="text-ink">{list.length}</b> expense{list.length === 1 ? '' : 's'}</p>
            <p className="num font-semibold">{money(total)}</p>
          </div>
          {list.length === 0 ? (
            <EmptyState icon={<LuReceipt />} title={filtered ? 'No expenses match these filters' : 'No expenses here yet'} text={filtered ? 'Try clearing a filter or choosing a wider date range.' : 'Tap "Add expense" to log your first one. It only takes a few seconds.'}
              action={!filtered ? <Button onClick={() => openQuick('expense')} icon={<LuPlus aria-hidden />}>Add expense</Button> : undefined} />
          ) : (
            <div>
              {groups.map(([d, items]) => (
                <section key={d} aria-label={friendlyDate(d, today)}>
                  <h3 className="flex justify-between bg-surface-2/60 px-5 py-1.5 text-xs font-medium text-muted sm:px-6"><span>{friendlyDate(d, today)} · {date(d)}</span><span className="num">{money(sum(items.map((t) => t.amount)))}</span></h3>
                  <ul className="divide-y divide-line">
                    {items.map((t) => {
                      const c = data.categories.find((x) => x.id === (t.categoryId || 'other'));
                      return (
                        <li key={t.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                          <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: c?.color ?? '#827B88' }} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-ink">{t.name}</p>
                            <p className="truncate text-xs text-muted">{c?.name ?? 'Other'}{t.paymentMethod ? ` · ${t.paymentMethod}` : ''}{t.notes ? ` · ${t.notes}` : ''}</p>
                          </div>
                          {t.billId && <Badge tone="mauve">Bill</Badge>}
                          <span className="num w-24 text-right font-medium">{money(t.amount)}</span>
                          <IconButton label={`Edit ${t.name}`} onClick={() => openQuick('expense', t.id)}><LuPencil aria-hidden /></IconButton>
                          <IconButton label={`Delete ${t.name}`} onClick={async () => { if (await confirmAction({ title: 'Delete this expense?', message: `"${t.name}" (${money(t.amount)}) will be removed.${t.billId ? ' The bill will show as unpaid again.' : ''}`, confirmLabel: 'Delete', danger: true })) update((dd) => deleteTx(dd, t.id), { toast: 'Expense deleted.', undoable: true }); }}><LuTrash2 aria-hidden /></IconButton>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
        <div className="grid content-start gap-5">
          <Stat label="Average per expense" value={list.length ? money(Math.round(total / list.length)) : '—'} />
          <Card title="By category" subtitle="For the expenses shown">
            <DonutChart label="Spending by category" format={money} data={data.categories.map((c) => ({ name: c.name, value: byCat[c.id] || 0, color: c.color }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}
