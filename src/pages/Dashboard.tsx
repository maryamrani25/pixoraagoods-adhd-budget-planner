import React from 'react';
import { LuPlus, LuHandCoins, LuCalendarDays, LuPiggyBank, LuWallet, LuFootprints, LuArrowRight, LuCheck, LuShieldCheck, LuCircleCheck } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, ProgressBar, Badge, Stat, EmptyState, InfoTip, cx } from '../components/ui';
import { BarChart } from '../components/charts';
import { safeToSpend, monthTotals, currentMonthKey, upcomingBills, overdueBills, nextPayday, budgetSummary, goalInfo, totalDebt, nextSmallStep, monthlySeries, lastMonths, debtBalance } from '../lib/calc';
import { friendlyDate, monthLabel, diffDays } from '../lib/dates';
import { formatCompact, sum } from '../lib/money';
import { markBillPaid } from '../lib/actions';
import type { CheckIn } from '../lib/types';

export const KIND_MESSAGES = ["Let's take one small step.", "You don't need to fix everything today.", 'Your progress matters.', 'Start with what you know.', "It's okay to begin again.", 'Small steps still move you forward.', 'Looking at your money is a brave thing to do.'];

export default function Dashboard() {
  const { data, today, money, openQuick, update } = useStore();
  const key = currentMonthKey(data, today);
  const totals = monthTotals(data, key);
  const sts = safeToSpend(data, today);
  const pay = nextPayday(data, today);
  const overdue = overdueBills(data, today);
  const upcoming = upcomingBills(data, today, 14);
  const budget = budgetSummary(data, key);
  const step = nextSmallStep(data, today);
  const debt = totalDebt(data);
  const debtOriginal = sum(data.debts.map((d) => d.originalBalance));
  const goals = data.goals.map((g) => ({ g, ...goalInfo(data, g, today) }));
  const savedTotal = sum(goals.map((x) => x.saved)); const targetTotal = sum(goals.map((x) => x.g.target));
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const msg = KIND_MESSAGES[Number(today.slice(8)) % KIND_MESSAGES.length];
  const d = data.settings.dashboard;
  const series = monthlySeries(data, lastMonths(data, today, 6).from, key);
  const fgoals = data.financialGoals.filter((g) => !g.completed).slice(0, 3);

  const stepAction = () => { if (!step.action) return; if (step.action.to === '#add-expense') openQuick('expense'); else location.hash = '#/' + step.action.to; };

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="font-serif text-3xl text-ink sm:text-[2.2rem]">{hello}{data.settings.name ? `, ${data.settings.name}` : ''}.</h1>
        <p className="text-muted">{msg}</p>
      </header>

      {/* Next small step */}
      <section aria-labelledby="step-h" className="relative overflow-hidden rounded-3xl bg-plum p-5 text-white sm:p-6 dark:border dark:border-line dark:bg-surface-2">
        <div aria-hidden className="absolute -top-16 -right-10 h-48 w-48 rounded-full border-[18px] border-gold/25" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold text-xl text-plum"><LuFootprints aria-hidden /></span>
            <div><h2 id="step-h" className="text-xs font-semibold tracking-widest text-gold uppercase">Your next small step</h2><p className="mt-1 max-w-xl text-[16px] leading-relaxed">{step.text}</p></div>
          </div>
          {step.action && <Button variant="gold" onClick={stepAction} className="shrink-0">{step.action.label} <LuArrowRight aria-hidden /></Button>}
        </div>
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: 'Add Expense', icon: LuPlus, on: () => openQuick('expense'), primary: true },
          { label: 'Add Income', icon: LuHandCoins, on: () => openQuick('income') },
          { label: 'Add Bill', icon: LuCalendarDays, on: () => openQuick('bill') },
          { label: 'Add Savings', icon: LuPiggyBank, on: () => openQuick('savings') },
          { label: 'View Budget', icon: LuWallet, on: () => (location.hash = '#/budget') },
        ].map((a) => (
          <button key={a.label} onClick={a.on} className={cx('flex min-h-14 items-center gap-2.5 rounded-2xl border px-4 text-left text-[14.5px] font-medium transition', a.primary ? 'col-span-2 border-primary bg-primary text-on-primary hover:opacity-90 sm:col-span-1' : 'border-line bg-surface text-ink hover:bg-surface-2')}>
            <a.icon aria-hidden className="h-5 w-5 shrink-0" />{a.label}
          </button>
        ))}
      </section>

      {/* Money at a glance */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <a href="#/safe" className="group rounded-3xl border border-line bg-surface p-4 transition hover:border-mauve sm:p-5 xl:col-span-2">
          <div className="flex items-center gap-2 text-sm text-muted"><LuShieldCheck aria-hidden className="text-success" /> Safe to spend until {sts.horizonLabel}</div>
          {sts.ready ? <>
            <div className={cx('num mt-1.5 font-serif text-4xl', (sts.safe ?? 0) < 0 ? 'text-danger' : 'text-ink')}>{money(sts.safe ?? 0)}</div>
            <div className="mt-1 text-xs text-muted">{(sts.safe ?? 0) >= 0 ? `About ${money(sts.perDay ?? 0)} a day for ${sts.daysLeft} day${sts.daysLeft === 1 ? '' : 's'}.` : 'Your reserved money is more than you have right now. Open for a gentle plan.'} <span className="font-medium text-mauve group-hover:underline">See how it's worked out</span></div>
          </> : <p className="mt-2 text-[15px] text-ink">Add your bank balance to see this number. <span className="font-medium text-mauve">Set it up</span></p>}
        </a>
        <Stat label="Available money" value={sts.available === null ? '—' : money(sts.available)} hint={sts.balance ? 'Your balance plus everything logged since' : 'Not set yet'} info="The balance you entered, plus income received, minus spending, savings transfers and debt payments recorded after that date." />
        <Stat label="Reserved for bills & plans" value={money(sts.reservedTotal)} hint={`${sts.bills.length} bill${sts.bills.length === 1 ? '' : 's'}, ${sts.savings.length} savings plan${sts.savings.length === 1 ? '' : 's'}${sts.other.length ? ', other' : ''}`} />
        <Stat label={`Income in ${monthLabel(key, 'short')}`} value={money(totals.income)} hint="Money actually received" tone="success" />
        <Stat label={`Spent in ${monthLabel(key, 'short')}`} value={money(totals.expenses)} hint={budget.planned ? `${money(Math.max(0, budget.remaining))} left of ${money(budget.planned)} budget` : 'No budget set yet'} />
        <Stat label="Next payday" value={pay ? friendlyDate(pay.date, today) : '—'} hint={pay ? `${pay.source.name} · ${money(pay.source.amount)} expected` : 'Add a regular income source'} />
        <Stat label="Outstanding debt" value={money(debt)} hint={debtOriginal ? `${Math.round(((debtOriginal - debt) / debtOriginal) * 100)}% paid off overall` : 'No debts added'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card title="Upcoming bills" subtitle="Next 14 days" action={<a href="#/bills" className="text-sm font-medium text-mauve hover:underline">All bills</a>}>
          {overdue.length + upcoming.length === 0 ? <EmptyState icon={<LuCircleCheck />} title="Nothing due in the next two weeks" text="Enjoy the breathing room." /> : (
            <ul className="divide-y divide-line">
              {[...overdue, ...upcoming].slice(0, 6).map((o) => {
                const late = o.due < today; const n = diffDays(today, o.due);
                return (
                  <li key={o.bill.id + o.due} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{o.bill.name}</p><p className="text-xs text-muted">{late ? 'Was due ' : 'Due '}{friendlyDate(o.due, today)}</p></div>
                    {late ? <Badge tone="danger">Past due</Badge> : n <= data.settings.reminderDays && data.settings.remindersEnabled ? <Badge tone="warning">Soon</Badge> : null}
                    <span className="num w-24 text-right font-medium">{money(o.bill.amount)}</span>
                    <Button size="sm" variant="secondary" aria-label={`Mark ${o.bill.name} as paid`} onClick={() => update((dd) => markBillPaid(dd, o.bill, o.due, today), { toast: `${o.bill.name} marked as paid.`, undoable: true })}><LuCheck aria-hidden /> Paid</Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {d.showCheckIn && <CheckInCard />}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="This month's budget" subtitle={monthLabel(key)} action={<a href="#/budget" className="text-sm font-medium text-mauve hover:underline">Open</a>}>
          {budget.planned === 0 ? <EmptyState title="No budget yet" text="Set a few spending limits. Start with just one or two categories." action={<Button size="sm" onClick={() => (location.hash = '#/budget')}>Create budget</Button>} /> : (
            <div className="grid gap-3.5">
              {budget.lines.filter((l) => l.limit > 0).sort((a, b) => b.pct - a.pct).slice(0, 5).map((l) => (
                <div key={l.categoryId}>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-ink">{l.name}</span><span className="num text-muted">{money(l.spent)} / {money(l.limit)}</span></div>
                  <ProgressBar value={l.spent} max={l.limit} tone={l.state === 'over' ? 'danger' : l.state === 'near' || l.state === 'at' ? 'warning' : 'mauve'} label={`${l.name} budget used`} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {d.showGoals && (
          <Card title="Savings progress" subtitle={targetTotal ? `${money(savedTotal)} saved of ${money(targetTotal)}` : undefined} action={<a href="#/savings" className="text-sm font-medium text-mauve hover:underline">Open</a>}>
            {goals.length === 0 ? <EmptyState icon={<LuPiggyBank />} title="No savings goals yet" text="An emergency fund is a lovely first goal. Even $10 is a start." action={<Button size="sm" onClick={() => (location.hash = '#/savings')}>Create a goal</Button>} /> : (
              <div className="grid gap-3.5">
                {goals.slice(0, 4).map(({ g, saved, pct, done }) => (
                  <div key={g.id}>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-ink">{g.name} {done && <Badge tone="success">Reached</Badge>}</span><span className="num text-muted">{money(saved)} / {money(g.target)}</span></div>
                    <ProgressBar value={pct} max={100} tone="success" label={`${g.name} progress`} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {d.showDebt && (
          <Card title="Debt payoff" action={<a href="#/debt" className="text-sm font-medium text-mauve hover:underline">Open</a>}>
            {data.debts.length === 0 ? <EmptyState title="No debts tracked" text="If you have any, adding them here helps you see progress." /> : (
              <div className="grid gap-3.5">
                {data.debts.map((x) => { const bal = debtBalance(data, x); return (
                  <div key={x.id}><div className="mb-1 flex justify-between text-sm"><span className="text-ink">{x.name}</span><span className="num text-muted">{money(bal)} left</span></div>
                    <ProgressBar value={x.originalBalance - bal} max={x.originalBalance} tone="gold" label={`${x.name} paid off`} /></div>); })}
              </div>
            )}
          </Card>
        )}
        <Card title="Financial goals" action={<a href="#/goals" className="text-sm font-medium text-mauve hover:underline">Open</a>}>
          {fgoals.length === 0 ? <EmptyState title="No goals yet" text="What would make money feel calmer for you? Write it down as a goal." action={<Button size="sm" onClick={() => (location.hash = '#/goals')}>Add a goal</Button>} /> : (
            <div className="grid gap-3.5">
              {fgoals.map((g) => { const p = g.milestones.length ? (g.milestones.filter((m) => m.done).length / g.milestones.length) * 100 : g.manualProgress ?? 0; return (
                <div key={g.id}><div className="mb-1 flex justify-between text-sm"><span className="text-ink">{g.name}</span><span className="num text-muted">{Math.round(p)}%</span></div><ProgressBar value={p} max={100} label={`${g.name} progress`} /></div>); })}
            </div>
          )}
        </Card>
      </div>

      {d.showCharts && (
        <Card title="Income and spending" subtitle="Last 6 months, money received vs. money spent" action={<a href="#/reports" className="text-sm font-medium text-mauve hover:underline">Reports</a>}>
          <BarChart label="Income and expenses for the last six months" labels={series.map((s) => monthLabel(s.key, 'short'))} format={(v) => formatCompact(v, data.settings.currency)}
            series={[{ name: 'Income', color: 'var(--success)', values: series.map((s) => s.income) }, { name: 'Expenses', color: 'var(--mauve)', values: series.map((s) => s.expenses) }]} />
        </Card>
      )}
      <p className="text-center text-xs text-muted">This planner helps you organize money. It isn't financial, tax or medical advice. <InfoTip text="Numbers come only from what you enter. Nothing is connected to your bank." /></p>
    </div>
  );
}

function CheckInCard() {
  const { data, today, update } = useStore();
  const ci = data.checkIns.find((c) => c.date === today);
  const monthCount = data.checkIns.filter((c) => c.date.slice(0, 7) === today.slice(0, 7)).length;
  const set = (patch: Partial<CheckIn>) => update((d) => {
    const i = d.checkIns.findIndex((c) => c.date === today);
    if (i >= 0) d.checkIns[i] = { ...d.checkIns[i], ...patch }; else d.checkIns.push({ date: today, mood: 'okay', loggedSpending: false, ...patch });
  });
  const moods: { v: CheckIn['mood']; label: string; emoji: string }[] = [{ v: 'calm', label: 'Calm', emoji: '🙂' }, { v: 'okay', label: 'Okay', emoji: '😐' }, { v: 'stressed', label: 'Stressed', emoji: '😟' }];
  return (
    <Card title="Daily check-in" subtitle={monthCount ? `You've checked in ${monthCount} day${monthCount === 1 ? '' : 's'} this month. Missed days are fine.` : 'A 10-second pause. No pressure.'}>
      <p className="mb-2 text-sm text-ink">How do you feel about money today?</p>
      <div className="mb-4 flex gap-2" role="radiogroup" aria-label="How do you feel about money today?">
        {moods.map((m) => (
          <button key={m.v} type="button" role="radio" aria-checked={ci?.mood === m.v} onClick={() => set({ mood: m.v })}
            className={cx('flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border text-sm transition', ci?.mood === m.v ? 'border-mauve bg-mauve/10 font-medium text-ink' : 'border-line text-muted hover:bg-surface-2')}>
            <span aria-hidden>{m.emoji}</span>{m.label}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-surface-2 px-3 text-sm text-ink">
        <input type="checkbox" className="h-4 w-4 accent-[var(--mauve)]" checked={!!ci?.loggedSpending} onChange={(e) => set({ loggedSpending: e.target.checked })} />
        I've logged today's spending (or there was none)
      </label>
      {ci?.mood === 'stressed' && <p className="mt-3 text-sm text-muted">That's understandable. Try just one thing: look at your next bill, or add one expense. You don't need to fix everything today.</p>}
      {ci?.mood === 'calm' && <p className="mt-3 text-sm text-muted">Lovely. Your progress matters.</p>}
    </Card>
  );
}
