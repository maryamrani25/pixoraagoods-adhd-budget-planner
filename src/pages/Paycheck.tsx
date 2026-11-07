import React, { useMemo, useState } from 'react';
import { LuBanknote, LuPlus, LuTrash2, LuWandSparkles, LuCheck, LuPiggyBank } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, Badge, EmptyState, IconButton, Field, inputCls, MoneyInput, Notice, cx } from '../components/ui';
import { expectedPaychecks, allocationSummary, billOccurrences } from '../lib/calc';
import { addDays, friendlyDate } from '../lib/dates';
import { parseMoney, sum } from '../lib/money';
import { uid } from '../lib/defaults';
import { addTx } from '../lib/actions';
import type { Allocation } from '../lib/types';

const KIND_COLORS: Record<Allocation['kind'], string> = { bill: '#765477', savings: '#648A72', category: '#D6B68F', debt: '#C86F78', other: '#827B88' };
const KIND_LABEL: Record<Allocation['kind'], string> = { bill: 'Bill', savings: 'Savings', category: 'Spending', debt: 'Debt', other: 'Other' };

export default function Paycheck() {
  const { data, today, money, openQuick, update } = useStore();
  const expected = expectedPaychecks(data, today, addDays(today, 45)).filter((p) => !p.received);
  const received = data.transactions.filter((t) => t.type === 'income' && t.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const options = useMemo(() => [
    ...received.slice(0, 6).map((t) => ({ key: t.id, label: `${t.name} · ${friendlyDate(t.date, today)}`, amount: t.amount, date: t.date, status: 'received' as const })),
    ...expected.slice(0, 4).map((p) => ({ key: `exp:${p.source.id}:${p.date}`, label: `${p.source.name} · ${friendlyDate(p.date, today)}`, amount: p.source.amount, date: p.date, status: 'expected' as const })),
  ], [data, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState(options[0]?.key ?? '');
  const current = options.find((o) => o.key === sel) ?? options[0];

  return (
    <div>
      <PageHeader title="Paycheck Planner" subtitle="Give each paycheck a plan: bills first, then savings, then spending. Expected money is planned, but never counted as cash until it arrives."
        actions={<Button icon={<LuPlus aria-hidden />} onClick={() => openQuick('income')}>Record a paycheck</Button>} />

      {data.incomeSources.length === 0 && received.length === 0 ? (
        <Card><EmptyState icon={<LuBanknote />} title="No paychecks yet" text="Add your pay schedule on the Income page, or record a paycheck you've received." action={<Button onClick={() => (location.hash = '#/income')}>Add pay schedule</Button>} /></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.5fr]">
          <div className="grid content-start gap-5">
            <Card title="Choose a paycheck to plan">
              <ul className="grid gap-2" role="radiogroup" aria-label="Paychecks">
                {options.map((o) => (
                  <li key={o.key}>
                    <button role="radio" aria-checked={current?.key === o.key} onClick={() => setSel(o.key)} className={cx('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition', current?.key === o.key ? 'border-mauve bg-mauve/10' : 'border-line hover:bg-surface-2')}>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium text-ink">{o.label}</span><span className="num text-sm text-muted">{money(o.amount)}</span></span>
                      {o.status === 'received' ? <Badge tone="success">Received</Badge> : <Badge tone="gold">Expected</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Coming up" subtitle="Expected in the next 45 days">
              {expected.length === 0 ? <p className="text-sm text-muted">No expected paychecks. Add a pay schedule on the Income page.</p> : (
                <ul className="divide-y divide-line">
                  {expected.map((p) => (
                    <li key={p.source.id + p.date} className="flex items-center gap-3 py-2.5">
                      <div className="flex-1"><p className="font-medium text-ink">{p.source.name}</p><p className="text-xs text-muted">{friendlyDate(p.date, today)} · not received yet</p></div>
                      <span className="num text-muted">{money(p.source.amount)}</span>
                      {p.date <= today && <Button size="sm" variant="secondary" onClick={() => openQuick('income', undefined, { sourceId: p.source.id, date: p.date })}>Mark received</Button>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">Got paid early or a different amount? Use "Record a paycheck" and link it to the source.</p>
            </Card>
          </div>
          {current && <AllocationPanel k={current.key} amount={current.amount} date={current.date} status={current.status} />}
        </div>
      )}

      <Card className="mt-5" title="Paycheck history">
        {received.length === 0 ? <p className="text-sm text-muted">Paychecks you record will be listed here.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs tracking-wide text-muted uppercase"><th className="py-2 font-medium">Date</th><th className="font-medium">Source</th><th className="text-right font-medium">Amount</th><th className="text-right font-medium">Planned</th><th className="text-right font-medium">Unplanned</th></tr></thead>
            <tbody className="divide-y divide-line">
              {received.slice(0, 24).map((t) => { const a = allocationSummary(data, t.id, t.amount); return (
                <tr key={t.id}><td className="py-2.5">{friendlyDate(t.date, today)}</td><td>{t.name}</td><td className="num text-right">{money(t.amount)}</td><td className="num text-right">{money(a.allocated)}</td><td className={cx('num text-right', a.unallocated < 0 ? 'text-danger' : 'text-muted')}>{money(a.unallocated)}</td></tr>); })}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}

function AllocationPanel({ k, amount, date, status }: { k: string; amount: number; date: string; status: 'received' | 'expected' }) {
  const { data, today, money, update } = useStore();
  const { allocations, allocated, unallocated } = allocationSummary(data, k, amount);
  const [kind, setKind] = useState<Allocation['kind']>('bill');
  const [ref, setRef] = useState('');
  const [label, setLabel] = useState('');
  const [amt, setAmt] = useState('');
  const [err, setErr] = useState('');
  const nextPay = expectedPaychecks(data, addDays(date, 1), addDays(date, 45))[0]?.date ?? addDays(date, 14);
  const dueBefore = billOccurrences(data, date, addDays(nextPay, -1)).filter((o) => !allocations.some((a) => a.kind === 'bill' && a.refId === o.bill.id));

  const refOptions = kind === 'bill' ? data.bills.map((b) => ({ id: b.id, name: b.name, amount: b.amount })) : kind === 'savings' ? data.goals.map((g) => ({ id: g.id, name: g.name, amount: g.monthlyPlan })) : kind === 'category' ? data.categories.map((c) => ({ id: c.id, name: c.name, amount: 0 })) : kind === 'debt' ? data.debts.map((d) => ({ id: d.id, name: d.name, amount: d.minimumPayment })) : [];
  const setPlan = (fn: (a: Allocation[]) => Allocation[]) => update((d) => {
    const i = d.paycheckPlans.findIndex((p) => p.key === k);
    const next = fn(i >= 0 ? d.paycheckPlans[i].allocations : []);
    if (i >= 0) d.paycheckPlans[i].allocations = next; else d.paycheckPlans.push({ key: k, allocations: next });
  });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseMoney(amt);
    if (c === null || c <= 0) return setErr('Enter an amount above zero.');
    const opt = refOptions.find((o) => o.id === ref);
    if (kind !== 'other' && !opt) return setErr('Choose what this money is for.');
    if (kind === 'other' && !label.trim()) return setErr('Give it a short name.');
    setErr('');
    setPlan((a) => [...a, { id: uid(), kind, refId: opt?.id, label: opt?.name ?? label.trim(), amount: c }]);
    setAmt(''); setLabel(''); setRef('');
  };
  const fillBills = () => setPlan((a) => [...a, ...dueBefore.map((o) => ({ id: uid(), kind: (o.bill.linkedDebtId ? 'debt' : 'bill') as Allocation['kind'], refId: o.bill.linkedDebtId ?? o.bill.id, label: o.bill.name, amount: o.bill.amount }))]);
  const moved = (a: Allocation) => data.transactions.some((t) => t.type === 'savings' && t.affectsCash && t.direction !== 'out' && (t.notes === `paycheck:${k}:${a.id}` || (t.goalId === a.refId && t.amount === a.amount && t.date >= date && t.date <= addDays(date, 5))));
  const moveNow = (a: Allocation) => update((d) => { addTx(d, { type: 'savings', name: `Move to ${a.label}`, amount: a.amount, date: today, goalId: a.refId, direction: 'in', affectsCash: true, notes: `paycheck:${k}:${a.id}` }); }, { toast: `${money(a.amount)} moved to ${a.label}.`, undoable: true });

  return (
    <Card title={status === 'received' ? 'Plan this paycheck' : 'Plan ahead (expected paycheck)'} subtitle={`${money(amount)} · ${friendlyDate(date, today)}`}>
      {status === 'expected' && <div className="mb-4"><Notice tone="warning">This money hasn't arrived yet. Planning is fine, but it's not included in your Safe-to-Spend until you mark it received.</Notice></div>}
      {/* allocation bar */}
      <div className="mb-2 flex h-4 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${money(allocated)} planned, ${money(unallocated)} not planned yet`}>
        {allocations.map((a) => <div key={a.id} title={`${a.label}: ${money(a.amount)}`} style={{ width: `${Math.min(100, (a.amount / Math.max(amount, allocated)) * 100)}%`, background: KIND_COLORS[a.kind] }} />)}
      </div>
      <div className="mb-5 flex flex-wrap justify-between gap-2 text-sm">
        <span className="text-muted">Planned <b className="num text-ink">{money(allocated)}</b></span>
        <span className={unallocated < 0 ? 'text-danger' : unallocated === 0 ? 'text-success' : 'text-muted'}>
          {unallocated === 0 ? <><LuCheck aria-hidden className="mr-1 inline" />Every dollar has a job</> : unallocated > 0 ? <>Not planned yet <b className="num">{money(unallocated)}</b></> : <>Planned {money(-unallocated)} more than this paycheck</>}
        </span>
      </div>
      {dueBefore.length > 0 && (
        <button onClick={fillBills} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-mauve/60 p-3 text-left text-sm hover:bg-mauve/5">
          <LuWandSparkles aria-hidden className="text-lg text-mauve" />
          <span><b className="text-ink">Add {dueBefore.length} bill{dueBefore.length === 1 ? '' : 's'} due before your next paycheck</b><br /><span className="text-muted">{dueBefore.map((o) => o.bill.name).join(', ')} · {money(sum(dueBefore.map((o) => o.bill.amount)))}</span></span>
        </button>
      )}
      {allocations.length === 0 ? <p className="mb-4 text-sm text-muted">No plan yet. Start with the bills, then add savings and spending.</p> : (
        <ul className="mb-5 divide-y divide-line">
          {allocations.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: KIND_COLORS[a.kind] }} aria-hidden />
              <span className="min-w-0 flex-1"><span className="block truncate text-ink">{a.label}</span><span className="text-xs text-muted">{KIND_LABEL[a.kind]}</span></span>
              {a.kind === 'savings' && status === 'received' && (moved(a) ? <Badge tone="success">Moved</Badge> : <Button size="sm" variant="secondary" icon={<LuPiggyBank aria-hidden />} onClick={() => moveNow(a)}>Move now</Button>)}
              <span className="num w-24 text-right">{money(a.amount)}</span>
              <IconButton label={`Remove ${a.label}`} onClick={() => setPlan((x) => x.filter((y) => y.id !== a.id))}><LuTrash2 aria-hidden /></IconButton>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-3 rounded-2xl bg-surface-2 p-4" noValidate>
        <p className="text-sm font-medium text-ink">Add to the plan</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="For" htmlFor="al-kind"><select id="al-kind" className={inputCls} value={kind} onChange={(e) => { setKind(e.target.value as Allocation['kind']); setRef(''); }}>
            <option value="bill">A bill</option><option value="savings">Savings</option><option value="category">Spending category</option><option value="debt">Debt payment</option><option value="other">Something else</option></select></Field>
          {kind === 'other' ? <Field label="Name" htmlFor="al-label"><input id="al-label" className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} /></Field> : (
            <Field label="Which one" htmlFor="al-ref"><select id="al-ref" className={inputCls} value={ref} onChange={(e) => { setRef(e.target.value); const o = refOptions.find((x) => x.id === e.target.value); if (o?.amount && !amt) setAmt((o.amount / 100).toFixed(2)); }}>
              <option value="">Choose…</option>{refOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          )}
          <Field label="Amount" htmlFor="al-amt"><MoneyInput id="al-amt" value={amt} onChange={setAmt} currency={data.settings.currency} /></Field>
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" icon={<LuPlus aria-hidden />}>Add</Button>
          {unallocated > 0 && <Button size="sm" variant="secondary" onClick={() => setAmt((unallocated / 100).toFixed(2))}>Use the rest ({money(unallocated)})</Button>}
        </div>
      </form>
      <p className="mt-3 text-xs text-muted">A plan is a guide, it doesn't move money. Use "Move now" for savings, and mark bills paid on the Bills page when you pay them.</p>
    </Card>
  );
}
