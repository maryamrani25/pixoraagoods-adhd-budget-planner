import React, { useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuCopy, LuPlus, LuPencil, LuTrash2, LuWallet, LuCheck, LuX } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, ProgressBar, Badge, EmptyState, IconButton, Modal, Field, inputCls, MoneyInput, confirmAction, Stat, cx } from '../components/ui';
import { PlanVsActual } from '../components/charts';
import { budgetSummary, currentMonthKey, rangeOfMonth } from '../lib/calc';
import { monthLabel, shiftMonthKey } from '../lib/dates';
import { parseMoney, centsToInput } from '../lib/money';
import { deleteCategory } from '../lib/actions';
import { PALETTE, uid } from '../lib/defaults';
import type { Category } from '../lib/types';

export default function Budget() {
  const { data, today, money, update, date } = useStore();
  const thisKey = currentMonthKey(data, today);
  const [key, setKey] = useState(thisKey);
  const [editing, setEditing] = useState<string | null>(null);
  const [val, setVal] = useState('');
  const [catModal, setCatModal] = useState<Category | 'new' | null>(null);
  const s = budgetSummary(data, key);
  const r = rangeOfMonth(data, key);
  const prev = shiftMonthKey(key, -1);
  const hasPrev = !!data.budgets[prev] && Object.values(data.budgets[prev]).some((v) => v > 0);
  const hasThis = !!data.budgets[key] && Object.values(data.budgets[key]).some((v) => v > 0);
  const unbudgeted = s.spentTotal - s.spentInBudgeted;

  const saveLimit = (catId: string) => {
    const c = val.trim() === '' ? 0 : parseMoney(val);
    if (c === null || c < 0) return;
    update((d) => { d.budgets[key] = { ...(d.budgets[key] || {}), [catId]: c }; });
    setEditing(null);
  };
  const copyPrev = async () => {
    if (hasThis && !(await confirmAction({ title: 'Replace this month\'s limits?', message: `This copies ${monthLabel(prev)}'s spending limits into ${monthLabel(key)}, replacing what's there now.`, confirmLabel: 'Copy limits' }))) return;
    update((d) => { d.budgets[key] = { ...(d.budgets[prev] || {}) }; }, { toast: `Copied limits from ${monthLabel(prev)}.`, undoable: true });
  };
  const status = (st: string, rem: number) => st === 'over' ? <Badge tone="danger">Over by {money(-rem)}</Badge> : st === 'at' ? <Badge tone="warning">Right at the limit</Badge> : st === 'near' ? <Badge tone="warning">Getting close</Badge> : st === 'ok' ? <Badge tone="success">On track</Badge> : null;

  return (
    <div>
      <PageHeader title="Monthly Budget" subtitle="Give your spending a few gentle limits. Change them any time, nothing is set in stone."
        actions={<><Button variant="secondary" icon={<LuCopy aria-hidden />} onClick={copyPrev} disabled={!hasPrev}>Copy last month</Button><Button icon={<LuPlus aria-hidden />} onClick={() => setCatModal('new')}>New category</Button></>} />

      <div className="mb-5 flex items-center gap-2">
        <IconButton label="Previous month" onClick={() => setKey(shiftMonthKey(key, -1))}><LuChevronLeft aria-hidden /></IconButton>
        <div className="min-w-44 text-center"><p className="font-serif text-xl">{monthLabel(key)}</p><p className="text-xs text-muted">{date(r.from, false)} – {date(r.to, false)}</p></div>
        <IconButton label="Next month" onClick={() => setKey(shiftMonthKey(key, 1))}><LuChevronRight aria-hidden /></IconButton>
        {key !== thisKey && <Button size="sm" variant="ghost" onClick={() => setKey(thisKey)}>Back to this month</Button>}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Planned" value={money(s.planned)} hint="Total of your limits" />
        <Stat label="Spent (budgeted categories)" value={money(s.spentInBudgeted)} />
        <Stat label="Left to spend" value={money(s.remaining)} tone={s.remaining < 0 ? 'danger' : 'success'} hint={s.remaining < 0 ? "A little over, and that's okay. Adjust a limit if needed." : undefined} />
        <Stat label="Spending without a limit" value={money(unbudgeted)} hint="In categories with no limit set" />
      </div>

      {!hasThis && (
        <Card className="mb-5"><EmptyState icon={<LuWallet />} title={`No limits set for ${monthLabel(key)} yet`} text="Start with just two or three categories you care about, like Groceries and Dining. Click a category's limit below to set it."
          action={hasPrev ? <Button icon={<LuCopy aria-hidden />} onClick={copyPrev}>Copy {monthLabel(prev)}'s budget</Button> : undefined} /></Card>
      )}

      <Card padded={false}>
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr_auto] gap-3 border-b border-line px-6 py-3 text-xs font-medium tracking-wide text-muted uppercase md:grid">
          <span>Category</span><span className="text-right">Limit</span><span className="text-right">Spent</span><span className="text-right">Left</span><span>Progress</span><span className="w-20" />
        </div>
        <ul className="divide-y divide-line">
          {s.lines.map((l) => (
            <li key={l.categoryId} className="grid grid-cols-2 items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr_auto]">
              <span className="flex items-center gap-2.5 font-medium text-ink"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden />{l.name}</span>
              <span className="text-right md:order-none">
                {editing === l.categoryId ? (
                  <form className="flex items-center justify-end gap-1" onSubmit={(e) => { e.preventDefault(); saveLimit(l.categoryId); }}>
                    <div className="w-28"><MoneyInput value={val} onChange={setVal} currency={data.settings.currency} autoFocus /></div>
                    <IconButton label="Save limit" type="submit"><LuCheck aria-hidden /></IconButton>
                    <IconButton label="Cancel" onClick={() => setEditing(null)}><LuX aria-hidden /></IconButton>
                  </form>
                ) : (
                  <button className="num rounded-lg px-2 py-1 text-ink hover:bg-surface-2" onClick={() => { setEditing(l.categoryId); setVal(l.limit ? centsToInput(l.limit) : ''); }} aria-label={`${l.name} limit: ${l.limit ? money(l.limit) : 'not set'}. Click to change.`}>
                    {l.limit ? money(l.limit) : <span className="text-sm text-mauve">Set limit</span>}
                  </button>
                )}
              </span>
              <span className="num text-sm text-muted md:text-right md:text-[15px] md:text-ink"><span className="md:hidden">Spent </span>{money(l.spent)}</span>
              <span className={cx('num text-right text-sm md:text-[15px]', l.limit && l.remaining < 0 ? 'text-danger' : 'text-ink')}>{l.limit ? <><span className="md:hidden">Left </span>{money(l.remaining)}</> : <span className="text-muted">—</span>}</span>
              <span className="col-span-2 flex items-center gap-3 md:col-span-1">{l.limit ? <ProgressBar value={l.spent} max={l.limit} tone={l.state === 'over' ? 'danger' : l.state === 'near' || l.state === 'at' ? 'warning' : 'mauve'} label={`${l.name}: ${Math.round(l.pct)}% used`} /> : <span className="text-xs text-muted">No limit</span>}{status(l.state, l.remaining)}</span>
              <span className="col-span-2 flex justify-end gap-1 md:col-span-1 md:w-20">
                <IconButton label={`Edit ${l.name} category`} onClick={() => setCatModal(data.categories.find((c) => c.id === l.categoryId)!)}><LuPencil aria-hidden /></IconButton>
                {l.categoryId !== 'other' && <IconButton label={`Delete ${l.name} category`} onClick={async () => {
                  if (await confirmAction({ title: `Delete "${l.name}"?`, message: 'Any expenses and bills in this category will move to "Other". Its limits will be removed.', confirmLabel: 'Delete category', danger: true }))
                    update((d) => deleteCategory(d, l.categoryId), { toast: `"${l.name}" deleted.`, undoable: true });
                }}><LuTrash2 aria-hidden /></IconButton>}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {hasThis && (
        <Card className="mt-5" title="Planned vs. actual" subtitle="Lighter bar = your limit · darker bar = what you've spent">
          <PlanVsActual format={money} rows={s.lines.filter((l) => l.limit > 0 || l.spent > 0).map((l) => ({ name: l.name, planned: l.limit, actual: l.spent, color: l.color }))} />
        </Card>
      )}
      {key > thisKey && <p className="mt-4 text-sm text-muted">You're planning ahead for {monthLabel(key)}. Spending will appear here once that month starts.</p>}
      {catModal && <CategoryModal cat={catModal === 'new' ? null : catModal} onClose={() => setCatModal(null)} />}
    </div>
  );
}

function CategoryModal({ cat, onClose }: { cat: Category | null; onClose: () => void }) {
  const { data, update } = useStore();
  const [name, setName] = useState(cat?.name ?? '');
  const [color, setColor] = useState(cat?.color ?? PALETTE[data.categories.length % PALETTE.length]);
  const [err, setErr] = useState('');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setErr('Please give the category a name.');
    if (data.categories.some((c) => c.name.toLowerCase() === n.toLowerCase() && c.id !== cat?.id)) return setErr('You already have a category with that name.');
    update((d) => { if (cat) { const c = d.categories.find((x) => x.id === cat.id)!; c.name = n; c.color = color; } else d.categories.splice(Math.max(0, d.categories.length - 1), 0, { id: uid(), name: n, color }); }, { toast: cat ? 'Category updated.' : `"${n}" added.` });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={cat ? 'Edit category' : 'New category'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <Field label="Name" htmlFor="cat-name" error={err}><input id="cat-name" autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="e.g. Pets" /></Field>
        <Field label="Colour">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
            {PALETTE.map((p) => <button key={p} type="button" role="radio" aria-checked={color === p} aria-label={`Colour ${p}`} onClick={() => setColor(p)} className={cx('h-9 w-9 rounded-full border-2', color === p ? 'border-ink' : 'border-transparent')} style={{ background: p }} />)}
          </div>
        </Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{cat ? 'Save' : 'Add category'}</Button></div>
      </form>
    </Modal>
  );
}
