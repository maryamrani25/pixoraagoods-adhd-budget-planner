import React, { useState } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuPiggyBank, LuMinus, LuHistory } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, EmptyState, IconButton, confirmAction, Badge, Modal, Field, MoneyInput, inputCls, ProgressBar, Stat, cx } from '../components/ui';
import { goalInfo, totalSaved, inRange, currentMonthKey, rangeOfMonth } from '../lib/calc';
import { parseMoney, centsToInput, sum } from '../lib/money';
import { isValidISO, addDays } from '../lib/dates';
import { deleteGoal, deleteTx } from '../lib/actions';
import { PALETTE, uid } from '../lib/defaults';
import type { SavingsGoal } from '../lib/types';

export default function Savings() {
  const { data, today, money, openQuick, update, date } = useStore();
  const [modal, setModal] = useState<SavingsGoal | 'new' | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const r = rangeOfMonth(data, currentMonthKey(data, today));
  const movedThisMonth = sum(data.transactions.filter((t) => t.type === 'savings' && t.affectsCash && inRange(t.date, r.from, r.to)).map((t) => (t.direction === 'out' ? -t.amount : t.amount)));
  const goals = data.goals.map((g) => ({ g, ...goalInfo(data, g, today) }));
  return (
    <div>
      <PageHeader title="Savings Goals" subtitle="Separate pots for the things that matter. Moving money here is a transfer, never counted as spending."
        actions={<><Button variant="secondary" icon={<LuPiggyBank aria-hidden />} onClick={() => openQuick('savings')} disabled={!data.goals.length}>Add money</Button><Button icon={<LuPlus aria-hidden />} onClick={() => setModal('new')}>New goal</Button></>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Total saved" value={money(totalSaved(data))} tone="success" />
        <Stat label="Moved to savings this month" value={money(movedThisMonth)} />
        <Stat label="Monthly savings plan" value={money(sum(data.goals.map((g) => g.monthlyPlan)))} hint="Set aside in Safe-to-Spend until moved" />
      </div>
      {goals.length === 0 ? <Card><EmptyState icon={<LuPiggyBank />} title="No savings goals yet" text="Start with an Emergency Fund. Even a small target like $500 makes a real difference." action={<Button onClick={() => setModal('new')}>Create my first goal</Button>} /></Card> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {goals.map(({ g, saved, remaining, pct, neededPerMonth, done }) => {
            const history = data.transactions.filter((t) => t.type === 'savings' && t.goalId === g.id).sort((a, b) => b.date.localeCompare(a.date));
            return (
              <Card key={g.id}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5"><span className="h-3 w-3 rounded-full" style={{ background: g.color }} aria-hidden /><h2 className="text-[17px] font-semibold">{g.name}</h2></div>
                  <div className="flex">{done && <Badge tone="success">Goal reached!</Badge>}
                    <IconButton label={`Edit ${g.name}`} onClick={() => setModal(g)}><LuPencil aria-hidden /></IconButton>
                    <IconButton label={`Delete ${g.name}`} onClick={async () => { if (await confirmAction({ title: `Delete "${g.name}"?`, message: 'The goal and its saved-money history will be removed from this planner. (Your real bank account is not affected.)', confirmLabel: 'Delete goal', danger: true })) update((d) => deleteGoal(d, g.id), { toast: 'Goal deleted.', undoable: true }); }}><LuTrash2 aria-hidden /></IconButton></div>
                </div>
                <p className="num font-serif text-3xl">{money(saved)}</p>
                <p className="mb-3 text-sm text-muted">of {money(g.target)} · {money(remaining)} to go</p>
                <ProgressBar value={pct} max={100} tone="success" label={`${g.name}: ${Math.round(pct)}% saved`} />
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-muted">Target date</dt><dd>{g.targetDate ? date(g.targetDate) : 'No deadline'}</dd></div>
                  <div><dt className="text-muted">Monthly plan</dt><dd className="num">{g.monthlyPlan ? money(g.monthlyPlan) : 'Not set'}</dd></div>
                  {neededPerMonth !== null && !done && <div className="col-span-2 rounded-xl bg-surface-2 p-2.5 text-muted">To reach it by the target date: about <b className="num text-ink">{money(neededPerMonth)}</b> a month.</div>}
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" icon={<LuPlus aria-hidden />} onClick={() => openQuick('savings', undefined, { goalId: g.id, direction: 'in' })}>Add money</Button>
                  <Button size="sm" variant="secondary" icon={<LuMinus aria-hidden />} onClick={() => openQuick('savings', undefined, { goalId: g.id, direction: 'out' })} disabled={saved <= 0}>Take out</Button>
                  <Button size="sm" variant="ghost" icon={<LuHistory aria-hidden />} aria-expanded={hist === g.id} onClick={() => setHist(hist === g.id ? null : g.id)}>History</Button>
                </div>
                {hist === g.id && (
                  <ul className="mt-3 max-h-64 divide-y divide-line overflow-y-auto border-t border-line text-sm">
                    {history.length === 0 && <li className="py-2 text-muted">No contributions yet.</li>}
                    {history.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 py-2">
                        <span className="flex-1">{date(t.date)}<span className="block text-xs text-muted">{t.name}{!t.affectsCash ? ' · already saved' : ''}</span></span>
                        <span className={cx('num', t.direction === 'out' ? 'text-danger' : 'text-success')}>{t.direction === 'out' ? '−' : '+'}{money(t.amount)}</span>
                        <IconButton label="Edit entry" onClick={() => openQuick('savings', t.id)}><LuPencil aria-hidden /></IconButton>
                        <IconButton label="Delete entry" onClick={async () => { if (await confirmAction({ title: 'Remove this entry?', message: `${money(t.amount)} on ${date(t.date)} will be removed from ${g.name}.`, confirmLabel: 'Remove', danger: true })) update((d) => deleteTx(d, t.id), { toast: 'Entry removed.', undoable: true }); }}><LuTrash2 aria-hidden /></IconButton>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {modal && <GoalModal goal={modal === 'new' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function GoalModal({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const { data, update, today } = useStore();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(centsToInput(goal?.target));
  const [tdate, setTdate] = useState(goal?.targetDate ?? '');
  const [plan, setPlan] = useState(centsToInput(goal?.monthlyPlan || undefined));
  const [day, setDay] = useState(String(goal?.contributionDay ?? ''));
  const [start, setStart] = useState('');
  const [color, setColor] = useState(goal?.color ?? PALETTE[(data.goals.length + 1) % PALETTE.length]);
  const [err, setErr] = useState<Record<string, string>>({});
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const t = parseMoney(target); const p = plan.trim() ? parseMoney(plan) : 0; const s0 = start.trim() ? parseMoney(start) : 0; const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name your goal, like "Emergency Fund".';
    if (t === null || t <= 0) errors.target = 'Enter a target above zero.';
    if (p === null || p < 0) errors.plan = 'Enter a monthly amount, or leave it empty.';
    if (s0 === null || s0 < 0) errors.start = 'Enter an amount, or leave it empty.';
    if (tdate && !isValidISO(tdate)) errors.tdate = 'Choose a valid date or leave empty.';
    setErr(errors); if (Object.keys(errors).length) return;
    update((d) => {
      const rec = { name: name.trim(), target: t!, targetDate: tdate || undefined, monthlyPlan: p || 0, contributionDay: day ? Math.min(28, Math.max(1, Number(day))) : undefined, color };
      if (goal) { const i = d.goals.findIndex((x) => x.id === goal.id); d.goals[i] = { ...d.goals[i], ...rec }; }
      else {
        const id = uid(); d.goals.push({ id, createdAt: Date.now(), ...rec });
        if (s0 && s0 > 0) d.transactions.push({ id: uid(), createdAt: Date.now(), type: 'savings', name: 'Starting balance', amount: s0, date: addDays(today, -1), goalId: id, direction: 'in', affectsCash: false });
      }
    }, { toast: goal ? 'Goal updated.' : 'Goal created. Your progress matters.' });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={goal ? 'Edit savings goal' : 'New savings goal'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <Field label="Goal name" htmlFor="g-name" error={err.name}><input id="g-name" autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency Fund, Vacation, New Laptop" maxLength={40} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target amount" htmlFor="g-target" error={err.target}><MoneyInput id="g-target" value={target} onChange={setTarget} currency={data.settings.currency} /></Field>
          <Field label="Target date" htmlFor="g-date" error={err.tdate} hint="Optional"><input id="g-date" type="date" className={inputCls} value={tdate} onChange={(e) => setTdate(e.target.value)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan to save each month" htmlFor="g-plan" error={err.plan} hint="Optional. Set aside in Safe-to-Spend."><MoneyInput id="g-plan" value={plan} onChange={setPlan} currency={data.settings.currency} /></Field>
          <Field label="Usual transfer day" htmlFor="g-day" hint="Optional (1–28). Shown on the calendar."><input id="g-day" type="number" min={1} max={28} className={inputCls} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        </div>
        {!goal && <Field label="Already saved for this" htmlFor="g-start" error={err.start} hint="Optional. Money already in savings; it won't change your available money."><MoneyInput id="g-start" value={start} onChange={setStart} currency={data.settings.currency} /></Field>}
        <Field label="Colour"><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">{PALETTE.map((p) => <button key={p} type="button" role="radio" aria-checked={color === p} aria-label={`Colour ${p}`} onClick={() => setColor(p)} className={cx('h-8 w-8 rounded-full border-2', color === p ? 'border-ink' : 'border-transparent')} style={{ background: p }} />)}</div></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{goal ? 'Save' : 'Create goal'}</Button></div>
      </form>
    </Modal>
  );
}
