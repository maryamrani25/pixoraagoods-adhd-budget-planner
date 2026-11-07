import React, { useEffect, useId, useRef, useState } from 'react';
import { LuInfo, LuX } from 'react-icons/lu';
import { currencySymbol } from '../lib/money';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ---------- Layout ----------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl leading-tight text-ink sm:text-[2.1rem]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, subtitle, action, children, className, padded = true, id }: { title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode; className?: string; padded?: boolean; id?: string }) {
  return (
    <section id={id} className={cx('rounded-3xl border border-line bg-surface shadow-[0_1px_2px_rgba(48,33,63,0.04),0_8px_24px_-12px_rgba(48,33,63,0.12)]', padded && 'p-5 sm:p-6', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[17px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------- Buttons ----------
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'; size?: 'sm' | 'md'; icon?: React.ReactNode };
export function Button({ variant = 'primary', size = 'md', icon, className, children, type = 'button', ...rest }: BtnProps) {
  const v = {
    primary: 'bg-primary text-on-primary hover:opacity-90',
    gold: 'bg-gold text-plum hover:brightness-95',
    secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
    ghost: 'text-ink hover:bg-surface-2',
    danger: 'bg-danger text-white hover:opacity-90 dark:text-plum',
  }[variant];
  return (
    <button type={type} className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'min-h-9 px-3 text-sm' : 'px-4 text-[15px]', v, className)} {...rest}>
      {icon}{children}
    </button>
  );
}
export function IconButton({ label, children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} className={cx('inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink', className)} {...rest}>{children}</button>;
}

// ---------- Forms ----------
export const inputCls = 'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-muted/70 focus:border-mauve focus:outline-none focus:ring-2 focus:ring-mauve/25';
export function Field({ label, hint, error, children, htmlFor, className }: { label: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label>
      {children}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
export function MoneyInput({ value, onChange, currency, id, placeholder = '0.00', autoFocus, invalid }: { value: string; onChange: (v: string) => void; currency: string; id?: string; placeholder?: string; autoFocus?: boolean; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">{currencySymbol(currency)}</span>
      <input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        className={cx(inputCls, 'num', currencySymbol(currency).length > 1 ? 'pl-12' : 'pl-8')} />
    </div>
  );
}

// ---------- Feedback ----------
export function ProgressBar({ value, max, tone = 'mauve', label, size = 'md' }: { value: number; max: number; tone?: 'mauve' | 'success' | 'warning' | 'danger' | 'gold'; label?: string; size?: 'sm' | 'md' }) {
  const p = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = { mauve: 'bg-mauve', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', gold: 'bg-gold' }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)} className={cx('w-full overflow-hidden rounded-full bg-surface-2', size === 'sm' ? 'h-1.5' : 'h-2.5')}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${p}%` }} />
    </div>
  );
}
export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'gold' | 'mauve'; children: React.ReactNode }) {
  const t = { neutral: 'bg-surface-2 text-muted', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', gold: 'bg-gold/25 text-ink', mauve: 'bg-mauve/15 text-mauve' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', t)}>{children}</span>;
}
export function Stat({ label, value, hint, tone, icon, info }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'success' | 'warning' | 'danger'; icon?: React.ReactNode; info?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm text-muted">{icon}<span>{label}</span>{info && <InfoTip text={info} />}</div>
      <div className={cx('num mt-1.5 text-2xl font-semibold tracking-tight', tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink')}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
export function EmptyState({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-xl text-mauve">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warning' | 'success' | 'danger'; children: React.ReactNode; icon?: React.ReactNode }) {
  const t = { info: 'bg-surface-2 text-ink', warning: 'bg-warning-soft text-ink', success: 'bg-success-soft text-ink', danger: 'bg-danger-soft text-ink' }[tone];
  return <div className={cx('flex gap-3 rounded-2xl px-4 py-3 text-sm', t)}>{icon}<div className="min-w-0">{children}</div></div>;
}

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button type="button" aria-label="More info" aria-expanded={open} aria-describedby={open ? id : undefined} onClick={() => setOpen((o) => !o)} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><LuInfo aria-hidden /></button>
      {open && <span id={id} role="tooltip" className="absolute top-7 left-1/2 z-30 w-64 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-xs leading-relaxed font-normal text-ink shadow-lg">{text}</span>}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('min-h-9 rounded-xl px-3 text-sm font-medium transition', value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>{o.label}</button>
      ))}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'md' | 'lg' }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } }
    if (!open && d.open) d.close();
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="modal-title"
      className={cx('m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-hidden rounded-3xl border border-line bg-surface p-0 text-ink shadow-2xl', size === 'lg' ? 'max-w-2xl' : 'max-w-lg')}>
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="modal-title" className="font-serif text-xl">{title}</h2>
          <IconButton label="Close" onClick={onClose}><LuX aria-hidden /></IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}

// ---------- Confirm (promise based) ----------
type ConfirmReq = { title: string; message: string; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void };
let pushConfirm: ((r: ConfirmReq) => void) | null = null;
export const confirmAction = (o: Omit<ConfirmReq, 'resolve'>) => new Promise<boolean>((resolve) => { if (pushConfirm) pushConfirm({ ...o, resolve }); else resolve(window.confirm(o.message)); });
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  useEffect(() => { pushConfirm = setReq; return () => { pushConfirm = null; }; }, []);
  const done = (v: boolean) => { req?.resolve(v); setReq(null); };
  return (
    <Modal open={!!req} onClose={() => done(false)} title={req?.title ?? ''}
      footer={<><Button variant="secondary" onClick={() => done(false)}>Cancel</Button><Button variant={req?.danger ? 'danger' : 'primary'} onClick={() => done(true)} autoFocus>{req?.confirmLabel ?? 'Confirm'}</Button></>}>
      <p className="text-[15px] text-ink">{req?.message}</p>
    </Modal>
  );
}

export const srOnly = 'sr-only';
