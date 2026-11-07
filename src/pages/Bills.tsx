import React, { useMemo, useState } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuChevronLeft, LuChevronRight, LuCheck, LuUndo2, LuCalendarDays, LuPause, LuPlay, LuBell } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, EmptyState, IconButton, confirmAction, Badge, Notice, cx } from '../components/ui';
import { billOccurrences, expectedPaychecks, overdueBills } from '../lib/calc';
import { addDays, friendlyDate, daysInMonth, toISO, monthLabel, freqLabel, diffDays, occurrences, parseISO } from '../lib/dates';
import { markBillPaid, unmarkBillPaid, deleteBill } from '../lib/actions';
import { sum } from '../lib/money';

type Ev = { date: string; label: string; kind: 'bill' | 'paid' | 'overdue' | 'payday' | 'savings' | 'debt'; amount: number };

export default function Bills() {
  const { data, today, money, openQuick, update } = useStore();
  const t = parseISO(today);
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const [sel, setSel] = useState<string>(today);
  const first = toISO(new Date(ym.y, ym.m, 1, 12));
  const last = toISO(new Date(ym.y, ym.m, daysInMonth(ym.y, ym.m), 12));
  const key = first.slice(0, 7);

  const events = useMemo(() => {
    const ev: Ev[] = [];
    for (const o of billOccurrences(data, first, last)) ev.push({ date: o.due, label: o.bill.name, amount: o.bill.amount, kind: o.paidTx ? 'paid' : o.due < today ? 'overdue' : 'bill' });
    for (const p of expectedPaychecks(data, first, last)) ev.push({ date: p.date, label: `Payday: ${p.source.name}`, amount: p.received?.amount ?? p.source.amount, kind: 'payday' });
    for (const g of data.goals) if (g.monthlyPlan > 0 && g.contributionDay) for (const d of occurrences(toISO(new Date(ym.y, ym.m, Math.min(g.contributionDay, daysInMonth(ym.y, ym.m)), 12)), 'once', first, last)) ev.push({ date: d, label: `Savings: ${g.name}`, amount: g.monthlyPlan, kind: 'savings' });
    const linked = new Set(data.bills.filter((b) => b.linkedDebtId).map((b) => b.linkedDebtId));
    for (const d of data.debts) if (!linked.has(d.id) && d.minimumPayment > 0) ev.push({ date: toISO(new Date(ym.y, ym.m, Math.min(d.dueDay, daysInMonth(ym.y, ym.m)), 12)), label: `${d.name} minimum`, amount: d.minimumPayment, kind: 'debt' });
    return ev;
  }, [data, first, last, today, ym]);
  const byDay = useMemo(() => { const m: Record<string, Ev[]> = {}; for (const e of events) (m[e.date] ||= []).push(e); return m; }, [events]);
  const startPad = new Date(ym.y, ym.m, 1).getDay();
  const cells: (string | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth(ym.y, ym.m) }, (_, i) => toISO(new Date(ym.y, ym.m, i + 1, 12)))];
  while (cells.length % 7) cells.push(null);
  const move = (n: number) => { const d = new Date(ym.y, ym.m + n, 1); setYm({ y: d.getFullYear(), m: d.getMonth() }); };
  const overdue = overdueBills(data, today);
  const upcoming = billOccurrences(data, today, addDays(today, 30));
  const dot: Record<Ev['kind'], string> = { bill: 'bg-mauve', paid: 'bg-success', overdue: 'bg-danger', payday: 'bg-gold', savings: 'bg-success', debt: 'bg-warning' };

  const pay = (bId: string, due: string) => { const b = data.bills.find((x) => x.id === bId)!; update((d) => markBillPaid(d, b, due, due > today ? today : today), { toast: `${b.name} marked as paid.`, undoable: true }); };
  const unpay = (bId: string, due: string) => update((d) => unmarkBillPaid(d, bId, due), { toast: 'Marked as unpaid.', undoable: true });

  return (
    <div>
      <PageHeader title="Bills & Calendar" subtitle="See what's due and when money arrives. Bills are only marked paid when you say so."
        actions={<Button icon={<LuPlus aria-hidden />} onClick={() => openQuick('bill')}>Add bill</Button>} />
      {overdue.length > 0 && <div className="mb-5"><Notice tone="danger"><b>{overdue.length} bill{overdue.length === 1 ? ' is' : 's are'} past the due date</b> ({money(sum(overdue.map((o) => o.bill.amount)))}). If you've paid, mark them paid. If not, that's okay: decide on one day to deal with it.</Notice></div>}

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <IconButton label="Previous month" onClick={() => move(-1)}><LuChevronLeft aria-hidden /></IconButton>
            <h2 className="font-serif text-xl">{monthLabel(key)}</h2>
            <IconButton label="Next month" onClick={() => move(1)}><LuChevronRight aria-hidden /></IconButton>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted" aria-hidden>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Calendar for ${monthLabel(key)}`}>
            {cells.map((d, i) => d === null ? <div key={'x' + i} /> : (
              <button key={d} onClick={() => setSel(d)} aria-pressed={sel === d} aria-label={`${friendlyDate(d, today)}: ${(byDay[d] || []).map((e) => e.label).join(', ') || 'nothing scheduled'}`}
                className={cx('flex min-h-14 flex-col items-center rounded-xl border p-1 text-sm transition sm:min-h-20 sm:items-start sm:p-2', sel === d ? 'border-mauve bg-mauve/10' : 'border-transparent hover:bg-surface-2', d === today && 'ring-2 ring-gold')}>
                <span className={cx('num', d === today ? 'font-bold text-ink' : 'text-ink')}>{Number(d.slice(8))}</span>
                <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">{(byDay[d] || []).slice(0, 4).map((e, j) => <span key={j} className={cx('h-1.5 w-1.5 rounded-full', dot[e.kind])} />)}</span>
                <span className="mt-1 hidden w-full flex-col gap-0.5 sm:flex">{(byDay[d] || []).slice(0, 2).map((e, j) => <span key={j} className="flex items-center gap-1 truncate text-left text-[11px] text-muted"><span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', dot[e.kind])} />{e.label.replace('Payday: ', '')}</span>)}{(byDay[d] || []).length > 2 && <span className="text-[11px] text-muted">+{byDay[d].length - 2} more</span>}</span>
              </button>
            ))}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {[['bg-mauve', 'Bill due'], ['bg-success', 'Paid / savings'], ['bg-danger', 'Past due'], ['bg-gold', 'Payday'], ['bg-warning', 'Debt minimum']].map(([c, l]) => <li key={l} className="flex items-center gap-1.5"><span className={cx('h-2 w-2 rounded-full', c)} />{l}</li>)}
          </ul>
          <div className="mt-5 rounded-2xl bg-surface-2 p-4">
            <p className="mb-2 font-medium text-ink">{friendlyDate(sel, today)}</p>
            {(byDay[sel] || []).length === 0 ? <p className="text-sm text-muted">Nothing scheduled.</p> : (
              <ul className="grid gap-1.5 text-sm">{byDay[sel].map((e, i) => <li key={i} className="flex justify-between gap-2"><span className="flex items-center gap-2"><span className={cx('h-2 w-2 rounded-full', dot[e.kind])} />{e.label}{e.kind === 'paid' && <Badge tone="success">Paid</Badge>}{e.kind === 'overdue' && <Badge tone="danger">Past due</Badge>}</span><span className="num text-muted">{money(e.amount)}</span></li>)}</ul>
            )}
          </div>
        </Card>

        <div className="grid content-start gap-5">
          <Card title="Next 30 days" subtitle={data.settings.remindersEnabled ? `Bills due within ${data.settings.reminderDays} days are marked "Soon".` : undefined}>
            {overdue.length + upcoming.length === 0 ? <EmptyState icon={<LuCalendarDays />} title="No bills in the next 30 days" text="Add your regular bills so they're set aside automatically." /> : (
              <ul className="divide-y divide-line">
                {[...overdue, ...upcoming].map((o) => {
                  const n = diffDays(today, o.due); const late = !o.paidTx && o.due < today;
                  return (
                    <li key={o.bill.id + o.due} className={cx('flex items-center gap-3 py-2.5', o.paidTx && 'opacity-70')}>
                      <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{o.bill.name}</p><p className="text-xs text-muted">{friendlyDate(o.due, today)}</p></div>
                      {o.paidTx ? <Badge tone="success">Paid</Badge> : late ? <Badge tone="danger">Past due</Badge> : n <= Math.max(o.bill.reminderDays, 0) && data.settings.remindersEnabled ? <Badge tone="warning"><LuBell aria-hidden />Soon</Badge> : null}
                      <span className="num w-20 text-right">{money(o.bill.amount)}</span>
                      {o.paidTx ? <IconButton label={`Mark ${o.bill.name} unpaid`} onClick={() => unpay(o.bill.id, o.due)}><LuUndo2 aria-hidden /></IconButton>
                        : <Button size="sm" variant="secondary" aria-label={`Mark ${o.bill.name} due ${o.due} as paid`} onClick={() => pay(o.bill.id, o.due)}><LuCheck aria-hidden /> Paid</Button>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="All bills" subtitle={`${data.bills.filter((b) => b.active).length} active`}>
            {data.bills.length === 0 ? <p className="text-sm text-muted">No bills yet.</p> : (
              <ul className="divide-y divide-line">
                {data.bills.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{b.name} {!b.active && <Badge>Paused</Badge>}</p><p className="text-xs text-muted">{freqLabel[b.frequency]}{b.linkedDebtId ? ' · debt payment' : ''}</p></div>
                    <span className="num text-sm">{money(b.amount)}</span>
                    <IconButton label={b.active ? `Pause ${b.name}` : `Resume ${b.name}`} onClick={() => update((d) => { const x = d.bills.find((y) => y.id === b.id)!; x.active = !x.active; }, { toast: b.active ? 'Bill paused.' : 'Bill resumed.' })}>{b.active ? <LuPause aria-hidden /> : <LuPlay aria-hidden />}</IconButton>
                    <IconButton label={`Edit ${b.name}`} onClick={() => openQuick('bill', b.id)}><LuPencil aria-hidden /></IconButton>
                    <IconButton label={`Delete ${b.name}`} onClick={async () => { if (await confirmAction({ title: `Delete "${b.name}"?`, message: 'The bill and its future due dates will be removed. Payments you already recorded stay in your history.', confirmLabel: 'Delete', danger: true })) update((d) => deleteBill(d, b.id), { toast: 'Bill deleted.', undoable: true }); }}><LuTrash2 aria-hidden /></IconButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="text-xs text-muted">Reminders appear inside the app. The app doesn't send phone or email notifications.</p>
        </div>
      </div>
    </div>
  );
}
