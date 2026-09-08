export type TransactionType = 'income' | 'expense';

export type FinanceTransaction = {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  createdAt: string;
  source: 'manual' | 'photo' | 'sample';
  receiptDataUrl?: string;
  status: 'paid' | 'planned';
  recurrenceGroupId?: string;
  recurrenceIndex?: number;
  recurrenceTotal?: number;
};

export type FinanceAlert = {
  id: string;
  title: string;
  dueDate: string;
  amount: number;
  paid: boolean;
};

export type FinanceAccount = {
  id: string;
  name: string;
  kind: 'checking' | 'savings' | 'cash' | 'credit';
  balance: number;
};

export type FinanceGoal = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
};

export type FinanceBudget = {
  category: string;
  limit: number;
};

export type FinanceState = {
  version: 4;
  transactions: FinanceTransaction[];
  alerts: FinanceAlert[];
  accounts: FinanceAccount[];
  goals: FinanceGoal[];
  budgets: FinanceBudget[];
  updatedAt: string;
};

type LegacyFinanceState = {
  version: 2 | 3;
  transactions: Array<Omit<FinanceTransaction, 'status'> & { status?: 'paid' | 'planned' }>;
  alerts: FinanceAlert[];
  accounts?: FinanceAccount[];
  goals?: FinanceGoal[];
  budgets?: FinanceBudget[];
  updatedAt: string;
};

type StoredFinanceState = FinanceState | LegacyFinanceState;

const DB_NAME = 'clarofin-local';
const STORE_NAME = 'finance';
const STATE_KEY = 'primary-state';
const BACKUP_KEY = 'clarofin-backup-v4';
const LEGACY_BACKUP_KEYS = ['clarofin-backup-v3', 'clarofin-backup-v2'];
const DEMO_ALERT_IDS = new Set(['energia', 'internet']);

export const initialFinanceState: FinanceState = {
  version: 4,
  transactions: [],
  alerts: [],
  accounts: [],
  goals: [],
  budgets: [],
  updatedAt: new Date().toISOString(),
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isFinanceState(value: unknown): value is StoredFinanceState {
  if (!value || typeof value !== 'object') return false;
  const state = value as { version?: number; transactions?: unknown; alerts?: unknown };
  return (state.version === 2 || state.version === 3 || state.version === 4) && Array.isArray(state.transactions) && Array.isArray(state.alerts);
}

function normalizeFinanceState(value: StoredFinanceState): FinanceState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: 4,
    transactions: value.transactions.filter((item) => item.source !== 'sample').map((item) => ({
      ...item,
      status: item.status || (item.type === 'expense' && item.date > today ? 'planned' : 'paid'),
    })),
    alerts: value.alerts.filter((item) => !DEMO_ALERT_IDS.has(item.id)),
    accounts: Array.isArray(value.accounts) ? value.accounts : [],
    goals: Array.isArray(value.goals) ? value.goals : [],
    budgets: Array.isArray(value.budgets) ? value.budgets : [],
    updatedAt: new Date().toISOString(),
  };
}

async function readIndexedState(): Promise<FinanceState | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(isFinanceState(request.result) ? normalizeFinanceState(request.result) : null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeIndexedState(state: FinanceState): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function loadFinanceState(): Promise<{ state: FinanceState; recovered: boolean }> {
  try {
    const indexedState = await readIndexedState();
    if (indexedState) return { state: indexedState, recovered: false };
  } catch {
    // The local backup below is the recovery path when IndexedDB is unavailable.
  }

  const backup = localStorage.getItem(BACKUP_KEY) || LEGACY_BACKUP_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (backup) {
    try {
      const parsed: unknown = JSON.parse(backup);
      if (isFinanceState(parsed)) {
        const normalized = normalizeFinanceState(parsed);
        await saveFinanceState(normalized).catch(() => undefined);
        LEGACY_BACKUP_KEYS.forEach((key) => localStorage.removeItem(key));
        return { state: normalized, recovered: true };
      }
    } catch {
      localStorage.removeItem(BACKUP_KEY);
    }
  }

  const legacy = localStorage.getItem('clarofin-transactions');
  if (legacy) {
    try {
      const legacyItems = JSON.parse(legacy) as Array<{ id?: number; name?: string; category?: string; amount?: number }>;
      const migrated: FinanceState = {
        ...initialFinanceState,
        transactions: [
          ...legacyItems.map((item, index) => ({
            id: `migrated-${item.id ?? index}`,
            description: item.name || 'Lançamento recuperado',
            category: item.category || 'Outros',
            amount: Math.abs(Number(item.amount) || 0),
            type: Number(item.amount) >= 0 ? 'income' as const : 'expense' as const,
            date: '2026-09-04',
            createdAt: new Date().toISOString(),
            source: 'manual' as const,
            status: 'paid' as const,
          })),
        ],
        updatedAt: new Date().toISOString(),
      };
      await saveFinanceState(migrated);
      return { state: migrated, recovered: true };
    } catch {
      localStorage.removeItem('clarofin-transactions');
    }
  }

  await saveFinanceState(initialFinanceState);
  return { state: initialFinanceState, recovered: false };
}

export async function saveFinanceState(state: FinanceState): Promise<{ backupSaved: boolean }> {
  const safeState = { ...state, updatedAt: new Date().toISOString() };
  await writeIndexedState(safeState);
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(safeState));
    return { backupSaved: true };
  } catch {
    // IndexedDB remains the primary copy if the smaller browser backup is full.
    return { backupSaved: false };
  }
}

export function serializeFinanceState(state: FinanceState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function parseFinanceBackup(text: string): FinanceState {
  const parsed: unknown = JSON.parse(text);
  if (!isFinanceState(parsed)) throw new Error('Este arquivo não é um backup válido do Clarofin.');
  return normalizeFinanceState(parsed);
}
