import React, { useState } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuTarget, LuCheck, LuRotateCcw, LuX } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, EmptyState, IconButton, confirmAction, Modal, Field, inputCls, ProgressBar, Badge, cx } from '../components/ui';
import { isValidISO, friendlyDate } from '../lib/dates';
import { uid } from '../lib/defaults';
import type { FinancialGoal } from '../lib/types';

export const goalProgress = (g: FinancialGoal) => g.completed ? 100 : g.milestones.length ? (g.milestones.filter((m) => m.done).length / g.milestones.length) * 100 : g.manualProgress ?? 0;

export default function Goals() {
  const { data, update, date, today } = useStore();
  const [modal, setModal] = useState<FinancialGoal | 'new' | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const active = data.financialGoals.filter((g) => !g.completed);
  const done = data.financialGoals.filter((g) => g.completed);
  const edit = (id: string, fn: (g: FinancialGoal) => void, toast?: string) => update((d) => { const g = d.financialGoals.find((x) => x.id === id); if (g) fn(g); }, toast ? { toast } : undefined);

  const GoalCard = ({ g }: { g: FinancialGoal }) => {
    const p = goalProgress(g);
    return (
      <Card>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div><h2 className="text-[17px] font-semibold">{g.name}</h2>{g.targetDate && <p className="text-sm text-muted">Target: {date(g.targetDate)} ({friendlyDate(g.targetDate, today)})</p>}</div>
          <div className="flex">{g.completed && <Badge tone="success">Completed</Badge>}
            <IconButton label={`Edit ${g.name}`} onClick={() => setModal(g)}><LuPencil aria-hidden /></IconButton>
            <IconButton label={`Delete ${g.name}`} onClick={async () => { if (await confirmAction({ title: `Delete "${g.name}"?`, message: 'This goal and its milestones will be removed.', confirmLabel: 'Delete', danger: true })) update((d) => { d.financialGoals = d.financialGoals.filter((x) => x.id !== g.id); }, { toast: 'Goal deleted.', undoable: true }); }}><LuTrash2 aria-hidden /></IconButton></div>
        </div>
        {g.notes && <p className="mb-3 text-sm text-muted">{g.notes}</p>}
        <div className="mb-1 flex justify-between text-sm"><span className="text-muted">Progress</span><span className="num">{Math.round(p)}%</span></div>
        <ProgressBar value={p} max={100} tone={g.completed ? 'success' : 'mauve'} label={`${g.name} progress`} />
        {g.milestones.length === 0 && !g.completed && (
          <label className="mt-3 block text-sm"><span className="text-muted">Update progress</span>
            <input type="range" min={0} max={100} step={5} value={g.manualProgress ?? 0} onChange={(e) => edit(g.id, (x) => { x.manualProgress = Number(e.target.value); })} className="mt-1 w-full accent-[var(--mauve)]" aria-label={`${g.name} progress percent`} /></label>
        )}
        <ul className="mt-4 grid gap-1">
          {g.milestones.map((m) => (
            <li key={m.id} className="group flex items-center gap-2">
              <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--success)]" checked={m.done} onChange={() => edit(g.id, (x) => { const mm = x.milestones.find((y) => y.id === m.id)!; mm.done = !mm.done; }, m.done ? undefined : 'Milestone done. Your progress matters.')} />
                <span className={cx('text-[15px]', m.done ? 'text-muted line-through' : 'text-ink')}>{m.text}</span>
              </label>
              <IconButton label={`Remove milestone ${m.text}`} onClick={() => edit(g.id, (x) => { x.milestones = x.milestones.filter((y) => y.id !== m.id); })}><LuX aria-hidden /></IconButton>
            </li>
          ))}
        </ul>
        {!g.completed && (
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = (draft[g.id] || '').trim(); if (!t) return; edit(g.id, (x) => { x.milestones.push({ id: uid(), text: t, done: false }); }); setDraft({ ...draft, [g.id]: '' }); }}>
            <input aria-label={`New milestone for ${g.name}`} className={inputCls + ' py-2 text-sm'} placeholder="Add a small milestone…" value={draft[g.id] || ''} onChange={(e) => setDraft({ ...draft, [g.id]: e.target.value })} maxLength={80} />
            <Button type="submit" size="sm" variant="secondary" icon={<LuPlus aria-hidden />}>Add</Button>
          </form>
        )}
        <div className="mt-4">
          {g.completed ? <Button size="sm" variant="ghost" icon={<LuRotateCcw aria-hidden />} onClick={() => edit(g.id, (x) => { x.completed = false; })}>Reopen</Button>
            : <Button size="sm" icon={<LuCheck aria-hidden />} onClick={() => edit(g.id, (x) => { x.completed = true; }, '🎉 Goal completed. That deserves a moment of pride.')}>Mark completed</Button>}
        </div>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader title="Financial Goals" subtitle="Bigger goals, broken into small milestones you can actually tick off." actions={<Button icon={<LuPlus aria-hidden />} onClick={() => setModal('new')}>New goal</Button>} />
      {data.financialGoals.length === 0 ? <Card><EmptyState icon={<LuTarget />} title="No goals yet" text='Try something like "Have $500 for emergencies" or "Know where my money goes for one month".' action={<Button onClick={() => setModal('new')}>Create a goal</Button>} /></Card> : <>
        <div className="grid gap-5 lg:grid-cols-2">{active.map((g) => <React.Fragment key={g.id}>{GoalCard({ g })}</React.Fragment>)}</div>
        {active.length === 0 && <p className="text-muted">All your goals are complete. Lovely work.</p>}
        {done.length > 0 && <><h2 className="mt-8 mb-3 font-serif text-xl">Completed</h2><div className="grid gap-5 lg:grid-cols-2">{done.map((g) => <React.Fragment key={g.id}>{GoalCard({ g })}</React.Fragment>)}</div></>}
      </>}
      {modal && <GoalModal goal={modal === 'new' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function GoalModal({ goal, onClose }: { goal: FinancialGoal | null; onClose: () => void }) {
  const { update } = useStore();
  const [name, setName] = useState(goal?.name ?? '');
  const [tdate, setTdate] = useState(goal?.targetDate ?? '');
  const [notes, setNotes] = useState(goal?.notes ?? '');
  const [ms, setMs] = useState('');
  const [err, setErr] = useState('');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Please name your goal.');
    if (tdate && !isValidISO(tdate)) return setErr('Choose a valid date or leave it empty.');
    update((d) => {
      if (goal) { const g = d.financialGoals.find((x) => x.id === goal.id)!; g.name = name.trim(); g.targetDate = tdate || undefined; g.notes = notes.trim() || undefined; }
      else d.financialGoals.push({ id: uid(), name: name.trim(), targetDate: tdate || undefined, notes: notes.trim() || undefined, completed: false, createdAt: Date.now(), manualProgress: 0, milestones: ms.split('\n').map((t) => t.trim()).filter(Boolean).map((t) => ({ id: uid(), text: t, done: false })) });
    }, { toast: goal ? 'Goal updated.' : 'Goal created. One small step at a time.' });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={goal ? 'Edit goal' : 'New financial goal'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <Field label="Goal" htmlFor="fg-name" error={err}><input id="fg-name" autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pay off my credit card" maxLength={80} /></Field>
        <Field label="Target date" htmlFor="fg-date" hint="Optional"><input id="fg-date" type="date" className={inputCls} value={tdate} onChange={(e) => setTdate(e.target.value)} /></Field>
        <Field label="Why it matters to me" htmlFor="fg-notes" hint="Optional. A reminder for future you."><textarea id="fg-notes" rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></Field>
        {!goal && <Field label="Milestones" htmlFor="fg-ms" hint="Optional. One per line. Small steps work best."><textarea id="fg-ms" rows={3} className={inputCls} value={ms} onChange={(e) => setMs(e.target.value)} placeholder={'List my debts\nPay $25 extra this month'} /></Field>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{goal ? 'Save' : 'Create goal'}</Button></div>
      </form>
    </Modal>
  );
}
