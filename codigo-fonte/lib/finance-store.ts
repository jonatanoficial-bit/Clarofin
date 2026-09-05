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
};

export type FinanceAlert = {
  id: string;
  title: string;
  dueDate: string;
  amount: number;
  paid: boolean;
};

export type FinanceState = {
  version: 2;
  transactions: FinanceTransaction[];
  alerts: FinanceAlert[];
  updatedAt: string;
};

const DB_NAME = 'clarofin-local';
const STORE_NAME = 'finance';
const STATE_KEY = 'primary-state';
const BACKUP_KEY = 'clarofin-backup-v2';

const sampleTransactions: FinanceTransaction[] = [
  ['salario-set', 'Salário', 6850, 'income', 'Receitas', '2026-09-02'],
  ['aluguel-set', 'Aluguel', 1540, 'expense', 'Moradia', '2026-09-02'],
  ['mercado-set', 'Supermercado Aurora', 486.4, 'expense', 'Alimentação', '2026-09-04'],
  ['transporte-set', 'Mobilidade', 242.8, 'expense', 'Transporte', '2026-09-01'],
  ['energia-set', 'Energia elétrica', 214.9, 'expense', 'Moradia', '2026-09-03'],
  ['lazer-set', 'Cinema e lazer', 168, 'expense', 'Lazer', '2026-09-03'],
  ['saude-set', 'Farmácia', 137.5, 'expense', 'Saúde', '2026-09-04'],
  ['salario-ago', 'Salário', 6520, 'income', 'Receitas', '2026-08-02'],
  ['aluguel-ago', 'Aluguel', 1540, 'expense', 'Moradia', '2026-08-02'],
  ['mercado-ago', 'Compras do mês', 1280, 'expense', 'Alimentação', '2026-08-12'],
  ['transporte-ago', 'Transporte', 620, 'expense', 'Transporte', '2026-08-18'],
  ['contas-ago', 'Contas da casa', 740, 'expense', 'Moradia', '2026-08-24'],
  ['salario-jul', 'Salário', 6350, 'income', 'Receitas', '2026-07-02'],
  ['gastos-jul-1', 'Moradia', 2180, 'expense', 'Moradia', '2026-07-08'],
  ['gastos-jul-2', 'Alimentação', 1140, 'expense', 'Alimentação', '2026-07-19'],
  ['salario-jun', 'Salário', 6350, 'income', 'Receitas', '2026-06-02'],
  ['gastos-jun', 'Despesas do mês', 4210, 'expense', 'Outros', '2026-06-21'],
  ['receita-2025', 'Receitas de 2025', 72800, 'income', 'Receitas', '2025-12-30'],
  ['despesa-2025', 'Despesas de 2025', 54800, 'expense', 'Outros', '2025-12-30'],
  ['receita-2024', 'Receitas de 2024', 66400, 'income', 'Receitas', '2024-12-30'],
  ['despesa-2024', 'Despesas de 2024', 53100, 'expense', 'Outros', '2024-12-30'],
].map(([id, description, amount, type, category, date]) => ({
  id: String(id),
  description: String(description),
  amount: Number(amount),
  type: type as TransactionType,
  category: String(category),
  date: String(date),
  createdAt: `${date}T12:00:00.000Z`,
  source: 'sample' as const,
}));

export const initialFinanceState: FinanceState = {
  version: 2,
  transactions: sampleTransactions,
  alerts: [
    { id: 'energia', title: 'Energia elétrica', dueDate: '2026-09-03', amount: 214.9, paid: false },
    { id: 'internet', title: 'Internet residencial', dueDate: '2026-09-07', amount: 119.9, paid: false },
  ],
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

function isFinanceState(value: unknown): value is FinanceState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<FinanceState>;
  return state.version === 2 && Array.isArray(state.transactions) && Array.isArray(state.alerts);
}

async function readIndexedState(): Promise<FinanceState | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(isFinanceState(request.result) ? request.result : null);
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

  const backup = localStorage.getItem(BACKUP_KEY);
  if (backup) {
    try {
      const parsed: unknown = JSON.parse(backup);
      if (isFinanceState(parsed)) {
        await writeIndexedState(parsed).catch(() => undefined);
        return { state: parsed, recovered: true };
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
          })),
          ...initialFinanceState.transactions,
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
  return { ...parsed, updatedAt: new Date().toISOString() };
}
