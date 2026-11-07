import React, { useState } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuCreditCard, LuHistory, LuInfo } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, EmptyState, IconButton, confirmAction, Modal, Field, MoneyInput, inputCls, ProgressBar, Stat, Segmented, Notice, cx } from '../components/ui';
import { debtBalance, totalDebt, payoffEstimate, debtPayments, debtOrder } from '../lib/calc';
import { parseMoney, centsToInput, sum } from '../lib/money';
import { isValidISO, addMonths, monthLabel } from '../lib/dates';
import { addTx, deleteDebt, deleteTx } from '../lib/actions';
import { uid } from '../lib/defaults';
import type { Debt as DebtT } from '../lib/types';

export default function Debt() {
  const { data, today, money, update, date } = useStore();
  const [modal, setModal] = useState<DebtT | 'new' | null>(null);
  const [payFor, setPayFor] = useState<{ debt: DebtT; action: 'payment' | 'charge' } | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const [method, setMethod] = useState<'snowball' | 'avalanche'>('snowball');
  const total = totalDebt(data);
  const original = sum(data.debts.map((d) => d.originalBalance));
  const paidAll = sum(data.transactions.filter((t) => t.type === 'debt' && t.debtAction !== 'charge').map((t) => t.amount));
  return (
    <div>
      <PageHeader title="Debt Tracker" subtitle="See every balance clearly and watch it shrink. Every payment counts."
        actions={<Button icon={<LuPlus aria-hidden />} onClick={() => setModal('new')}>Add debt</Button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total outstanding" value={money(total)} />
        <Stat label="Paid off so far" value={original ? `${Math.round(((original - total) / original) * 100)}%` : '—'} hint={original ? `${money(Math.max(0, original - total))} of ${money(original)}` : undefined} tone="success" />
        <Stat label="Monthly minimums" value={money(sum(data.debts.filter((d) => debtBalance(data, d) > 0).map((d) => d.minimumPayment)))} />
        <Stat label="Payments recorded" value={money(paidAll)} />
      </div>
      {data.debts.length === 0 ? <Card><EmptyState icon={<LuCreditCard />} title="No debts added" text="If you have credit cards or loans, add them here. Seeing the number clearly is a brave first step." action={<Button onClick={() => setModal('new')}>Add a debt</Button>} /></Card> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.debts.map((d) => {
            const bal = debtBalance(data, d);
            const est = payoffEstimate(bal, d.interestRate, d.minimumPayment);
            const payments = debtPayments(data, d.id);
            return (
              <Card key={d.id}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div><h2 className="text-[17px] font-semibold">{d.name}</h2><p className="text-sm text-muted">{d.interestRate ? `${d.interestRate}% APR · ` : ''}min. {money(d.minimumPayment)} · due day {d.dueDay}</p></div>
                  <div className="flex"><IconButton label={`Edit ${d.name}`} onClick={() => setModal(d)}><LuPencil aria-hidden /></IconButton>
                    <IconButton label={`Delete ${d.name}`} onClick={async () => { if (await confirmAction({ title: `Delete "${d.name}"?`, message: 'The debt and its payment history will be removed from this planner.', confirmLabel: 'Delete', danger: true })) update((x) => deleteDebt(x, d.id), { toast: 'Debt deleted.', undoable: true }); }}><LuTrash2 aria-hidden /></IconButton></div>
                </div>
                <div className="flex items-end justify-between gap-4"><p className="num font-serif text-3xl">{money(bal)}</p><p className="text-sm text-muted">of {money(d.originalBalance)} original</p></div>
                <div className="mt-3"><ProgressBar value={d.originalBalance - bal} max={d.originalBalance} tone="gold" label={`${d.name} paid off`} /></div>
                <p className="mt-2 text-sm text-muted">{bal <= 0 ? '🎉 Paid off. Well done.' : est ? `At the minimum payment: about ${est.months} month${est.months === 1 ? '' : 's'} (around ${monthLabel(addMonths(today, est.months).slice(0, 7))})${d.interestRate ? `, ~${money(est.interest)} interest` : ''}. Estimate only.` : 'The minimum payment may not cover the interest, so the balance may not go down. Consider checking with your lender.'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setPayFor({ debt: d, action: 'payment' })} disabled={bal <= 0}>Record payment</Button>
                  <Button size="sm" variant="secondary" onClick={() => setPayFor({ debt: d, action: 'charge' })}>Add interest / charge</Button>
                  <Button size="sm" variant="ghost" icon={<LuHistory aria-hidden />} aria-expanded={hist === d.id} onClick={() => setHist(hist === d.id ? null : d.id)}>History ({payments.length})</Button>
                </div>
                {hist === d.id && (
                  <ul className="mt-3 max-h-64 divide-y divide-line overflow-y-auto border-t border-line text-sm">
                    {payments.length === 0 && <li className="py-2 text-muted">No payments recorded yet.</li>}
                    {payments.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 py-2"><span className="flex-1">{date(t.date)}<span className="block text-xs text-muted">{t.debtAction === 'charge' ? 'Interest / charge' : t.billId ? 'Payment (from bill)' : 'Payment'}</span></span>
                        <span className={cx('num', t.debtAction === 'charge' ? 'text-danger' : 'text-success')}>{t.debtAction === 'charge' ? '+' : '−'}{money(t.amount)}</span>
                        <IconButton label="Delete entry" onClick={async () => { if (await confirmAction({ title: 'Remove this entry?', message: `${money(t.amount)} on ${date(t.date)} will be removed.`, confirmLabel: 'Remove', danger: true })) update((x) => deleteTx(x, t.id), { toast: 'Entry removed.', undoable: true }); }}><LuTrash2 aria-hidden /></IconButton></li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-5" title="Payoff methods, explained" subtitle="Educational only. This is not personalised financial advice.">
        <Segmented label="Payoff method" value={method} onChange={setMethod} options={[{ value: 'snowball', label: 'Debt Snowball' }, { value: 'avalanche', label: 'Debt Avalanche' }]} />
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div className="text-[15px] leading-relaxed text-ink">
            {method === 'snowball' ? <>
              <p><b>Snowball:</b> pay the minimum on everything, then put any extra money toward the <b>smallest balance</b> first. When it's gone, roll that payment into the next smallest.</p>
              <p className="mt-2 text-muted">Why people like it: quick wins feel motivating, which helps you keep going.</p>
            </> : <>
              <p><b>Avalanche:</b> pay the minimum on everything, then put any extra money toward the <b>highest interest rate</b> first.</p>
              <p className="mt-2 text-muted">Why people like it: it usually costs less interest overall, though the first win can take longer.</p>
            </>}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Your debts in {method} order</p>
            {debtOrder(data, method).length === 0 ? <p className="text-sm text-muted">Add debts to see the order.</p> : (
              <ol className="grid gap-1.5 text-sm">{debtOrder(data, method).map((x, i) => <li key={x.debt.id} className="flex justify-between rounded-xl bg-surface-2 px-3 py-2"><span>{i + 1}. {x.debt.name}</span><span className="num text-muted">{money(x.balance)} · {x.debt.interestRate}%</span></li>)}</ol>
            )}
          </div>
        </div>
        <div className="mt-4"><Notice icon={<LuInfo aria-hidden className="mt-0.5 shrink-0" />}>Both methods work best when you keep paying every minimum on time. For advice about your situation, talk to a qualified financial counsellor.</Notice></div>
      </Card>
      {modal && <DebtModal debt={modal === 'new' ? null : modal} onClose={() => setModal(null)} />}
      {payFor && <PaymentModal debt={payFor.debt} action={payFor.action} onClose={() => setPayFor(null)} />}
    </div>
  );
}

function DebtModal({ debt, onClose }: { debt: DebtT | null; onClose: () => void }) {
  const { data, update } = useStore();
  const bal = debt ? debtBalance(data, debt) : 0;
  const [name, setName] = useState(debt?.name ?? '');
  const [original, setOriginal] = useState(centsToInput(debt?.originalBalance));
  const [current, setCurrent] = useState(centsToInput(debt ? bal : undefined));
  const [apr, setApr] = useState(String(debt?.interestRate ?? ''));
  const [min, setMin] = useState(centsToInput(debt?.minimumPayment));
  const [day, setDay] = useState(String(debt?.dueDay ?? '1'));
  const [err, setErr] = useState<Record<string, string>>({});
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const o = parseMoney(original); const c = parseMoney(current); const m = min.trim() ? parseMoney(min) : 0; const a = apr.trim() ? Number(apr) : 0; const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Give it a name, like "Visa card".';
    if (c === null || c < 0) errors.current = 'Enter the current balance.';
    if (o === null || o <= 0) errors.original = 'Enter the starting balance (use the current balance if unsure).';
    if (o !== null && c !== null && c > o) errors.original = 'The original balance should be at least the current balance.';
    if (!Number.isFinite(a) || a < 0 || a > 100) errors.apr = 'Enter a rate between 0 and 100.';
    if (m === null || m < 0) errors.min = 'Enter the minimum payment or leave empty.';
    setErr(errors); if (Object.keys(errors).length) return;
    update((d) => {
      const rec = { name: name.trim(), originalBalance: o!, interestRate: a, minimumPayment: m || 0, dueDay: Math.min(31, Math.max(1, Number(day) || 1)) };
      if (debt) { const i = d.debts.findIndex((x) => x.id === debt.id); const x = d.debts[i]; d.debts[i] = { ...x, ...rec, startBalance: x.startBalance + (c! - debtBalance(d, x)) }; }
      else d.debts.push({ id: uid(), createdAt: Date.now(), startBalance: c!, ...rec });
    }, { toast: debt ? 'Debt updated.' : 'Debt added. Seeing it clearly is progress.' });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={debt ? 'Edit debt' : 'Add a debt'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <Field label="Name" htmlFor="d-name" error={err.name}><input id="d-name" autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Visa card, Car loan" maxLength={40} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current balance" htmlFor="d-cur" error={err.current}><MoneyInput id="d-cur" value={current} onChange={(v) => { setCurrent(v); if (!debt && !original) setOriginal(v); }} currency={data.settings.currency} /></Field>
          <Field label="Original balance" htmlFor="d-orig" error={err.original} hint="Used to show your progress."><MoneyInput id="d-orig" value={original} onChange={setOriginal} currency={data.settings.currency} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Interest rate (APR %)" htmlFor="d-apr" error={err.apr}><input id="d-apr" inputMode="decimal" className={inputCls} value={apr} onChange={(e) => setApr(e.target.value)} placeholder="e.g. 22.9" /></Field>
          <Field label="Minimum payment" htmlFor="d-min" error={err.min}><MoneyInput id="d-min" value={min} onChange={setMin} currency={data.settings.currency} /></Field>
          <Field label="Due day" htmlFor="d-day"><input id="d-day" type="number" min={1} max={31} className={inputCls} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{debt ? 'Save' : 'Add debt'}</Button></div>
      </form>
    </Modal>
  );
}

function PaymentModal({ debt, action, onClose }: { debt: DebtT; action: 'payment' | 'charge'; onClose: () => void }) {
  const { data, update, today } = useStore();
  const [amt, setAmt] = useState(action === 'payment' ? centsToInput(debt.minimumPayment || undefined) : '');
  const [when, setWhen] = useState(today);
  const [cash, setCash] = useState(true);
  const [err, setErr] = useState('');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseMoney(amt);
    if (c === null || c <= 0) return setErr('Enter an amount above zero.');
    if (!isValidISO(when)) return setErr('Choose a valid date.');
    update((d) => { addTx(d, { type: 'debt', name: action === 'payment' ? `${debt.name} payment` : `${debt.name} interest / charge`, amount: c, date: when, debtId: debt.id, debtAction: action, affectsCash: action === 'payment' ? cash : false }); }, { toast: action === 'payment' ? 'Payment recorded. Every payment counts.' : 'Charge added.' });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={action === 'payment' ? `Payment: ${debt.name}` : `Interest or charge: ${debt.name}`}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="p-amt" error={err}><MoneyInput id="p-amt" value={amt} onChange={setAmt} currency={data.settings.currency} autoFocus /></Field>
          <Field label="Date" htmlFor="p-date"><input id="p-date" type="date" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        </div>
        {action === 'payment' ? (
          <label className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--mauve)]" checked={cash} onChange={(e) => setCash(e.target.checked)} />
            <span><b>Paid from my everyday account</b><br /><span className="text-muted">Lowers your available money. Debt payments are tracked separately from spending.</span></span></label>
        ) : <p className="text-sm text-muted">Interest and new charges increase the balance. They don't change your available cash.</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></div>
      </form>
    </Modal>
  );
}
