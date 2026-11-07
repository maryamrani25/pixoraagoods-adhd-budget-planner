// All money values are stored as integer cents to avoid rounding errors.
export type Cents = number;
export type ISODate = string; // YYYY-MM-DD

export type Frequency = 'once' | 'weekly' | 'biweekly' | 'twice-monthly' | 'monthly' | 'quarterly' | 'yearly' | 'irregular';
export type PayFrequency = 'weekly' | 'biweekly' | 'twice-monthly' | 'monthly' | 'irregular';
export type IncomeKind = 'salary' | 'freelance' | 'business' | 'side' | 'other';
export type BillKind = 'rent' | 'electricity' | 'internet' | 'phone' | 'subscription' | 'insurance' | 'credit-card' | 'loan' | 'other';

export interface Category { id: string; name: string; color: string; }

export interface IncomeSource {
  id: string; name: string; kind: IncomeKind; amount: Cents;
  frequency: PayFrequency; anchorDate: ISODate; // first/next expected pay date
  secondDay?: number; // for twice-monthly: second day of month (first day = anchor day)
  active: boolean;
}

export type TxType = 'income' | 'expense' | 'savings' | 'debt';
export interface Transaction {
  id: string; type: TxType; name: string; amount: Cents; date: ISODate; notes?: string;
  // expense
  categoryId?: string; paymentMethod?: string;
  // income
  incomeKind?: IncomeKind; sourceId?: string; expectedDate?: ISODate;
  // savings: deposit (+) or withdraw (-) for a goal
  goalId?: string; direction?: 'in' | 'out';
  // debt: payment reduces balance, charge increases it
  debtId?: string; debtAction?: 'payment' | 'charge';
  // links
  billId?: string; billDue?: ISODate;
  // false = does not move money in/out of the spending account (e.g. opening savings)
  affectsCash: boolean;
  createdAt: number;
}

export interface Bill {
  id: string; name: string; kind: BillKind; amount: Cents; dueDate: ISODate; frequency: Frequency;
  categoryId?: string; linkedDebtId?: string; reminderDays: number; active: boolean; notes?: string;
}

export interface SavingsGoal {
  id: string; name: string; target: Cents; targetDate?: ISODate; monthlyPlan: Cents; contributionDay?: number; color: string; createdAt: number;
}

export interface Debt {
  id: string; name: string; originalBalance: Cents; startBalance: Cents; interestRate: number; // APR %
  minimumPayment: Cents; dueDay: number; createdAt: number;
}

export interface Milestone { id: string; text: string; done: boolean; }
export interface FinancialGoal {
  id: string; name: string; targetDate?: ISODate; milestones: Milestone[]; manualProgress?: number; completed: boolean; notes?: string; createdAt: number;
}

export interface Allocation { id: string; kind: 'bill' | 'savings' | 'category' | 'debt' | 'other'; refId?: string; label: string; amount: Cents; }
export interface PaycheckPlan { key: string; allocations: Allocation[]; } // key = income tx id, or `exp:<sourceId>:<date>`

export interface Reserve { id: string; name: string; amount: Cents; }

export interface CheckIn { date: ISODate; mood: 'calm' | 'okay' | 'stressed'; loggedSpending: boolean; note?: string; }

export interface Settings {
  name: string;
  currency: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  theme: 'light' | 'dark' | 'system';
  monthStartDay: number; // 1–28: financial month starts on this day
  payFrequency: PayFrequency;
  safeToSpendHorizon: 'payday' | 'month';
  remindersEnabled: boolean;
  reminderDays: number;
  dashboard: { showCharts: boolean; showCheckIn: boolean; showGoals: boolean; showDebt: boolean; };
  onboarded: boolean;
  balance?: { amount: Cents; asOf: ISODate }; // manually entered spending-account balance
}

export interface AppData {
  schema: 1;
  settings: Settings;
  categories: Category[];
  budgets: Record<string, Record<string, Cents>>; // monthKey (YYYY-MM) -> categoryId -> limit
  transactions: Transaction[];
  incomeSources: IncomeSource[];
  bills: Bill[];
  goals: SavingsGoal[];
  debts: Debt[];
  financialGoals: FinancialGoal[];
  paycheckPlans: PaycheckPlan[];
  reserves: Reserve[];
  checkIns: CheckIn[];
  isDemo: boolean;
  updatedAt: number;
}
