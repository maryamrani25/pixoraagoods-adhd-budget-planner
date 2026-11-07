import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Button, Field, Modal, MoneyInput, inputCls, Segmented, cx } from './ui';
import { parseMoney, centsToInput } from '../lib/money';
import { isValidISO } from '../lib/dates';
import { addTx, updateTx, matchExpected } from '../lib/actions';
import { PAYMENT_METHODS, INCOME_KINDS, BILL_KINDS, uid } from '../lib/defaults';
import type { Bill, BillKind, Frequency, IncomeKind } from '../lib/types';
import { freqLabel } from '../lib/dates';

export function QuickHost() {
  const { quick, closeQuick } = useStore();
  if (!quick) return null;
  const props = { editId: quick.editId, preset: quick.preset ?? {}, onDone: closeQuick };
  if (quick.kind === 'expense') return <ExpenseForm {...props} />;
  if (quick.kind === 'income') return <IncomeForm {...props} />;
  if (quick.kind === 'bill') return <BillForm {...props} />;
  return <SavingsForm {...props} />;
}
type FormProps = { editId?: string; preset: Record<string, unknown>; onDone: () => void };

function ExpenseForm({ editId, preset, onDone }: FormProps) {
  const { data, update, today } = useStore();
  const existing = editId ? data.transactions.find((t) => t.id === editId) : undefined;
  const [amount, setAmount] = useState(centsToInput(existing?.amount) || '');
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.categoryId ?? (preset.categoryId as string) ?? '');
  const [date, setDate] = useState(existing?.date ?? today);
  const [method, setMethod] = useState(existing?.paymentMethod ?? 'Debit card');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [more, setMore] = useState(!!existing);
  const [err, setErr] = useState<Record<string, string>>({});
  const recentCats = useMemo(() => {
    const seen: string[] = [];
    for (const t of [...data.transactions].filter((t) => t.type === 'expense').sort((a, b) => b.createdAt - a.createdAt)) { if (t.categoryId && !seen.includes(t.categoryId)) seen.push(t.categoryId); if (seen.length >= 5) break; }
    for (const c of data.categories) { if (seen.length >= 5) break; if (!seen.includes(c.id)) seen.push(c.id); }
    return seen.map((id) => data.categories.find((c) => c.id === id)).filter(Boolean) as typeof data.categories;
  }, [data]);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount); const errors: Record<string, string> = {};
    if (cents === null || cents <= 0) errors.amount = 'Enter an amount above zero, like 12.50.';
    if (!category) errors.category = 'Pick a category. "Other" is fine if you are not sure.';
    if (!isValidISO(date)) errors.date = 'Choose a valid date.';
    setErr(errors); if (Object.keys(errors).length) return;
    const catName = data.categories.find((c) => c.id === category)?.name ?? 'Expense';
    const rec = { name: name.trim() || catName, amount: cents!, categoryId: category, date, paymentMethod: method, notes: notes.trim() || undefined };
    update((d) => { if (existing) updateTx(d, existing.id, rec); else addTx(d, { type: 'expense', affectsCash: true, ...rec }); }, { toast: existing ? 'Expense updated.' : 'Expense added. Nice work.' });
    onDone();
  };
  return (
    <Modal open onClose={onDone} title={existing ? 'Edit expense' : 'Add expense'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <Field label="How much?" htmlFor="ex-amount" error={err.amount}><MoneyInput id="ex-amount" value={amount} onChange={setAmount} currency={data.settings.currency} autoFocus invalid={!!err.amount} /></Field>
        <Field label="Category" error={err.category}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
            {recentCats.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={category === c.id} onClick={() => setCategory(c.id)}
                className={cx('min-h-10 rounded-full border px-3.5 text-sm transition', category === c.id ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-ink hover:bg-surface-2')}>{c.name}</button>
            ))}
            <select aria-label="All categories" className={cx(inputCls, 'w-auto py-2 text-sm')} value={recentCats.some((c) => c.id === category) ? '' : category} onChange={(e) => e.target.value && setCategory(e.target.value)}>
              <option value="">More…</option>
              {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </Field>
        <Field label="What was it for?" htmlFor="ex-name" hint="Optional. If you leave this empty we'll use the category name.">
          <input id="ex-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries at Fresh Market" maxLength={80} />
        </Field>
        <Field label="Date" htmlFor="ex-date" error={err.date}><input id="ex-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {!more ? <button type="button" className="justify-self-start text-sm font-medium text-mauve underline-offset-4 hover:underline" onClick={() => setMore(true)}>+ Payment method and notes</button> : (
          <>
            <Field label="Payment method" htmlFor="ex-method"><select id="ex-method" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
            <Field label="Notes" htmlFor="ex-notes"><textarea id="ex-notes" rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></Field>
          </>
        )}
        <div className="flex justify-end gap-2 pt-1"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit">{existing ? 'Save changes' : 'Add expense'}</Button></div>
      </form>
    </Modal>
  );
}

function IncomeForm({ editId, preset, onDone }: FormProps) {
  const { data, update, today } = useStore();
  const existing = editId ? data.transactions.find((t) => t.id === editId) : undefined;
  const presetSource = data.incomeSources.find((s) => s.id === preset.sourceId);
  const [amount, setAmount] = useState(centsToInput(existing?.amount ?? presetSource?.amount) || '');
  const [sourceId, setSourceId] = useState(existing?.sourceId ?? (preset.sourceId as string) ?? '');
  const [name, setName] = useState(existing?.name ?? presetSource?.name ?? '');
  const [kind, setKind] = useState<IncomeKind>(existing?.incomeKind ?? presetSource?.kind ?? 'salary');
  const [date, setDate] = useState(existing?.date ?? (preset.date as string) ?? today);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [err, setErr] = useState<Record<string, string>>({});
  const pickSource = (id: string) => { setSourceId(id); const s = data.incomeSources.find((x) => x.id === id); if (s) { setName(s.name); setKind(s.kind); if (!amount) setAmount(centsToInput(s.amount)); } };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount); const errors: Record<string, string> = {};
    if (cents === null || cents <= 0) errors.amount = 'Enter the amount you received, like 1,850.00.';
    if (!isValidISO(date)) errors.date = 'Choose a valid date.';
    if (date > today) errors.date = "Only record money you've already received. Future paychecks are tracked as expected income.";
    setErr(errors); if (Object.keys(errors).length) return;
    update((d) => {
      const expectedDate = sourceId ? ((preset.date as string) || existing?.expectedDate || matchExpected(d, sourceId, date)) : undefined;
      const rec = { name: name.trim() || (INCOME_KINDS.find((k) => k.value === kind)?.label ?? 'Income'), amount: cents!, date, incomeKind: kind, sourceId: sourceId || undefined, expectedDate, notes: notes.trim() || undefined };
      if (existing) updateTx(d, existing.id, rec); else addTx(d, { type: 'income', affectsCash: true, ...rec });
    }, { toast: existing ? 'Income updated.' : 'Income recorded.' });
    onDone();
  };
  return (
    <Modal open onClose={onDone} title={existing ? 'Edit income' : 'Add income received'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        {data.incomeSources.length > 0 && (
          <Field label="From a regular income source?" htmlFor="in-src" hint="Linking it marks the expected paycheck as received.">
            <select id="in-src" className={inputCls} value={sourceId} onChange={(e) => pickSource(e.target.value)}>
              <option value="">No, a one-off</option>
              {data.incomeSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Amount received" htmlFor="in-amount" error={err.amount}><MoneyInput id="in-amount" value={amount} onChange={setAmount} currency={data.settings.currency} autoFocus invalid={!!err.amount} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="in-name"><input id="in-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paycheck" maxLength={80} /></Field>
          <Field label="Type" htmlFor="in-kind"><select id="in-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as IncomeKind)}>{INCOME_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></Field>
        </div>
        <Field label="Date received" htmlFor="in-date" error={err.date}><input id="in-date" type="date" max={today} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Notes" htmlFor="in-notes" hint="Optional"><textarea id="in-notes" rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></Field>
        <div className="flex justify-end gap-2 pt-1"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit">{existing ? 'Save changes' : 'Record income'}</Button></div>
      </form>
    </Modal>
  );
}

export function BillForm({ editId, onDone }: FormProps) {
  const { data, update, today } = useStore();
  const existing = editId ? data.bills.find((b) => b.id === editId) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<BillKind>(existing?.kind ?? 'other');
  const [amount, setAmount] = useState(centsToInput(existing?.amount) || '');
  const [due, setDue] = useState(existing?.dueDate ?? today);
  const [freq, setFreq] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [category, setCategory] = useState(existing?.categoryId ?? 'utilities');
  const [debt, setDebt] = useState(existing?.linkedDebtId ?? '');
  const [reminder, setReminder] = useState(String(existing?.reminderDays ?? data.settings.reminderDays));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [err, setErr] = useState<Record<string, string>>({});
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount); const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Give the bill a name, like "Rent".';
    if (cents === null || cents <= 0) errors.amount = 'Enter the usual amount, like 60.00.';
    if (!isValidISO(due)) errors.due = 'Choose the next due date.';
    setErr(errors); if (Object.keys(errors).length) return;
    const rec: Omit<Bill, 'id'> = { name: name.trim(), kind, amount: cents!, dueDate: due, frequency: freq, categoryId: debt ? undefined : category, linkedDebtId: debt || undefined, reminderDays: Math.max(0, Math.min(30, Number(reminder) || 0)), active: true, notes: notes.trim() || undefined };
    update((d) => { if (existing) { const i = d.bills.findIndex((b) => b.id === existing.id); d.bills[i] = { ...d.bills[i], ...rec }; } else d.bills.push({ id: uid(), ...rec }); }, { toast: existing ? 'Bill updated.' : 'Bill added. It will show on your calendar.' });
    onDone();
  };
  const freqs: Frequency[] = ['monthly', 'weekly', 'biweekly', 'twice-monthly', 'quarterly', 'yearly', 'once'];
  return (
    <Modal open onClose={onDone} title={existing ? 'Edit bill' : 'Add bill'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bill name" htmlFor="bill-name" error={err.name}><input id="bill-name" autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Internet" maxLength={60} /></Field>
          <Field label="Type" htmlFor="bill-kind"><select id="bill-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as BillKind)}>{BILL_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="bill-amount" error={err.amount}><MoneyInput id="bill-amount" value={amount} onChange={setAmount} currency={data.settings.currency} invalid={!!err.amount} /></Field>
          <Field label="Next due date" htmlFor="bill-due" error={err.due}><input id="bill-due" type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Repeats" htmlFor="bill-freq"><select id="bill-freq" className={inputCls} value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>{freqs.map((f) => <option key={f} value={f}>{freqLabel[f]}</option>)}</select></Field>
          <Field label="Remind me (days before)" htmlFor="bill-rem" hint="Shown inside the app only."><input id="bill-rem" type="number" min={0} max={30} className={inputCls} value={reminder} onChange={(e) => setReminder(e.target.value)} /></Field>
        </div>
        {data.debts.length > 0 && (
          <Field label="Is this a payment on a debt?" htmlFor="bill-debt" hint="If yes, marking it paid lowers that debt's balance instead of counting as spending.">
            <select id="bill-debt" className={inputCls} value={debt} onChange={(e) => setDebt(e.target.value)}><option value="">No</option>{data.debts.map((x) => <option key={x.id} value={x.id}>Yes: {x.name}</option>)}</select>
          </Field>
        )}
        {!debt && <Field label="Budget category" htmlFor="bill-cat" hint="Used when you mark it paid."><select id="bill-cat" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        <Field label="Notes" htmlFor="bill-notes" hint="Optional"><input id="bill-notes" className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></Field>
        <div className="flex justify-end gap-2 pt-1"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit">{existing ? 'Save changes' : 'Add bill'}</Button></div>
      </form>
    </Modal>
  );
}

function SavingsForm({ editId, preset, onDone }: FormProps) {
  const { data, update, today, openQuick } = useStore();
  const existing = editId ? data.transactions.find((t) => t.id === editId) : undefined;
  const [goalId, setGoalId] = useState(existing?.goalId ?? (preset.goalId as string) ?? data.goals[0]?.id ?? '');
  const [dir, setDir] = useState<'in' | 'out'>(existing?.direction ?? (preset.direction as 'in' | 'out') ?? 'in');
  const [amount, setAmount] = useState(centsToInput(existing?.amount) || (preset.amount ? centsToInput(preset.amount as number) : ''));
  const [date, setDate] = useState(existing?.date ?? today);
  const [cash, setCash] = useState(existing?.affectsCash ?? true);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [err, setErr] = useState<Record<string, string>>({});
  if (!data.goals.length) return (
    <Modal open onClose={onDone} title="Add to savings">
      <p className="text-ink">First, create a savings goal (for example "Emergency Fund"). Then you can add money to it.</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onDone}>Close</Button><Button onClick={() => { onDone(); location.hash = '#/savings'; }}>Go to Savings Goals</Button></div>
    </Modal>
  );
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount); const errors: Record<string, string> = {};
    if (cents === null || cents <= 0) errors.amount = 'Enter an amount above zero.';
    if (!goalId) errors.goal = 'Choose a goal.';
    if (!isValidISO(date)) errors.date = 'Choose a valid date.';
    setErr(errors); if (Object.keys(errors).length) return;
    const g = data.goals.find((x) => x.id === goalId)!;
    const rec = { name: dir === 'in' ? `Move to ${g.name}` : `Take from ${g.name}`, amount: cents!, date, goalId, direction: dir, affectsCash: cash, notes: notes.trim() || undefined };
    update((d) => { if (existing) updateTx(d, existing.id, rec); else addTx(d, { type: 'savings', ...rec }); }, { toast: dir === 'in' ? 'Saved! Every bit adds up.' : 'Withdrawal recorded.' });
    onDone();
  };
  void openQuick;
  return (
    <Modal open onClose={onDone} title={existing ? 'Edit savings entry' : 'Add to savings'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'in', label: 'Add money' }, { value: 'out', label: 'Take money out' }]} />
        <Field label="Savings goal" htmlFor="sv-goal" error={err.goal}><select id="sv-goal" className={inputCls} value={goalId} onChange={(e) => setGoalId(e.target.value)}>{data.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="sv-amount" error={err.amount}><MoneyInput id="sv-amount" value={amount} onChange={setAmount} currency={data.settings.currency} autoFocus invalid={!!err.amount} /></Field>
          <Field label="Date" htmlFor="sv-date" error={err.date}><input id="sv-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <label className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--mauve)]" checked={cash} onChange={(e) => setCash(e.target.checked)} />
          <span><span className="font-medium text-ink">{dir === 'in' ? 'Moved from my everyday account' : 'Moved back into my everyday account'}</span><br /><span className="text-muted">This is a transfer between your own accounts, so it is not counted as spending. Untick it for money that was already saved somewhere.</span></span>
        </label>
        <Field label="Note" htmlFor="sv-notes" hint="Optional"><input id="sv-notes" className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></Field>
        <div className="flex justify-end gap-2 pt-1"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit">{existing ? 'Save changes' : dir === 'in' ? 'Add to savings' : 'Record withdrawal'}</Button></div>
      </form>
    </Modal>
  );
}
