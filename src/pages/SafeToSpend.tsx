import React, { useState } from 'react';
import { LuShieldCheck, LuPlus, LuTrash2, LuCircleAlert, LuInfo } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, Field, inputCls, MoneyInput, Segmented, IconButton, Notice, Badge, cx } from '../components/ui';
import { safeToSpend } from '../lib/calc';
import { parseMoney, centsToInput, sum } from '../lib/money';
import { friendlyDate, isValidISO } from '../lib/dates';
import { uid } from '../lib/defaults';

export default function SafeToSpendPage() {
  const { data, today, money, update, date } = useStore();
  const s = safeToSpend(data, today);
  const b = data.settings.balance;
  const since = b ? data.transactions.filter((t) => t.affectsCash && t.date > b.asOf && t.date <= today) : [];
  const inc = sum(since.filter((t) => t.type === 'income').map((t) => t.amount));
  const exp = sum(since.filter((t) => t.type === 'expense').map((t) => t.amount));
  const sav = sum(since.filter((t) => t.type === 'savings').map((t) => (t.direction === 'out' ? -t.amount : t.amount)));
  const debt = sum(since.filter((t) => t.type === 'debt' && t.debtAction !== 'charge').map((t) => t.amount));

  return (
    <div>
      <PageHeader title="Safe-to-Spend" subtitle="How much you can spend without touching money that's already needed. Expected paychecks are never counted before they arrive." />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="grid content-start gap-5">
          <section className={cx('rounded-3xl p-6 sm:p-8', s.ready ? 'bg-plum text-white dark:border dark:border-line dark:bg-surface-2' : 'border border-line bg-surface')} aria-live="polite">
            {s.ready ? <>
              <p className="flex items-center gap-2 text-sm text-gold"><LuShieldCheck aria-hidden /> Safe to spend until {s.horizonLabel} ({friendlyDate(s.horizonEnd, today)})</p>
              <p className={cx('num mt-2 font-serif text-5xl sm:text-6xl', (s.safe ?? 0) < 0 && 'text-[#F2B8BF]')}>{money(s.safe ?? 0)}</p>
              <p className="mt-3 max-w-lg text-white/85">{(s.safe ?? 0) >= 0
                ? <>That's about <b className="num">{money(s.perDay ?? 0)}</b> a day for the next {s.daysLeft} day{s.daysLeft === 1 ? '' : 's'}, after your bills, savings plans and other commitments are set aside.</>
                : <>Your reserved money is {money(-(s.safe ?? 0))} more than you have right now. That's useful to know early. You could move a savings plan to later, check if any bill can wait until payday, or wait for your next paycheck before spending.</>}</p>
            </> : <>
              <p className="flex items-center gap-2 font-medium text-ink"><LuCircleAlert aria-hidden className="text-warning" /> We need a little more information</p>
              <p className="mt-2 text-muted">We won't guess, because a wrong number is worse than no number. Please add:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-ink">{s.missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </>}
          </section>

          {s.ready && s.missing.length > 0 && <Notice tone="warning" icon={<LuInfo aria-hidden className="mt-0.5 shrink-0" />}>{s.missing.join(' ')}</Notice>}

          <Card title="How it's worked out">
            <dl className="grid gap-1 text-[15px]">
              <Row label="Bank balance you entered" sub={b ? `on ${date(b.asOf)}` : 'not set'} value={b ? money(b.amount) : '—'} />
              {b && <>
                <Row label="+ Income received since then" value={money(inc)} muted />
                <Row label="− Spending logged since then" value={money(exp)} muted />
                <Row label={sav >= 0 ? '− Moved to savings since then' : '+ Taken out of savings since then'} value={money(Math.abs(sav))} muted />
                <Row label="− Debt payments since then" value={money(debt)} muted />
                <Row label="= Available money now" value={money(s.available ?? 0)} strong />
              </>}
              <div className="my-2 border-t border-line" />
              <Row label={`− Bills due by ${friendlyDate(s.horizonEnd, today)} (not paid yet)`} value={money(s.billsTotal)} />
              {s.bills.map((x, i) => <Row key={i} label={x.label} sub={x.detail} value={money(x.amount)} indent />)}
              <Row label="− Savings planned this month (not moved yet)" value={money(s.savingsTotal)} />
              {s.savings.map((x, i) => <Row key={i} label={x.label} sub={x.detail} value={money(x.amount)} indent />)}
              <Row label="− Other commitments" value={money(s.otherTotal)} />
              {s.other.map((x, i) => <Row key={i} label={x.label} sub={x.detail} value={money(x.amount)} indent />)}
              <div className="my-2 border-t border-line" />
              <Row label="= Safe to spend" value={s.safe === null ? '—' : money(s.safe)} strong />
            </dl>
            <div className="mt-5 rounded-2xl bg-surface-2 p-4">
              <p className="text-sm font-medium text-ink">Expected income (not counted)</p>
              {s.expected.length === 0 ? <p className="mt-1 text-sm text-muted">No paychecks expected before {friendlyDate(s.horizonEnd, today)}.</p> : (
                <ul className="mt-2 grid gap-1 text-sm">{s.expected.map((p) => <li key={p.source.id + p.date} className="flex justify-between"><span>{p.source.name} · {friendlyDate(p.date, today)} <Badge tone="gold">Expected</Badge></span><span className="num text-muted">{money(p.source.amount)}</span></li>)}</ul>
              )}
              <p className="mt-2 text-xs text-muted">When it arrives, record it (Income or Paycheck Planner) and this page updates.</p>
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <BalanceCard />
          <Card title="Plan until">
            <Segmented label="Safe-to-spend period" value={data.settings.safeToSpendHorizon} onChange={(v) => update((d) => { d.settings.safeToSpendHorizon = v; })} options={[{ value: 'payday', label: 'My next payday' }, { value: 'month', label: 'End of the month' }]} />
            <p className="mt-3 text-sm text-muted">"Next payday" sets aside bills due up to and including your next payday. "End of the month" plans for every bill left this month.</p>
          </Card>
          <ReservesCard />
          <Card title="Good to know">
            <ul className="grid gap-2 text-sm text-muted">
              <li>• Moving money to savings is a transfer, not spending. It lowers your available money but never appears as an expense.</li>
              <li>• Marking a bill paid records it once, so it's never counted twice.</li>
              <li>• Re-enter your bank balance every week or two to keep this accurate.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, sub, strong, muted, indent }: { label: string; value: string; sub?: string; strong?: boolean; muted?: boolean; indent?: boolean }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-1', indent && 'pl-5 text-sm')}>
      <dt className={cx(strong ? 'font-semibold text-ink' : muted || indent ? 'text-muted' : 'text-ink')}>{label}{sub && <span className="ml-2 text-xs text-muted">{sub}</span>}</dt>
      <dd className={cx('num shrink-0', strong ? 'font-semibold text-ink' : indent ? 'text-muted' : 'text-ink')}>{value}</dd>
    </div>
  );
}

function BalanceCard() {
  const { data, today, update, money, date } = useStore();
  const b = data.settings.balance;
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState(today);
  const [open, setOpen] = useState(!b);
  const [err, setErr] = useState('');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseMoney(amount);
    if (c === null) return setErr('Enter your balance, like 1,250.00 (use a minus sign if overdrawn).');
    if (!isValidISO(when) || when > today) return setErr('Choose today or an earlier date.');
    setErr('');
    update((d) => { d.settings.balance = { amount: c, asOf: when }; }, { toast: 'Balance updated. Safe-to-Spend is recalculated.', undoable: true });
    setOpen(false); setAmount('');
  };
  return (
    <Card title="Your bank balance" subtitle="Typed in by you. We never connect to your bank.">
      {b && !open && <>
        <p className="num font-serif text-3xl text-ink">{money(b.amount)}</p>
        <p className="text-sm text-muted">Entered for {date(b.asOf)}</p>
        <Button className="mt-4" variant="secondary" onClick={() => { setOpen(true); setAmount(centsToInput(b.amount)); }}>Update balance</Button>
      </>}
      {open && (
        <form onSubmit={save} className="grid gap-3" noValidate>
          <Field label="Balance in your everyday account" htmlFor="bal-amt" error={err} hint="Use the number your bank app shows right now.">
            <MoneyInput id="bal-amt" value={amount} onChange={setAmount} currency={data.settings.currency} autoFocus />
          </Field>
          <Field label="As of" htmlFor="bal-date" hint="Anything you logged up to and including this day is treated as already in this balance.">
            <input id="bal-date" type="date" max={today} className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <div className="flex gap-2"><Button type="submit">Save balance</Button>{b && <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>}</div>
        </form>
      )}
    </Card>
  );
}

function ReservesCard() {
  const { data, update, money } = useStore();
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');
  const [err, setErr] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseMoney(amt);
    if (!name.trim()) return setErr('Give it a short name, like "Car repair".');
    if (c === null || c <= 0) return setErr('Enter an amount above zero.');
    setErr('');
    update((d) => { d.reserves.push({ id: uid(), name: name.trim(), amount: c }); });
    setName(''); setAmt('');
  };
  return (
    <Card title="Other money to set aside" subtitle="Things coming up that aren't bills, like a gift or a car repair.">
      {data.reserves.length > 0 && (
        <ul className="mb-4 divide-y divide-line">
          {data.reserves.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2"><span className="flex-1 text-ink">{r.name}</span><span className="num">{money(r.amount)}</span>
              <IconButton label={`Remove ${r.name}`} onClick={() => update((d) => { d.reserves = d.reserves.filter((x) => x.id !== r.id); }, { toast: `Removed "${r.name}".`, undoable: true })}><LuTrash2 aria-hidden /></IconButton></li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]" noValidate>
        <input aria-label="What for" className={inputCls} placeholder="What for?" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <MoneyInput value={amt} onChange={setAmt} currency={data.settings.currency} />
        <Button type="submit" variant="secondary" icon={<LuPlus aria-hidden />}>Add</Button>
      </form>
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
    </Card>
  );
}
