import React, { useState } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuHandCoins, LuRepeat } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, EmptyState, IconButton, inputCls, confirmAction, Badge, Modal, Field, MoneyInput, Stat } from '../components/ui';
import { expectedPaychecks, monthTotals, currentMonthKey } from '../lib/calc';
import { addDays, freqLabel, friendlyDate, perMonth, isValidISO, monthLabel } from '../lib/dates';
import { parseMoney, centsToInput, sum } from '../lib/money';
import { deleteTx } from '../lib/actions';
import { INCOME_KINDS, uid } from '../lib/defaults';
import type { IncomeSource, IncomeKind, PayFrequency } from '../lib/types';

export default function Income() {
  const { data, today, money, openQuick, update, date } = useStore();
  const [srcModal, setSrcModal] = useState<IncomeSource | 'new' | null>(null);
  const [kind, setKind] = useState('');
  const key = currentMonthKey(data, today);
  const history = data.transactions.filter((t) => t.type === 'income' && (!kind || t.incomeKind === kind)).sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = expectedPaychecks(data, today, addDays(today, 31)).filter((p) => !p.received);
  const monthlyEstimate = sum(data.incomeSources.filter((s) => s.active).map((s) => Math.round(s.amount * perMonth[s.frequency])));
  const kindLabel = (k?: IncomeKind) => INCOME_KINDS.find((x) => x.value === k)?.label ?? 'Income';

  return (
    <div>
      <PageHeader title="Income" subtitle="Money you've received, and the paychecks you expect. Expected income is shown separately and never counted early."
        actions={<><Button variant="secondary" icon={<LuRepeat aria-hidden />} onClick={() => setSrcModal('new')}>Add regular income</Button><Button icon={<LuPlus aria-hidden />} onClick={() => openQuick('income')}>Record income</Button></>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label={`Received in ${monthLabel(key, 'short')}`} value={money(monthTotals(data, key).income)} tone="success" />
        <Stat label="Expected in the next 31 days" value={money(sum(upcoming.map((p) => p.source.amount)))} hint="Not counted until received" />
        <Stat label="Typical monthly income" value={money(monthlyEstimate)} hint="Estimate from your regular income" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card title="Regular income" subtitle="Your pay schedules">
          {data.incomeSources.length === 0 ? <EmptyState icon={<LuRepeat />} title="No regular income yet" text="Add your paycheck schedule so we can show when money is coming." action={<Button size="sm" onClick={() => setSrcModal('new')}>Add regular income</Button>} /> : (
            <ul className="divide-y divide-line">
              {data.incomeSources.map((s) => {
                const next = expectedPaychecks(data, today, addDays(today, 62)).find((p) => p.source.id === s.id && !p.received);
                return (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{s.name} {!s.active && <Badge>Paused</Badge>}</p>
                      <p className="text-xs text-muted">{kindLabel(s.kind)} · {freqLabel[s.frequency]}{next ? ` · next ${friendlyDate(next.date, today)}` : ''}</p></div>
                    <span className="num">{money(s.amount)}</span>
                    <IconButton label={`Edit ${s.name}`} onClick={() => setSrcModal(s)}><LuPencil aria-hidden /></IconButton>
                    <IconButton label={`Delete ${s.name}`} onClick={async () => { if (await confirmAction({ title: `Delete "${s.name}"?`, message: 'The schedule will be removed. Income you already recorded stays in your history.', confirmLabel: 'Delete', danger: true })) update((d) => { d.incomeSources = d.incomeSources.filter((x) => x.id !== s.id); }, { toast: 'Income source deleted.', undoable: true }); }}><LuTrash2 aria-hidden /></IconButton>
                  </li>
                );
              })}
            </ul>
          )}
          {upcoming.length > 0 && <div className="mt-4 rounded-2xl bg-surface-2 p-4">
            <p className="mb-2 text-sm font-medium">Expected soon</p>
            <ul className="grid gap-1.5 text-sm">{upcoming.slice(0, 5).map((p) => <li key={p.source.id + p.date} className="flex items-center justify-between gap-2"><span>{friendlyDate(p.date, today)} · {p.source.name}</span><span className="flex items-center gap-2"><Badge tone="gold">Expected</Badge><span className="num text-muted">{money(p.source.amount)}</span></span></li>)}</ul>
          </div>}
        </Card>
        <Card title="Income history" action={<select aria-label="Filter by type" className={inputCls + ' w-auto py-2 text-sm'} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All types</option>{INCOME_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>}>
          {history.length === 0 ? <EmptyState icon={<LuHandCoins />} title="No income recorded" text="When money arrives, record it here. That's when it becomes part of your available money." /> : (
            <ul className="divide-y divide-line">
              {history.slice(0, 60).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{t.name}</p><p className="text-xs text-muted">{date(t.date)} · {kindLabel(t.incomeKind)}{t.sourceId ? ' · regular' : ''}</p></div>
                  <span className="num font-medium text-success">+{money(t.amount)}</span>
                  <IconButton label={`Edit ${t.name}`} onClick={() => openQuick('income', t.id)}><LuPencil aria-hidden /></IconButton>
                  <IconButton label={`Delete ${t.name}`} onClick={async () => { if (await confirmAction({ title: 'Delete this income?', message: `"${t.name}" (${money(t.amount)}) on ${date(t.date)} will be removed.`, confirmLabel: 'Delete', danger: true })) update((d) => deleteTx(d, t.id), { toast: 'Income deleted.', undoable: true }); }}><LuTrash2 aria-hidden /></IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {srcModal && <SourceModal src={srcModal === 'new' ? null : srcModal} onClose={() => setSrcModal(null)} />}
    </div>
  );
}

function SourceModal({ src, onClose }: { src: IncomeSource | null; onClose: () => void }) {
  const { data, update, today } = useStore();
  const [name, setName] = useState(src?.name ?? 'Paycheck');
  const [kind, setKind] = useState<IncomeKind>(src?.kind ?? 'salary');
  const [amount, setAmount] = useState(centsToInput(src?.amount));
  const [freq, setFreq] = useState<PayFrequency>(src?.frequency ?? data.settings.payFrequency);
  const [anchor, setAnchor] = useState(src?.anchorDate ?? today);
  const [second, setSecond] = useState(String(src?.secondDay ?? 15));
  const [active, setActive] = useState(src?.active ?? true);
  const [err, setErr] = useState<Record<string, string>>({});
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseMoney(amount); const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Give it a name.';
    if (c === null || c <= 0) errors.amount = freq === 'irregular' ? 'Enter a cautious monthly estimate.' : 'Enter the take-home amount of one paycheck.';
    if (!isValidISO(anchor)) errors.anchor = 'Choose a date.';
    setErr(errors); if (Object.keys(errors).length) return;
    const rec = { name: name.trim(), kind, amount: c!, frequency: freq, anchorDate: anchor, secondDay: freq === 'twice-monthly' ? Math.min(31, Math.max(1, Number(second) || 15)) : undefined, active };
    update((d) => { if (src) { const i = d.incomeSources.findIndex((x) => x.id === src.id); d.incomeSources[i] = { ...d.incomeSources[i], ...rec }; } else d.incomeSources.push({ id: uid(), ...rec }); d.settings.payFrequency = freq; }, { toast: src ? 'Income source updated.' : 'Regular income added.' });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={src ? 'Edit regular income' : 'Add regular income'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="src-name" error={err.name}><input id="src-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
          <Field label="Type" htmlFor="src-kind"><select id="src-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as IncomeKind)}>{INCOME_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></Field>
        </div>
        <Field label="How often?" htmlFor="src-freq"><select id="src-freq" className={inputCls} value={freq} onChange={(e) => setFreq(e.target.value as PayFrequency)}>{(['weekly', 'biweekly', 'twice-monthly', 'monthly', 'irregular'] as PayFrequency[]).map((f) => <option key={f} value={f}>{freqLabel[f]}</option>)}</select></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={freq === 'irregular' ? 'Typical month (estimate)' : 'Take-home per paycheck'} htmlFor="src-amt" error={err.amount}><MoneyInput id="src-amt" value={amount} onChange={setAmount} currency={data.settings.currency} /></Field>
          <Field label={freq === 'twice-monthly' ? 'A recent or next payday (first day)' : 'A recent or next payday'} htmlFor="src-anchor" error={err.anchor}><input id="src-anchor" type="date" className={inputCls} value={anchor} onChange={(e) => setAnchor(e.target.value)} /></Field>
        </div>
        {freq === 'twice-monthly' && <Field label="Second payday each month (day)" htmlFor="src-second"><input id="src-second" type="number" min={1} max={31} className={inputCls} value={second} onChange={(e) => setSecond(e.target.value)} /></Field>}
        {freq === 'irregular' && <p className="text-sm text-muted">Irregular income has no fixed schedule, so it never appears as "expected". Just record it when it arrives.</p>}
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--mauve)]" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (uncheck to pause)</label>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{src ? 'Save' : 'Add'}</Button></div>
      </form>
    </Modal>
  );
}
