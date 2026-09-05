'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, Database, Download, Eye, EyeOff, FileText, Home, LayoutGrid, Lightbulb, Menu, MoreHorizontal, Plus, ReceiptText, RefreshCcw, Search, Settings, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, Upload, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceState, FinanceTransaction, initialFinanceState, loadFinanceState, parseFinanceBackup, saveFinanceState, serializeFinanceState, TransactionType } from '@/lib/finance-store';

type AnalysisMode = 'daily' | 'monthly' | 'annual';
type ChartMode = 'area' | 'bar';
type AppView = 'dashboard' | 'transactions' | 'accounts' | 'goals' | 'budget' | 'reports' | 'settings';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactMoney = new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL', maximumFractionDigits: 1 });
const categories = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outros'];
const categoryColors: Record<string, string> = { Moradia: '#7756f4', Alimentação: '#25d6b5', Transporte: '#ffb84d', Saúde: '#ff6f91', Educação: '#4fa8ff', Lazer: '#e68cff', Outros: '#8990a3' };
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type WebMcpContext = {
  registerTool: (tool: { name: string; title: string; description: string; inputSchema: Record<string, unknown>; annotations?: Record<string, boolean>; execute: (input: unknown) => unknown }, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

function monthDate(month: string) { return new Date(`${month}-01T12:00:00`); }
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function shiftMonth(month: string, amount: number) { const value = monthDate(month); value.setMonth(value.getMonth() + amount); return monthKey(value); }
function totals(items: FinanceTransaction[]) {
  return items.reduce((result, item) => {
    if (item.type === 'income') result.income += item.amount;
    else result.expense += item.amount;
    return result;
  }, { income: 0, expense: 0 });
}

function prepareReceipt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler esta foto.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('A imagem selecionada não é válida.'));
      image.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function transactionIcon(item: FinanceTransaction) {
  if (item.type === 'income') return <ArrowDownLeft />;
  if (item.category === 'Moradia') return <Home />;
  if (item.category === 'Transporte') return <CreditCard />;
  return <ReceiptText />;
}

export default function HomePage() {
  const [finance, setFinance] = useState<FinanceState>(initialFinanceState);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [hydrated, setHydrated] = useState(false);
  const [storageStatus, setStorageStatus] = useState('Carregando dados locais…');
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('daily');
  const [chartMode, setChartMode] = useState<ChartMode>('area');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assistantTip, setAssistantTip] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('Alimentação');
  const [transactionDate, setTransactionDate] = useState('2026-09-04');
  const [photoName, setPhotoName] = useState('');
  const [receiptDataUrl, setReceiptDataUrl] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionFilter, setTransactionFilter] = useState<'all' | TransactionType>('all');
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const rememberedMonth = localStorage.getItem('clarofin-selected-month');
    setSelectedMonth(rememberedMonth || new Date().toISOString().slice(0, 7));
    loadFinanceState().then(({ state, recovered }) => {
      setFinance(state);
      setHydrated(true);
      setStorageStatus(recovered ? 'Dados recuperados da cópia local' : 'Dados protegidos neste aparelho');
    }).catch(() => {
      setHydrated(true);
      setStorageStatus('Não foi possível confirmar a proteção local');
    });
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem('clarofin-selected-month', selectedMonth);
  }, [hydrated, selectedMonth]);

  const persist = (next: FinanceState) => {
    const state = { ...next, updatedAt: new Date().toISOString() };
    setFinance(state);
    setStorageStatus('Salvando em duas cópias…');
    saveFinanceState(state).then(({ backupSaved }) => setStorageStatus(backupSaved ? 'Salvo automaticamente em duas cópias' : 'Salvo no banco local; faça um backup do arquivo')).catch(() => setStorageStatus('Não foi possível salvar. Exporte um backup e tente novamente.'));
  };

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context) return;
    const controller = new AbortController();
    context.registerTool({
      name: 'adicionar_lancamento',
      title: 'Adicionar lançamento financeiro',
      description: 'Registra uma receita ou despesa no controle local do Clarofin.',
      inputSchema: { type: 'object', properties: { descricao: { type: 'string' }, valor: { type: 'number' }, tipo: { type: 'string', enum: ['income', 'expense'] }, categoria: { type: 'string' }, data: { type: 'string' } }, required: ['descricao', 'valor', 'tipo', 'categoria', 'data'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (!input || typeof input !== 'object') return { ok: false, erro: 'Dados inválidos.' };
        const data = input as Record<string, unknown>;
        if (typeof data.descricao !== 'string' || typeof data.valor !== 'number' || data.valor <= 0 || (data.tipo !== 'income' && data.tipo !== 'expense') || typeof data.categoria !== 'string' || typeof data.data !== 'string') return { ok: false, erro: 'Preencha todos os campos corretamente.' };
        const item: FinanceTransaction = { id: crypto.randomUUID(), description: data.descricao, amount: data.valor, type: data.tipo, category: data.categoria, date: data.data, createdAt: new Date().toISOString(), source: 'manual' };
        setFinance((current) => {
          const next = { ...current, transactions: [item, ...current.transactions], updatedAt: new Date().toISOString() };
          void saveFinanceState(next);
          return next;
        });
        return { ok: true, id: item.id };
      },
    }, { signal: controller.signal });
    return () => controller.abort();
  }, []);

  const monthTransactions = useMemo(() => finance.transactions.filter((item) => item.date.startsWith(selectedMonth)), [finance.transactions, selectedMonth]);
  const monthTotals = useMemo(() => totals(monthTransactions), [monthTransactions]);
  const previousMonthTotals = useMemo(() => totals(finance.transactions.filter((item) => item.date.startsWith(shiftMonth(selectedMonth, -1)))), [finance.transactions, selectedMonth]);
  const available = monthTotals.income - monthTotals.expense;
  const expenseChange = previousMonthTotals.expense ? ((monthTotals.expense - previousMonthTotals.expense) / previousMonthTotals.expense) * 100 : 0;
  const selectedYear = Number(selectedMonth.slice(0, 4));

  const periodTransactions = useMemo(() => {
    if (analysisMode === 'daily') return monthTransactions;
    if (analysisMode === 'monthly') return finance.transactions.filter((item) => item.date.startsWith(String(selectedYear)));
    return finance.transactions;
  }, [analysisMode, finance.transactions, monthTransactions, selectedYear]);

  const chartData = useMemo(() => {
    if (analysisMode === 'daily') {
      const daysInMonth = new Date(selectedYear, Number(selectedMonth.slice(5, 7)), 0).getDate();
      return Array.from({ length: daysInMonth }, (_, index) => {
        const day = String(index + 1).padStart(2, '0');
        const values = totals(monthTransactions.filter((item) => item.date.endsWith(`-${day}`)));
        return { label: day, ...values };
      });
    }
    if (analysisMode === 'monthly') {
      return Array.from({ length: 12 }, (_, index) => {
        const key = `${selectedYear}-${String(index + 1).padStart(2, '0')}`;
        return { label: shortMonthFormatter.format(new Date(selectedYear, index, 1)).replace('.', ''), ...totals(finance.transactions.filter((item) => item.date.startsWith(key))) };
      });
    }
    const years = Array.from(new Set(finance.transactions.map((item) => Number(item.date.slice(0, 4))))).sort();
    return years.map((year) => ({ label: String(year), ...totals(finance.transactions.filter((item) => item.date.startsWith(String(year)))) }));
  }, [analysisMode, finance.transactions, monthTransactions, selectedMonth, selectedYear]);

  const categoryData = useMemo(() => {
    const grouped = new Map<string, number>();
    periodTransactions.filter((item) => item.type === 'expense').forEach((item) => grouped.set(item.category, (grouped.get(item.category) || 0) + item.amount));
    return Array.from(grouped, ([name, value]) => ({ name, value, color: categoryColors[name] || categoryColors.Outros })).sort((a, b) => b.value - a.value);
  }, [periodTransactions]);
  const highestCategory = categoryData[0];
  const pendingAlerts = finance.alerts.filter((item) => !item.paid);
  const recentTransactions = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const monthLabel = monthFormatter.format(monthDate(selectedMonth));
  const dailyAllowance = Math.max(0, available / new Date(selectedYear, Number(selectedMonth.slice(5, 7)), 0).getDate());

  const openTransaction = () => {
    const month = monthDate(selectedMonth);
    const day = Math.min(new Date().getDate(), new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
    setTransactionDate(`${selectedMonth}-${String(day).padStart(2, '0')}`);
    setDescription(''); setAmount(''); setTransactionType('expense'); setCategory('Alimentação'); setFormStatus(''); setPhotoName(''); setReceiptDataUrl(''); setAddOpen(true);
  };

  const addTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!description.trim() || !parsedAmount || !transactionDate) { setFormStatus('Preencha descrição, valor e data para continuar.'); return; }
    const item: FinanceTransaction = { id: crypto.randomUUID(), description: description.trim(), amount: Math.abs(parsedAmount), type: transactionType, category: transactionType === 'income' ? 'Receitas' : category, date: transactionDate, createdAt: new Date().toISOString(), source: receiptDataUrl ? 'photo' : 'manual', receiptDataUrl: receiptDataUrl || undefined };
    persist({ ...finance, transactions: [item, ...finance.transactions] });
    setSelectedMonth(transactionDate.slice(0, 7));
    setFormStatus('Lançamento salvo nas duas cópias locais.');
    window.setTimeout(() => setAddOpen(false), 700);
  };

  const markPaid = (id: string) => persist({ ...finance, alerts: finance.alerts.map((item) => item.id === id ? { ...item, paid: true } : item) });

  const navigate = (view: AppView) => { setActiveView(view); setMobileMenu(false); if (view !== 'dashboard') setAssistantOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const deleteTransaction = (id: string) => {
    if (!window.confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return;
    persist({ ...finance, transactions: finance.transactions.filter((item) => item.id !== id) });
  };

  const addAccount = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const balance = Number(String(form.get('balance') || '0').replace(/\./g, '').replace(',', '.'));
    const kind = String(form.get('kind') || 'checking') as 'checking' | 'savings' | 'cash' | 'credit';
    if (!name) return;
    persist({ ...finance, accounts: [...finance.accounts, { id: crypto.randomUUID(), name, balance: Number.isFinite(balance) ? balance : 0, kind }] });
    event.currentTarget.reset();
  };

  const addBill = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const dueDate = String(form.get('dueDate') || '');
    const amountValue = Number(String(form.get('amount') || '0').replace(/\./g, '').replace(',', '.'));
    if (!title || !dueDate || !amountValue) return;
    persist({ ...finance, alerts: [...finance.alerts, { id: crypto.randomUUID(), title, dueDate, amount: Math.abs(amountValue), paid: false }] });
    event.currentTarget.reset();
  };

  const addGoal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const targetAmount = Number(String(form.get('target') || '0').replace(/\./g, '').replace(',', '.'));
    const currentAmount = Number(String(form.get('current') || '0').replace(/\./g, '').replace(',', '.'));
    const deadline = String(form.get('deadline') || '');
    if (!title || !targetAmount || !deadline) return;
    persist({ ...finance, goals: [...finance.goals, { id: crypto.randomUUID(), title, targetAmount: Math.abs(targetAmount), currentAmount: Math.max(0, currentAmount || 0), deadline }] });
    event.currentTarget.reset();
  };

  const addGoalValue = (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = Number(String(form.get('value') || '0').replace(/\./g, '').replace(',', '.'));
    if (!value) return;
    persist({ ...finance, goals: finance.goals.map((goal) => goal.id === id ? { ...goal, currentAmount: Math.min(goal.targetAmount, goal.currentAmount + Math.abs(value)) } : goal) });
    event.currentTarget.reset();
  };

  const saveBudget = (event: React.FormEvent<HTMLFormElement>, budgetCategory: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const limit = Number(String(form.get('limit') || '0').replace(/\./g, '').replace(',', '.'));
    const budgets = finance.budgets.filter((item) => item.category !== budgetCategory);
    if (limit > 0) budgets.push({ category: budgetCategory, limit });
    persist({ ...finance, budgets });
  };

  const exportCsv = () => {
    const rows = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Valor'], ...finance.transactions.map((item) => [item.date, item.description, item.type === 'income' ? 'Receita' : 'Despesa', item.category, item.amount.toFixed(2).replace('.', ',')])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `clarofin-relatorio-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const exportBackup = () => {
    const blob = new Blob([serializeFinanceState(finance)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `clarofin-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    URL.revokeObjectURL(url);
    setStorageStatus('Backup baixado com sucesso');
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const state = parseFinanceBackup(await file.text());
      if (!window.confirm('Restaurar este backup substituirá os dados atuais deste aparelho. Deseja continuar?')) return;
      persist(state);
      setBackupOpen(false);
      setStorageStatus('Backup restaurado com sucesso');
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : 'Não foi possível restaurar o backup');
    }
  };

  const tips = [
    highestCategory ? `${highestCategory.name} é sua maior área de gasto neste período: ${money.format(highestCategory.value)}.` : 'Adicione despesas para descobrir onde seu dinheiro está sendo mais usado.',
    expenseChange <= 0 ? `Seus gastos estão ${Math.abs(expenseChange).toFixed(0)}% menores que no mês anterior.` : `Seus gastos estão ${expenseChange.toFixed(0)}% maiores que no mês anterior.`,
    'Faça um backup sempre que incluir muitos lançamentos ou antes de trocar de aparelho.',
  ];

  const filteredTransactions = [...finance.transactions]
    .filter((item) => transactionFilter === 'all' || item.type === transactionFilter)
    .filter((item) => `${item.description} ${item.category} ${item.date}`.toLowerCase().includes(transactionSearch.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const renderSecondaryView = () => {
    if (activeView === 'transactions') return <section className="workspace-view"><div className="view-heading"><div><span>Histórico completo</span><h1>Todos os lançamentos</h1><p>Consulte receitas e despesas de qualquer mês. Aqui aparecem somente os dados registrados por você.</p></div><Button onClick={openTransaction}><Plus /> Novo lançamento</Button></div><div className="panel view-panel"><div className="filter-row"><label className="search-field"><Search /><input value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} placeholder="Buscar por descrição, área ou data" /></label><NativeSelect value={transactionFilter} onChange={(event) => setTransactionFilter(event.target.value as 'all' | TransactionType)} className="filter-select"><NativeSelectOption value="all">Todos os tipos</NativeSelectOption><NativeSelectOption value="income">Receitas</NativeSelectOption><NativeSelectOption value="expense">Despesas</NativeSelectOption></NativeSelect></div>{filteredTransactions.length ? <div className="full-transaction-list">{filteredTransactions.map((item) => <div className="full-transaction-row" key={item.id}><span className={`transaction-icon ${item.type === 'income' ? 'income' : item.category.toLowerCase()}`}>{transactionIcon(item)}</span><div><strong>{item.description}</strong><span>{item.category} · {new Intl.DateTimeFormat('pt-BR').format(new Date(`${item.date}T12:00:00`))}{item.receiptDataUrl ? ' · Com comprovante' : ''}</span></div><b className={item.type === 'income' ? 'amount-positive' : ''}>{item.type === 'income' ? '+' : '-'}{money.format(item.amount)}</b><button className="delete-action" onClick={() => deleteTransaction(item.id)} aria-label={`Excluir ${item.description}`}><Trash2 /></button></div>)}</div> : <div className="empty-state large"><ReceiptText /><strong>Nenhum lançamento encontrado</strong><p>Use “Novo lançamento” para registrar a primeira receita ou despesa.</p></div>}</div></section>;

    if (activeView === 'accounts') return <section className="workspace-view"><div className="view-heading"><div><span>Organização financeira</span><h1>Contas e cartões</h1><p>Cadastre onde seu dinheiro fica e acompanhe contas que precisam ser pagas.</p></div></div><div className="management-grid"><article className="panel form-panel"><div className="panel-header"><div><h2>Adicionar conta ou cartão</h2><p>Informe o saldo atual para começar</p></div></div><form className="inline-form" onSubmit={addAccount}><label>Nome<input name="name" required placeholder="Ex.: Conta principal" /></label><label>Tipo<select name="kind"><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="cash">Dinheiro</option><option value="credit">Cartão de crédito</option></select></label><label>Saldo atual<input name="balance" inputMode="decimal" placeholder="0,00" /></label><Button type="submit"><Plus /> Adicionar</Button></form></article><article className="panel account-summary"><div className="panel-header"><div><h2>Patrimônio informado</h2><p>Soma dos saldos cadastrados</p></div></div><strong>{money.format(finance.accounts.reduce((sum, item) => sum + item.balance, 0))}</strong><span>{finance.accounts.length} {finance.accounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}</span></article></div><div className="panel view-panel"><div className="panel-header"><div><h2>Suas contas</h2><p>Dados salvos neste aparelho</p></div></div>{finance.accounts.length ? <div className="entity-grid">{finance.accounts.map((account) => <article key={account.id}><span><WalletCards /></span><div><strong>{account.name}</strong><small>{{ checking: 'Conta corrente', savings: 'Poupança', cash: 'Dinheiro', credit: 'Cartão de crédito' }[account.kind]}</small></div><b>{money.format(account.balance)}</b><button onClick={() => persist({ ...finance, accounts: finance.accounts.filter((item) => item.id !== account.id) })} aria-label={`Remover ${account.name}`}><Trash2 /></button></article>)}</div> : <div className="empty-state"><WalletCards /><strong>Nenhuma conta cadastrada</strong><p>Preencha o formulário acima para adicionar.</p></div>}</div><div className="management-grid bills-grid"><article className="panel form-panel"><div className="panel-header"><div><h2>Adicionar conta a pagar</h2><p>Ela aparecerá nos alertas do painel</p></div></div><form className="inline-form" onSubmit={addBill}><label>Descrição<input name="title" required placeholder="Ex.: Conta de água" /></label><label>Vencimento<input name="dueDate" type="date" required /></label><label>Valor<input name="amount" inputMode="decimal" required placeholder="0,00" /></label><Button type="submit"><Bell /> Criar alerta</Button></form></article><article className="panel view-panel compact-panel"><div className="panel-header"><div><h2>Pagamentos cadastrados</h2><p>{pendingAlerts.length} pendentes</p></div></div><div className="simple-list">{finance.alerts.map((alert) => <div key={alert.id}><span className={alert.paid ? 'paid-dot' : 'pending-dot'} /><div><strong>{alert.title}</strong><small>{alert.dueDate} · {money.format(alert.amount)}</small></div><b>{alert.paid ? 'Pago' : 'Pendente'}</b>{!alert.paid && <button onClick={() => markPaid(alert.id)}>Paguei</button>}</div>)}{!finance.alerts.length && <p className="list-empty">Nenhuma conta a pagar cadastrada.</p>}</div></article></div></section>;

    if (activeView === 'goals') return <section className="workspace-view"><div className="view-heading"><div><span>Planos reais</span><h1>Metas financeiras</h1><p>Defina um objetivo e registre cada valor guardado até chegar lá.</p></div></div><div className="management-grid"><article className="panel form-panel"><div className="panel-header"><div><h2>Criar nova meta</h2><p>Use um nome claro e um prazo possível</p></div></div><form className="inline-form" onSubmit={addGoal}><label>Objetivo<input name="title" required placeholder="Ex.: Reserva de emergência" /></label><label>Valor desejado<input name="target" inputMode="decimal" required placeholder="0,00" /></label><label>Já tenho<input name="current" inputMode="decimal" placeholder="0,00" /></label><label>Prazo<input name="deadline" type="date" required /></label><Button type="submit"><Target /> Criar meta</Button></form></article><article className="panel account-summary goal-summary"><div className="panel-header"><div><h2>Progresso geral</h2><p>Quanto já foi guardado</p></div></div><strong>{money.format(finance.goals.reduce((sum, goal) => sum + goal.currentAmount, 0))}</strong><span>em {finance.goals.length} {finance.goals.length === 1 ? 'meta ativa' : 'metas ativas'}</span></article></div><div className="goal-grid">{finance.goals.map((goal) => { const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100); return <article className="panel goal-card" key={goal.id}><div className="goal-title"><span><Target /></span><div><strong>{goal.title}</strong><small>Prazo: {new Intl.DateTimeFormat('pt-BR').format(new Date(`${goal.deadline}T12:00:00`))}</small></div><button onClick={() => persist({ ...finance, goals: finance.goals.filter((item) => item.id !== goal.id) })}><Trash2 /></button></div><div className="goal-values"><strong>{money.format(goal.currentAmount)}</strong><span>de {money.format(goal.targetAmount)}</span></div><Progress value={progress} /><small>{progress.toFixed(0)}% concluído</small><form onSubmit={(event) => addGoalValue(event, goal.id)}><input name="value" inputMode="decimal" required placeholder="Valor para adicionar" /><Button type="submit">Guardar valor</Button></form></article>; })}{!finance.goals.length && <div className="panel empty-state large"><Target /><strong>Você ainda não criou metas</strong><p>Crie a primeira meta usando o formulário acima.</p></div>}</div></section>;

    if (activeView === 'budget') return <section className="workspace-view"><div className="view-heading"><div><span>Limites mensais</span><h1>Orçamento por área</h1><p>Defina quanto pretende gastar em cada categoria e acompanhe o uso em {monthLabel}.</p></div></div><div className="budget-grid">{categories.map((budgetCategory) => { const spent = monthTransactions.filter((item) => item.type === 'expense' && item.category === budgetCategory).reduce((sum, item) => sum + item.amount, 0); const limit = finance.budgets.find((item) => item.category === budgetCategory)?.limit || 0; const percentage = limit ? Math.min(100, (spent / limit) * 100) : 0; return <article className="panel budget-card" key={budgetCategory}><div><span style={{ background: categoryColors[budgetCategory] }} /><strong>{budgetCategory}</strong><b className={limit && spent > limit ? 'over-budget' : ''}>{limit ? `${percentage.toFixed(0)}% usado` : 'Sem limite'}</b></div><p><strong>{money.format(spent)}</strong><span>{limit ? ` de ${money.format(limit)}` : ' gastos no mês'}</span></p><Progress value={percentage} /><form onSubmit={(event) => saveBudget(event, budgetCategory)}><input name="limit" inputMode="decimal" defaultValue={limit ? String(limit).replace('.', ',') : ''} placeholder="Definir limite" /><Button type="submit">Salvar</Button></form></article>; })}</div></section>;

    if (activeView === 'reports') { const yearly = Array.from({ length: 12 }, (_, index) => { const key = `${selectedYear}-${String(index + 1).padStart(2, '0')}`; return { month: shortMonthFormatter.format(new Date(selectedYear, index, 1)), ...totals(finance.transactions.filter((item) => item.date.startsWith(key))) }; }); const yearTotals = totals(finance.transactions.filter((item) => item.date.startsWith(String(selectedYear)))); return <section className="workspace-view"><div className="view-heading"><div><span>Resumo e exportação</span><h1>Relatórios</h1><p>Confira o resultado de {selectedYear} e baixe seus próprios dados em uma planilha CSV.</p></div><Button variant="outline" onClick={exportCsv} disabled={!finance.transactions.length}><Download /> Baixar CSV</Button></div><div className="report-summary"><article className="panel"><span>Receitas no ano</span><strong className="amount-positive">{money.format(yearTotals.income)}</strong></article><article className="panel"><span>Despesas no ano</span><strong>{money.format(yearTotals.expense)}</strong></article><article className="panel"><span>Resultado do ano</span><strong className={yearTotals.income - yearTotals.expense >= 0 ? 'amount-positive' : 'amount-negative'}>{money.format(yearTotals.income - yearTotals.expense)}</strong></article></div><div className="panel report-table"><div className="panel-header"><div><h2>Mês a mês</h2><p>Valores calculados a partir dos lançamentos reais</p></div></div><div className="table-head"><span>Mês</span><span>Receitas</span><span>Despesas</span><span>Resultado</span></div>{yearly.map((row) => <div className="table-row" key={row.month}><strong>{row.month}</strong><span>{money.format(row.income)}</span><span>{money.format(row.expense)}</span><b className={row.income - row.expense >= 0 ? 'amount-positive' : 'amount-negative'}>{money.format(row.income - row.expense)}</b></div>)}</div></section>; }

    return <section className="workspace-view"><div className="view-heading"><div><span>Dados e preferências</span><h1>Configurações</h1><p>Proteja, exporte ou restaure as informações guardadas neste aparelho.</p></div></div><div className="settings-grid"><article className="panel settings-card"><span><Database /></span><div><h2>Salvamento automático</h2><p>{storageStatus}. A cópia principal usa o banco local do navegador.</p></div><b>Ativo</b></article><article className="panel settings-card"><span><Download /></span><div><h2>Baixar backup</h2><p>Guarde uma cópia fora do navegador antes de trocar ou formatar o aparelho.</p></div><Button onClick={exportBackup}>Baixar</Button></article><article className="panel settings-card"><span><Upload /></span><div><h2>Restaurar backup</h2><p>Selecione um arquivo JSON criado anteriormente pelo Clarofin.</p></div><Button variant="outline" onClick={() => setBackupOpen(true)}>Abrir restauração</Button></article><article className="panel settings-card"><span><ShieldCheck /></span><div><h2>Próxima etapa: conta segura</h2><p>O login com sincronização em nuvem será adicionado depois, mantendo o modo local disponível.</p></div><b>Planejado</b></article></div></section>;
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><TrendingUp /></span><span>claro</span><b>fin</b></div>
        <nav aria-label="Navegação principal" className="nav-list">
          <p className="nav-label">Visão geral</p>
          <button className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}><LayoutGrid /> Painel</button>
          <button className={`nav-item ${activeView === 'transactions' ? 'active' : ''}`} onClick={() => navigate('transactions')}><ReceiptText /> Lançamentos</button>
          <button className={`nav-item ${activeView === 'accounts' ? 'active' : ''}`} onClick={() => navigate('accounts')}><WalletCards /> Contas e cartões</button>
          <button className={`nav-item ${activeView === 'goals' ? 'active' : ''}`} onClick={() => navigate('goals')}><Target /> Metas</button>
          <p className="nav-label spaced">Planejamento</p>
          <button className={`nav-item ${activeView === 'budget' ? 'active' : ''}`} onClick={() => navigate('budget')}><CircleDollarSign /> Orçamento</button>
          <button className={`nav-item ${activeView === 'reports' ? 'active' : ''}`} onClick={() => navigate('reports')}><FileText /> Relatórios</button>
        </nav>
        <div className="sidebar-foot">
          <button className="data-protection-card" onClick={() => setBackupOpen(true)}><span><Database /></span><div><strong>Dados protegidos</strong><small>2 cópias locais + backup</small></div><ArrowRight /></button>
          <button className={`nav-item ${activeView === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings /> Configurações</button>
          <div className="user-row"><span className="user-avatar">CL</span><div><strong>Usuário local</strong><small>Sem login nesta etapa</small></div><MoreHorizontal /></div>
        </div>
      </aside>
      {mobileMenu && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand-row"><button className="icon-button menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu /></button><div className="brand compact"><span className="brand-mark"><TrendingUp /></span><span>claro</span><b>fin</b></div></div>
          <div className="month-controller"><button className="month-arrow" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} aria-label="Mês anterior"><ChevronLeft /></button><label><span>Mês de referência</span><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label><button className="month-arrow" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} aria-label="Próximo mês"><ChevronRight /></button></div>
          <div className="top-actions"><button className="icon-button notification" onClick={() => navigate('accounts')} aria-label={`Abrir ${pendingAlerts.length} alertas`}><Bell /><span>{pendingAlerts.length}</span></button><Button variant="outline" className="backup-button" onClick={() => setBackupOpen(true)}><ShieldCheck /> Backup</Button><Button className="add-button" onClick={openTransaction}><Plus /> Novo lançamento</Button></div>
        </header>

        <div className="dashboard">
          {activeView === 'dashboard' ? <>
          <section className="welcome-row"><div><p className="eyebrow">CONTROLE FINANCEIRO · {monthLabel.toUpperCase()}</p><h1>Seu dinheiro, explicado com clareza.</h1><p>Veja o período, identifique excessos e registre tudo sem complicação.</p></div><div className={`secure-badge ${storageStatus.includes('atenção') ? 'warning' : ''}`}><ShieldCheck /> {hydrated ? storageStatus : 'Carregando dados locais…'}</div></section>

          <section className="mobile-month-controller" aria-label="Selecionar mês"><button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} aria-label="Mês anterior"><ChevronLeft /></button><label><span>Mês de referência</span><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label><button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} aria-label="Próximo mês"><ChevronRight /></button></section>

          <section className="summary-grid" aria-label={`Resumo de ${monthLabel}`}>
            <article className="summary-card balance-card"><div className="card-heading"><span>Resultado do mês</span><button onClick={() => setBalanceVisible(!balanceVisible)} aria-label="Mostrar ou esconder valores">{balanceVisible ? <Eye /> : <EyeOff />}</button></div><strong>{balanceVisible ? money.format(available) : '••••••'}</strong><p><span className={available >= 0 ? 'positive-pill' : 'negative-pill'}>{available >= 0 ? <ArrowUpRight /> : <ArrowDownLeft />}{available >= 0 ? 'Saldo positivo' : 'Saldo devedor'}</span></p><div className="balance-glow" /></article>
            <article className="summary-card"><div className="card-heading"><span>Receitas</span><span className="metric-icon income"><ArrowDownLeft /></span></div><strong>{money.format(monthTotals.income)}</strong><p>{monthTransactions.filter((item) => item.type === 'income').length} entradas registradas</p></article>
            <article className="summary-card"><div className="card-heading"><span>Despesas</span><span className="metric-icon expense"><ArrowUpRight /></span></div><strong>{money.format(monthTotals.expense)}</strong><p>{expenseChange === 0 ? 'Sem comparação anterior' : `${Math.abs(expenseChange).toFixed(0)}% ${expenseChange > 0 ? 'acima' : 'abaixo'} do mês anterior`}</p></article>
            <article className="summary-card safe-card"><div className="card-heading"><span>Média livre por dia</span><span className="metric-icon safe"><CalendarDays /></span></div><strong>{money.format(dailyAllowance)}</strong><p><span className="status-dot" /> Baseada no resultado deste mês</p></article>
          </section>

          <section className="analysis-toolbar panel">
            <div><span className="toolbar-label">Analisar por</span><Tabs value={analysisMode} onValueChange={(value) => setAnalysisMode(value as AnalysisMode)}><TabsList><TabsTrigger value="daily">Dias</TabsTrigger><TabsTrigger value="monthly">Meses</TabsTrigger><TabsTrigger value="annual">Anos</TabsTrigger></TabsList></Tabs></div>
            <div className="analysis-context"><CalendarDays /><span>{analysisMode === 'daily' ? monthLabel : analysisMode === 'monthly' ? `Ano de ${selectedYear}` : 'Histórico completo'}</span></div>
          </section>

          <section className="main-grid">
            <article className="panel cashflow-panel">
              <div className="panel-header chart-header"><div><h2>{analysisMode === 'daily' ? 'Movimento diário' : analysisMode === 'monthly' ? 'Evolução mensal' : 'Evolução anual'}</h2><p>Receitas e despesas do período selecionado</p></div><div className="chart-mode"><button className={chartMode === 'area' ? 'active' : ''} onClick={() => setChartMode('area')}>Linha</button><button className={chartMode === 'bar' ? 'active' : ''} onClick={() => setChartMode('bar')}>Barras</button></div></div>
              <div className="period-chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  {chartMode === 'area' ? <AreaChart data={chartData} margin={{ top: 14, right: 12, left: -8, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#25d6b5" stopOpacity={0.28} /><stop offset="95%" stopColor="#25d6b5" stopOpacity={0} /></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7756f4" stopOpacity={0.2} /><stop offset="95%" stopColor="#7756f4" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#e8e9ef" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8b90a0', fontSize: 12 }} interval={analysisMode === 'daily' ? 4 : 0} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90a0', fontSize: 12 }} tickFormatter={(value) => compactMoney.format(value)} /><Tooltip formatter={(value) => money.format(Number(value))} /><Area type="monotone" dataKey="income" name="Receitas" stroke="#12af91" strokeWidth={3} fill="url(#incomeFill)" /><Area type="monotone" dataKey="expense" name="Despesas" stroke="#7756f4" strokeWidth={3} fill="url(#expenseFill)" /></AreaChart> : <BarChart data={chartData} margin={{ top: 14, right: 12, left: -8, bottom: 0 }}><CartesianGrid stroke="#e8e9ef" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8b90a0', fontSize: 12 }} interval={analysisMode === 'daily' ? 4 : 0} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90a0', fontSize: 12 }} tickFormatter={(value) => compactMoney.format(value)} /><Tooltip formatter={(value) => money.format(Number(value))} /><Bar dataKey="income" name="Receitas" fill="#25d6b5" radius={[5, 5, 0, 0]} /><Bar dataKey="expense" name="Despesas" fill="#7756f4" radius={[5, 5, 0, 0]} /></BarChart>}
                </ResponsiveContainer>
              </div>
              <div className="chart-foot"><span><i className="legend-dot income" /> Receitas</span><span><i className="legend-dot expense" /> Despesas</span><span className="chart-note">Passe o cursor sobre o gráfico para ver os valores</span></div>
            </article>

            <article className="panel category-panel">
              <div className="panel-header"><div><h2>Onde você mais gastou</h2><p>Distribuição do período analisado</p></div>{highestCategory && <span className="score-tag">Maior: {highestCategory.name}</span>}</div>
              {categoryData.length ? <><div className="category-visual"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={categoryData} dataKey="value" innerRadius={50} outerRadius={72} paddingAngle={3}>{categoryData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => money.format(Number(value))} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{categoryData.length}</strong><span>áreas</span></div></div><div className="category-ranking">{categoryData.slice(0, 4).map((item, index) => <div key={item.name}><span className="rank-number">{index + 1}</span><i style={{ background: item.color }} /><p><strong>{item.name}</strong><small>{money.format(item.value)}</small></p><b>{Math.round((item.value / categoryData.reduce((sum, entry) => sum + entry.value, 0)) * 100)}%</b></div>)}</div></div>{highestCategory && <div className="category-insight"><Lightbulb /><span><strong>{highestCategory.name}</strong> concentra a maior parte dos gastos. Revise essa área primeiro.</span></div>}</> : <div className="empty-state"><ReceiptText /><strong>Nenhuma despesa neste período</strong><p>Adicione um lançamento para iniciar a análise.</p></div>}
            </article>
          </section>

          <section className="bottom-grid expanded-bottom">
            <article className="panel transactions-panel"><div className="panel-header"><div><h2>Lançamentos de {monthLabel}</h2><p>{monthTransactions.length} registros neste mês</p></div><button className="text-button" onClick={openTransaction}><Plus /> Adicionar</button></div><div className="transaction-list">{recentTransactions.map((item) => <div className="transaction-row" key={item.id}><span className={`transaction-icon ${item.type === 'income' ? 'income' : item.category.toLowerCase()}`}>{transactionIcon(item)}</span><div><strong>{item.description}</strong><span>{item.category} · {new Intl.DateTimeFormat('pt-BR').format(new Date(`${item.date}T12:00:00`))}</span></div><b className={item.type === 'income' ? 'amount-positive' : ''}>{item.type === 'income' ? '+' : '-'}{money.format(item.amount)}</b></div>)}{!recentTransactions.length && <div className="empty-state compact"><ReceiptText /><strong>Este mês ainda está vazio</strong><p>Comece adicionando uma receita ou despesa.</p></div>}</div></article>

            <article className="panel alerts-panel"><div className="panel-header"><div><h2>Contas importantes</h2><p>{pendingAlerts.length ? `${pendingAlerts.length} precisam de atenção` : 'Tudo em dia'}</p></div><Bell /></div><div className="alerts-list">{pendingAlerts.map((item) => { const overdue = item.dueDate < '2026-09-05'; return <div className={`alert-row ${overdue ? 'danger' : 'warning'}`} key={item.id}><span className="alert-icon">{overdue ? <AlertCircle /> : <Bell />}</span><div className="alert-copy"><strong>{item.title}</strong><span>{overdue ? 'Vencida' : 'Próxima'} · {money.format(item.amount)}</span></div><button onClick={() => markPaid(item.id)}><Check /> Paguei</button></div>; })}{!pendingAlerts.length && <div className="all-good"><span><Check /></span><strong>Contas em dia</strong><p>Nenhum pagamento pendente.</p></div>}</div></article>

            <article className="panel protection-panel"><div className="panel-header"><div><h2>Proteção dos dados</h2><p>Salvamento local nesta etapa</p></div><span className="storage-ok"><ShieldCheck /> Ativo</span></div><div className="protection-body"><div><span><Database /></span><p><strong>IndexedDB</strong><small>Cópia principal no navegador</small></p><Check /></div><div><span><RefreshCcw /></span><p><strong>Cópia automática</strong><small>Recuperação local redundante</small></p><Check /></div><button onClick={() => setBackupOpen(true)}><Download /> Criar backup para guardar</button><p className="storage-warning">Limpar os dados do navegador remove as cópias locais. Guarde um backup regularmente.</p></div></article>
          </section>
          </> : renderSecondaryView()}
        </div>
      </main>

      {assistantOpen && <aside className="coach-card" aria-label="Orientação da Lia"><button className="coach-close" onClick={() => setAssistantOpen(false)} aria-label="Fechar orientação"><X /></button><div className="coach-image"><img src={`${basePath}/lia-avatar.png`} alt="Lia, orientadora financeira virtual" /></div><div className="coach-body"><span className="coach-label"><Sparkles /> ORIENTAÇÃO DA LIA</span><strong>{tips[assistantTip]}</strong><button onClick={() => setAssistantTip((assistantTip + 1) % tips.length)}>Ver outra orientação <ArrowRight /></button></div></aside>}
      <nav className="mobile-bottom-nav" aria-label="Navegação móvel"><button className={activeView === 'dashboard' ? 'active' : ''} onClick={() => navigate('dashboard')}><LayoutGrid /><span>Início</span></button><button className={activeView === 'transactions' ? 'active' : ''} onClick={() => navigate('transactions')}><ReceiptText /><span>Extrato</span></button><button className="mobile-add" onClick={openTransaction} aria-label="Novo lançamento"><Plus /></button><button className={activeView === 'goals' ? 'active' : ''} onClick={() => navigate('goals')}><Target /><span>Metas</span></button><button className={activeView === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings /><span>Ajustes</span></button></nav>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="launch-dialog"><DialogHeader><span className="dialog-kicker"><Sparkles /> Lançamento inteligente</span><DialogTitle>Registrar movimentação</DialogTitle><DialogDescription>Informe os dados principais. O lançamento será salvo imediatamente nas duas cópias locais.</DialogDescription></DialogHeader>
          <form className="launch-form" onSubmit={addTransaction}>
            <div className="type-switch"><button type="button" className={transactionType === 'expense' ? 'active expense' : ''} onClick={() => setTransactionType('expense')}><ArrowUpRight /> Despesa</button><button type="button" className={transactionType === 'income' ? 'active income' : ''} onClick={() => setTransactionType('income')}><ArrowDownLeft /> Receita</button></div>
            <label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: supermercado" /></label>
            <div className="form-grid"><label>Valor<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="R$ 0,00" /></label><label>Data<input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} /></label></div>
            {transactionType === 'expense' && <label>Área do gasto<NativeSelect value={category} onChange={(event) => setCategory(event.target.value)} className="category-select">{categories.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect></label>}
            <div className="receipt-option"><input id="receipt-photo" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setFormStatus('Preparando a foto para salvar com o lançamento…'); void prepareReceipt(file).then((dataUrl) => { setReceiptDataUrl(dataUrl); setPhotoName(file.name); setFormStatus('Foto pronta. Confira os dados e salve o lançamento.'); }).catch((error) => setFormStatus(error instanceof Error ? error.message : 'Não foi possível preparar a foto.')); }} /><label htmlFor="receipt-photo"><Camera /><span><strong>{photoName || 'Adicionar foto do comprovante'}</strong><small>Opcional · imagem reduzida e guardada neste aparelho</small></span><ArrowRight /></label></div>
            {formStatus && <p className="form-status" role="status">{formStatus}</p>}
            <Button type="submit" className="save-button">Salvar com segurança <ShieldCheck /></Button>
          </form><DialogFooter className="dialog-footnote"><ShieldCheck /> Seus dados não são enviados para servidores nesta versão.</DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent className="backup-dialog"><DialogHeader><span className="dialog-kicker"><ShieldCheck /> Proteção local</span><DialogTitle>Backup dos seus dados</DialogTitle><DialogDescription>Baixe uma cópia para guardar fora do navegador ou restaure um arquivo criado anteriormente.</DialogDescription></DialogHeader><div className="backup-options"><button onClick={exportBackup}><span className="backup-option-icon download"><Download /></span><div><strong>Baixar backup</strong><small>Salva receitas, despesas e alertas em um arquivo</small></div><ArrowRight /></button><button onClick={() => backupInputRef.current?.click()}><span className="backup-option-icon upload"><Upload /></span><div><strong>Restaurar backup</strong><small>Substitui os dados locais após sua confirmação</small></div><ArrowRight /></button><input ref={backupInputRef} type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} /></div><div className="backup-status"><Database /><span><strong>{storageStatus}</strong><small>Última alteração: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(finance.updatedAt))}</small></span></div></DialogContent>
      </Dialog>
    </div>
  );
}
