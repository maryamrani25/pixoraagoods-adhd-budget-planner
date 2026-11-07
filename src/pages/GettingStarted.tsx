import React, { useState } from 'react';
import { LuCheck, LuCircle, LuRocket, LuArrowRight, LuChevronLeft, LuPlus, LuTrash2 } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, Field, MoneyInput, inputCls, ProgressBar, Notice, cx, IconButton } from '../components/ui';
import { CURRENCIES, parseMoney, formatMoney } from '../lib/money';
import { emptyData, uid } from '../lib/defaults';
import { addDays, perMonth, freqLabel, toISO, parseISO, daysInMonth } from '../lib/dates';
import type { AppData, PayFrequency, BillKind } from '../lib/types';

export default function GettingStarted() {
  const { data } = useStore();
  const [wizard, setWizard] = useState(false);
  const hasBudget = Object.values(data.budgets).some((b) => Object.values(b).some((v) => v > 0));
  const items = [
    { done: !!data.settings.balance, label: 'Add your current bank balance', why: 'This is what Safe-to-Spend starts from.', to: 'safe' },
    { done: data.incomeSources.length > 0, label: 'Add your paycheck schedule', why: 'So we know when money is coming (but never count it early).', to: 'income' },
    { done: data.bills.length > 0, label: 'Add your regular bills', why: 'Bills are set aside before anything else.', to: 'bills' },
    { done: hasBudget, label: 'Set a few spending limits', why: 'Just two or three categories is a great start.', to: 'budget' },
    { done: data.goals.length > 0, label: 'Create a savings goal', why: 'A small emergency fund is a lovely first goal.', to: 'savings' },
    { done: data.transactions.some((t) => t.type === 'expense'), label: 'Log your first expense', why: 'Tap the + button any time. It takes a few seconds.', to: 'expenses' },
  ];
  const done = items.filter((i) => i.done).length;
  return (
    <div>
      <PageHeader title="Getting Started" subtitle="Start with what you know. You can skip anything and come back later." actions={<Button onClick={() => setWizard(true)} icon={<LuRocket aria-hidden />}>{data.settings.onboarded ? 'Run guided setup again' : 'Start guided setup'}</Button>} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Your setup checklist" subtitle={`${done} of ${items.length} done`}>
          <ProgressBar value={done} max={items.length} tone="success" label="Setup progress" />
          <ul className="mt-4 divide-y divide-line">
            {items.map((i) => (
              <li key={i.label}><a href={`#/${i.to}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', i.done ? 'bg-success text-white dark:text-plum' : 'border border-line text-muted')}>{i.done ? <LuCheck aria-hidden /> : <LuCircle aria-hidden className="opacity-0" />}</span>
                <span className="flex-1"><span className={cx('block font-medium', i.done ? 'text-muted line-through' : 'text-ink')}>{i.label}</span><span className="block text-sm text-muted">{i.why}</span></span>
                <LuArrowRight aria-hidden className="text-muted" /><span className="sr-only">{i.done ? '(done)' : '(not done yet)'}</span>
              </a></li>
            ))}
          </ul>
        </Card>
        <div className="grid content-start gap-5">
          <Card title="How this planner works">
            <ol className="grid gap-3 text-[15px] text-ink">
              <li><b>1. Tell it what you have.</b> Your bank balance, typed in by you. No bank connection, ever.</li>
              <li><b>2. Reserve what's coming.</b> Bills and savings plans are set aside first.</li>
              <li><b>3. Spend what's safe.</b> What's left is your Safe-to-Spend. Expected paychecks are never counted before they arrive.</li>
              <li><b>4. Log as you go.</b> Add expenses in a few taps. Everything updates instantly.</li>
            </ol>
          </Card>
          <Notice>Messy start? That's normal. Rough numbers are fine. It's okay to begin again at any time.</Notice>
        </div>
      </div>
      {wizard && <OnboardingWizard onClose={() => setWizard(false)} />}
    </div>
  );
}

// ---------------- Guided setup wizard ----------------
interface DebtRow { id: string; name: string; balance: string; min: string; day: string; }
interface BillRow { id: string; name: string; kind: BillKind; amount: string; day: string; }
const GOAL_CHOICES = ['Build an emergency fund', 'Pay off debt', 'Stop running out before payday', 'Save for something special', 'Get into a spending habit I can keep'];

export function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const { data, replace, today } = useStore();
  const [step, setStep] = useState(0);
  const [s, setS] = useState({
    name: data.settings.name, currency: data.settings.currency, pay: '', freq: (data.settings.payFrequency || 'biweekly') as PayFrequency, nextPay: addDays(today, 3), monthly: '',
    startDay: String(data.settings.monthStartDay), balance: '', savings: '', savingsTarget: '1000', goals: [] as string[],
  });
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([
    { id: uid(), name: 'Rent', kind: 'rent', amount: '', day: '1' }, { id: uid(), name: 'Electricity', kind: 'electricity', amount: '', day: '15' },
    { id: uid(), name: 'Internet', kind: 'internet', amount: '', day: '20' }, { id: uid(), name: 'Phone', kind: 'phone', amount: '', day: '20' },
  ]);
  const set = (p: Partial<typeof s>) => setS((x) => ({ ...x, ...p }));
  const cur = s.currency;
  const steps = ['Welcome', 'Income', 'Budget month', 'Bank balance', 'Savings', 'Debts', 'Goals', 'Bills'];
  const last = steps.length - 1;
  const example = () => {
    if (step === 0) set({ name: s.name || 'Alex' });
    if (step === 1) set({ pay: '2000', freq: 'twice-monthly', monthly: '4000' });
    if (step === 3) set({ balance: '1850' });
    if (step === 4) set({ savings: '400', savingsTarget: '1000' });
    if (step === 5) setDebts([{ id: uid(), name: 'Credit card', balance: '1200', min: '40', day: '21' }]);
    if (step === 6) set({ goals: ['Build an emergency fund', 'Pay off debt'] });
    if (step === 7) setBills((b) => b.map((x, i) => ({ ...x, amount: ['1200', '85', '60', '45'][i] ?? x.amount })));
  };
  const perPay = parseMoney(s.pay);
  const monthlyEst = s.freq === 'irregular' ? parseMoney(s.monthly) : perPay ? Math.round(perPay * perMonth[s.freq]) : null;

  const finish = () => {
    const d: AppData = emptyData();
    d.isDemo = data.isDemo;
    d.settings = { ...d.settings, theme: data.settings.theme, name: s.name.trim(), currency: s.currency, payFrequency: s.freq, monthStartDay: Math.min(28, Math.max(1, Number(s.startDay) || 1)), onboarded: true };
    const bal = parseMoney(s.balance); if (bal !== null && s.balance.trim()) d.settings.balance = { amount: bal, asOf: addDays(today, -1) };
    const amt = s.freq === 'irregular' ? parseMoney(s.monthly) : perPay;
    if (amt && amt > 0) d.incomeSources.push({ id: uid(), name: 'Paycheck', kind: 'salary', amount: amt, frequency: s.freq, anchorDate: s.nextPay || today, active: true });
    const sv = parseMoney(s.savings); const tgt = parseMoney(s.savingsTarget);
    if ((sv && sv > 0) || s.goals.includes('Build an emergency fund')) {
      const g = { id: uid(), name: 'Emergency Fund', target: tgt && tgt > 0 ? tgt : 100000, monthlyPlan: 0, color: '#648A72', createdAt: Date.now() };
      d.goals.push(g);
      if (sv && sv > 0) d.transactions.push({ id: uid(), createdAt: Date.now(), type: 'savings', name: 'Starting balance', amount: sv, date: addDays(today, -1), goalId: g.id, direction: 'in', affectsCash: false });
    }
    for (const r of debts) { const b = parseMoney(r.balance); if (!r.name.trim() || !b) continue; d.debts.push({ id: uid(), name: r.name.trim(), originalBalance: b, startBalance: b, interestRate: 0, minimumPayment: parseMoney(r.min) ?? 0, dueDay: Math.min(31, Math.max(1, Number(r.day) || 1)), createdAt: Date.now() }); }
    for (const r of bills) {
      const a = parseMoney(r.amount); if (!r.name.trim() || !a) continue;
      const day = Math.min(31, Math.max(1, Number(r.day) || 1));
      const t = parseISO(today); let due = toISO(new Date(t.getFullYear(), t.getMonth(), Math.min(day, daysInMonth(t.getFullYear(), t.getMonth())), 12));
      if (due < today) due = toISO(new Date(t.getFullYear(), t.getMonth() + 1, Math.min(day, daysInMonth(t.getFullYear(), t.getMonth() + 1)), 12));
      d.bills.push({ id: uid(), name: r.name.trim(), kind: r.kind, amount: a, dueDate: due, frequency: 'monthly', categoryId: r.kind === 'rent' ? 'housing' : r.kind === 'subscription' ? 'subscriptions' : 'utilities', reminderDays: 3, active: true });
    }
    for (const g of s.goals) d.financialGoals.push({ id: uid(), name: g, milestones: [], completed: false, createdAt: Date.now(), manualProgress: 0 });
    replace(d, data.isDemo || data.transactions.length ? 'Your planner is set up. (Undo brings back your previous data.)' : 'Your planner is set up. One small step at a time.');
    onClose(); location.hash = '#/today';
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-labelledby="wiz-title">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm text-muted">Step {step + 1} of {steps.length} · {steps[step]}</span>
          <button onClick={() => { if (!data.settings.onboarded && !data.isDemo) { replace({ ...data, settings: { ...data.settings, onboarded: true } }); } onClose(); }} className="text-sm font-medium text-mauve hover:underline">Skip setup for now</button>
        </div>
        <ProgressBar value={step + 1} max={steps.length} label="Setup progress" />
        <div className="mt-8 flex-1">
          {step === 0 && <>
            <h2 id="wiz-title" className="font-serif text-3xl">Welcome. Let's make money feel simpler.</h2>
            <p className="mt-2 text-muted">A few quick questions. Every one is optional, and rough numbers are perfectly fine.</p>
            {data.isDemo && <div className="mt-4"><Notice tone="warning">You're in the demo. Finishing setup replaces the sample data with your answers (you can always press "Reset demo").</Notice></div>}
            <div className="mt-6 grid gap-4">
              <Field label="What should we call you?" htmlFor="w-name" hint="Optional"><input id="w-name" className={inputCls} value={s.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} /></Field>
              <Field label="Currency" htmlFor="w-cur"><select id="w-cur" className={inputCls} value={s.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
            </div>
          </>}
          {step === 1 && <>
            <h2 id="wiz-title" className="font-serif text-3xl">How do you get paid?</h2>
            <p className="mt-2 text-muted">Use take-home pay (after tax). We'll show it as expected income and never count it until you mark it received.</p>
            <div className="mt-6 grid gap-4">
              <Field label="How often?" htmlFor="w-freq"><select id="w-freq" className={inputCls} value={s.freq} onChange={(e) => set({ freq: e.target.value as PayFrequency })}>{(['weekly', 'biweekly', 'twice-monthly', 'monthly', 'irregular'] as PayFrequency[]).map((f) => <option key={f} value={f}>{freqLabel[f]}</option>)}</select></Field>
              {s.freq === 'irregular' ? (
                <Field label="Roughly how much in a typical month?" htmlFor="w-monthly" hint="A cautious guess is best."><MoneyInput id="w-monthly" value={s.monthly} onChange={(v) => set({ monthly: v })} currency={cur} /></Field>
              ) : <>
                <Field label="Amount per paycheck" htmlFor="w-pay"><MoneyInput id="w-pay" value={s.pay} onChange={(v) => set({ pay: v })} currency={cur} /></Field>
                <Field label="Next payday" htmlFor="w-next"><input id="w-next" type="date" className={inputCls} value={s.nextPay} onChange={(e) => set({ nextPay: e.target.value })} /></Field>
              </>}
              {monthlyEst ? <p className="text-sm text-muted">That's about <b className="text-ink">{formatMoney(monthlyEst, cur)}</b> a month.</p> : null}
            </div>
          </>}
          {step === 2 && <>
            <h2 id="wiz-title" className="font-serif text-3xl">When does your budget month start?</h2>
            <p className="mt-2 text-muted">Most people use the 1st. If you're paid on the 15th, you might prefer your month to start then.</p>
            <div className="mt-6"><Field label="Budget month starts on day" htmlFor="w-start"><select id="w-start" className={inputCls} value={s.startDay} onChange={(e) => set({ startDay: e.target.value })}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></Field></div>
          </>}
          {step === 3 && <>
            <h2 id="wiz-title" className="font-serif text-3xl">How much is in your everyday account?</h2>
            <p className="mt-2 text-muted">Check your banking app and type the current balance. This powers your Safe-to-Spend number. Not sure? Skip it and add it later.</p>
            <div className="mt-6"><Field label="Current balance" htmlFor="w-bal"><MoneyInput id="w-bal" value={s.balance} onChange={(v) => set({ balance: v })} currency={cur} /></Field></div>
          </>}
          {step === 4 && <>
            <h2 id="wiz-title" className="font-serif text-3xl">Any savings already?</h2>
            <p className="mt-2 text-muted">Money you've already put aside. It won't be counted as spendable.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Already saved" htmlFor="w-sav"><MoneyInput id="w-sav" value={s.savings} onChange={(v) => set({ savings: v })} currency={cur} /></Field>
              <Field label="Emergency fund target" htmlFor="w-tgt"><MoneyInput id="w-tgt" value={s.savingsTarget} onChange={(v) => set({ savingsTarget: v })} currency={cur} /></Field>
            </div>
          </>}
          {step === 5 && <>
            <h2 id="wiz-title" className="font-serif text-3xl">Any debts you're paying off?</h2>
            <p className="mt-2 text-muted">Credit cards, loans, buy-now-pay-later. No judgement here; seeing it clearly is the first step.</p>
            <div className="mt-6 grid gap-3">
              {debts.map((r, i) => (
                <div key={r.id} className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[1.4fr_1fr_1fr_.7fr_auto]">
                  <input aria-label="Debt name" className={inputCls} placeholder="Name" value={r.name} onChange={(e) => setDebts(debts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input aria-label="Balance" inputMode="decimal" className={inputCls} placeholder="Balance" value={r.balance} onChange={(e) => setDebts(debts.map((x, j) => j === i ? { ...x, balance: e.target.value } : x))} />
                  <input aria-label="Minimum payment" inputMode="decimal" className={inputCls} placeholder="Min. payment" value={r.min} onChange={(e) => setDebts(debts.map((x, j) => j === i ? { ...x, min: e.target.value } : x))} />
                  <input aria-label="Due day" inputMode="numeric" className={inputCls} placeholder="Due day" value={r.day} onChange={(e) => setDebts(debts.map((x, j) => j === i ? { ...x, day: e.target.value } : x))} />
                  <IconButton label="Remove debt" onClick={() => setDebts(debts.filter((_, j) => j !== i))}><LuTrash2 aria-hidden /></IconButton>
                </div>
              ))}
              <Button variant="secondary" icon={<LuPlus aria-hidden />} onClick={() => setDebts([...debts, { id: uid(), name: '', balance: '', min: '', day: '1' }])}>Add a debt</Button>
            </div>
          </>}
          {step === 6 && <>
            <h2 id="wiz-title" className="font-serif text-3xl">What matters most right now?</h2>
            <p className="mt-2 text-muted">Pick one or two. You can change these any time.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {GOAL_CHOICES.map((g) => { const on = s.goals.includes(g); return (
                <button key={g} type="button" aria-pressed={on} onClick={() => set({ goals: on ? s.goals.filter((x) => x !== g) : [...s.goals, g] })} className={cx('min-h-11 rounded-full border px-4 text-sm', on ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-ink')}>{on && <LuCheck aria-hidden className="mr-1 inline" />}{g}</button>); })}
            </div>
          </>}
          {step === 7 && <>
            <h2 id="wiz-title" className="font-serif text-3xl">Your regular bills</h2>
            <p className="mt-2 text-muted">Fill in the ones you have and leave the rest blank. You can add more later.</p>
            <div className="mt-6 grid gap-2">
              {bills.map((r, i) => (
                <div key={r.id} className="grid grid-cols-[1.4fr_1fr_.8fr_auto] items-center gap-2">
                  <input aria-label="Bill name" className={inputCls} value={r.name} onChange={(e) => setBills(bills.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input aria-label={`${r.name} amount`} inputMode="decimal" className={inputCls} placeholder="Amount" value={r.amount} onChange={(e) => setBills(bills.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  <input aria-label={`${r.name} due day of month`} inputMode="numeric" className={inputCls} placeholder="Day" value={r.day} onChange={(e) => setBills(bills.map((x, j) => j === i ? { ...x, day: e.target.value } : x))} />
                  <IconButton label="Remove bill" onClick={() => setBills(bills.filter((_, j) => j !== i))}><LuTrash2 aria-hidden /></IconButton>
                </div>
              ))}
              <p className="text-xs text-muted">Columns: name · amount · day of the month it's due.</p>
              <Button variant="secondary" icon={<LuPlus aria-hidden />} onClick={() => setBills([...bills, { id: uid(), name: 'Subscription', kind: 'subscription', amount: '', day: '1' }])}>Add another bill</Button>
            </div>
          </>}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-2">
          {step > 0 && <Button variant="ghost" icon={<LuChevronLeft aria-hidden />} onClick={() => setStep(step - 1)}>Back</Button>}
          {step > 0 && <button type="button" onClick={example} className="text-sm font-medium text-mauve hover:underline">Not sure? Use example values</button>}
          <div className="ml-auto flex gap-2">
            {step > 0 && step < last && <Button variant="secondary" onClick={() => setStep(step + 1)}>Skip</Button>}
            {step < last ? <Button onClick={() => setStep(step + 1)}>Next <LuArrowRight aria-hidden /></Button> : <Button onClick={finish}>Finish setup <LuCheck aria-hidden /></Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
