import type { AppData, Category, Settings } from './types';

export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID().slice(0, 13) : Math.random().toString(36).slice(2, 15);

export const PALETTE = ['#765477', '#648A72', '#D6B68F', '#5E7FA3', '#C86F78', '#8E7AB5', '#D5A45B', '#4F9A94', '#A3677F', '#7C8B4F', '#B98A6A', '#827B88'];

export const DEFAULT_CATEGORY_NAMES = ['Housing', 'Groceries', 'Transportation', 'Utilities', 'Healthcare', 'Shopping', 'Entertainment', 'Personal Care', 'Education', 'Subscriptions', 'Dining', 'Other'];
export const defaultCategories = (): Category[] =>
  DEFAULT_CATEGORY_NAMES.map((name, i) => ({ id: name === 'Other' ? 'other' : name.toLowerCase().replace(/\s+/g, '-'), name, color: PALETTE[i % PALETTE.length] }));

export const defaultSettings = (): Settings => ({
  name: '', currency: 'USD', dateFormat: 'MDY', theme: 'system', monthStartDay: 1, payFrequency: 'biweekly',
  safeToSpendHorizon: 'payday', remindersEnabled: true, reminderDays: 3,
  dashboard: { showCharts: true, showCheckIn: true, showGoals: true, showDebt: true }, onboarded: false,
});

export const emptyData = (): AppData => ({
  schema: 1, settings: defaultSettings(), categories: defaultCategories(), budgets: {}, transactions: [], incomeSources: [],
  bills: [], goals: [], debts: [], financialGoals: [], paycheckPlans: [], reserves: [], checkIns: [], isDemo: false, updatedAt: Date.now(),
});

export const PAYMENT_METHODS = ['Debit card', 'Credit card', 'Cash', 'Bank transfer', 'Mobile wallet', 'Other'];
export const INCOME_KINDS: { value: import('./types').IncomeKind; label: string }[] = [
  { value: 'salary', label: 'Salary' }, { value: 'freelance', label: 'Freelance' }, { value: 'business', label: 'Business' }, { value: 'side', label: 'Side income' }, { value: 'other', label: 'Other income' },
];
export const BILL_KINDS: { value: import('./types').BillKind; label: string }[] = [
  { value: 'rent', label: 'Rent / Mortgage' }, { value: 'electricity', label: 'Electricity' }, { value: 'internet', label: 'Internet' }, { value: 'phone', label: 'Phone' },
  { value: 'subscription', label: 'Subscription' }, { value: 'insurance', label: 'Insurance' }, { value: 'credit-card', label: 'Credit card payment' }, { value: 'loan', label: 'Loan payment' }, { value: 'other', label: 'Other bill' },
];
