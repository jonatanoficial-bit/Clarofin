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

export type FinanceAlert = { id: string; title: string; dueDate: string; amount: number; paid: boolean };
export type FinanceAccount = { id: string; name: string; kind: 'checking' | 'savings' | 'cash' | 'credit'; balance: number };
export type FinanceGoal = { id: string; title: string; targetAmount: number; currentAmount: number; deadline: string };
export type FinanceBudget = { category: string; limit: number };

export type FinanceState = {
  version: 5;
  transactions: FinanceTransaction[];
  alerts: FinanceAlert[];
  accounts: FinanceAccount[];
  goals: FinanceGoal[];
  budgets: FinanceBudget[];
  updatedAt: string;
};

type LegacyFinanceState = {
  version: 2 | 3 | 4;
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
const LEGACY_STATE_KEY = 'primary-state';
const BACKUP_PREFIX = 'clarofin-backup-v5:';
const LEGACY_BACKUP_KEYS = ['clarofin-backup-v4', 'clarofin-backup-v3', 'clarofin-backup-v2'];
const LEGACY_OWNER_KEY = 'clarofin-legacy-import-owner';
const DEMO_ALERT_IDS = new Set(['energia', 'internet']);

export const initialFinanceState: FinanceState = { version: 5, transactions: [], alerts: [], accounts: [], goals: [], budgets: [], updatedAt: new Date().toISOString() };

function userStateKey(userId: string) { return `user:${userId}`; }
function roundMoney(value: unknown) { return Math.round((Number(value) || 0) * 100) / 100; }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isFinanceState(value: unknown): value is StoredFinanceState {
  if (!value || typeof value !== 'object') return false;
  const state = value as { version?: number; transactions?: unknown; alerts?: unknown };
  return [2, 3, 4, 5].includes(Number(state.version)) && Array.isArray(state.transactions) && Array.isArray(state.alerts);
}

function normalizeFinanceState(value: StoredFinanceState): FinanceState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: 5,
    transactions: value.transactions.filter((item) => item.source !== 'sample').map((item) => ({ ...item, amount: roundMoney(item.amount), status: item.status || (item.type === 'expense' && item.date > today ? 'planned' : 'paid') })),
    alerts: value.alerts.filter((item) => !DEMO_ALERT_IDS.has(item.id)).map((item) => ({ ...item, amount: roundMoney(item.amount) })),
    accounts: Array.isArray(value.accounts) ? value.accounts.map((item) => ({ ...item, balance: roundMoney(item.balance) })) : [],
    goals: Array.isArray(value.goals) ? value.goals.map((item) => ({ ...item, targetAmount: roundMoney(item.targetAmount), currentAmount: roundMoney(item.currentAmount) })) : [],
    budgets: Array.isArray(value.budgets) ? value.budgets.map((item) => ({ ...item, limit: roundMoney(item.limit) })) : [],
    updatedAt: value.updatedAt || new Date().toISOString(),
  };
}

async function readIndexedState(key: string): Promise<FinanceState | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(isFinanceState(request.result) ? normalizeFinanceState(request.result) : null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeIndexedState(key: string, state: FinanceState): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(state, key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function readLegacyState(): Promise<{ state: FinanceState | null; recovered: boolean }> {
  try { const indexed = await readIndexedState(LEGACY_STATE_KEY); if (indexed) return { state: indexed, recovered: false }; } catch { /* recovery continues below */ }
  const backup = LEGACY_BACKUP_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (backup) {
    try { const parsed: unknown = JSON.parse(backup); if (isFinanceState(parsed)) return { state: normalizeFinanceState(parsed), recovered: true }; } catch { /* never import invalid data */ }
  }
  const legacy = localStorage.getItem('clarofin-transactions');
  if (!legacy) return { state: null, recovered: false };
  try {
    const items = JSON.parse(legacy) as Array<{ id?: number; name?: string; category?: string; amount?: number }>;
    return { state: { ...initialFinanceState, transactions: items.map((item, index) => ({ id: `migrated-${item.id ?? index}`, description: item.name || 'Lançamento recuperado', category: item.category || 'Outros', amount: Math.abs(roundMoney(item.amount)), type: Number(item.amount) >= 0 ? 'income' as const : 'expense' as const, date: '2026-09-04', createdAt: new Date().toISOString(), source: 'manual' as const, status: 'paid' as const })), updatedAt: new Date().toISOString() }, recovered: true };
  } catch { return { state: null, recovered: false }; }
}

export function hasFinanceData(state: FinanceState): boolean { return Boolean(state.transactions.length || state.alerts.length || state.accounts.length || state.goals.length || state.budgets.length); }

export async function loadFinanceState(userId: string): Promise<{ state: FinanceState; recovered: boolean; legacyAvailable: boolean; blockedForPrivacy: boolean }> {
  try { const cached = await readIndexedState(userStateKey(userId)); if (cached) return { state: cached, recovered: false, legacyAvailable: false, blockedForPrivacy: false }; } catch { /* cloud remains available */ }
  const legacyOwner = localStorage.getItem(LEGACY_OWNER_KEY);
  if (legacyOwner && legacyOwner !== userId) return { state: initialFinanceState, recovered: false, legacyAvailable: false, blockedForPrivacy: true };
  const legacy = await readLegacyState();
  if (legacy.state) return { state: legacy.state, recovered: legacy.recovered, legacyAvailable: true, blockedForPrivacy: false };
  return { state: initialFinanceState, recovered: false, legacyAvailable: false, blockedForPrivacy: false };
}

export async function saveFinanceState(userId: string, state: FinanceState): Promise<{ backupSaved: boolean }> {
  const safeState = normalizeFinanceState({ ...state, updatedAt: new Date().toISOString() });
  await writeIndexedState(userStateKey(userId), safeState);
  try { localStorage.setItem(`${BACKUP_PREFIX}${userId}`, JSON.stringify(safeState)); return { backupSaved: true }; } catch { return { backupSaved: false }; }
}

export async function claimAndSaveLegacyState(userId: string, state: FinanceState): Promise<void> { localStorage.setItem(LEGACY_OWNER_KEY, userId); await saveFinanceState(userId, state); }
export function protectLegacyDataForUser(userId: string): void { localStorage.setItem(LEGACY_OWNER_KEY, userId); }
export function serializeFinanceState(state: FinanceState): string { return JSON.stringify({ ...normalizeFinanceState(state), exportedAt: new Date().toISOString() }, null, 2); }
export function parseFinanceBackup(text: string): FinanceState { const parsed: unknown = JSON.parse(text); if (!isFinanceState(parsed)) throw new Error('Este arquivo não é um backup válido do Clarofin.'); return normalizeFinanceState(parsed); }

