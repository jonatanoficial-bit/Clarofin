'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, Database, Download, Eye, EyeOff, FileText, Home, LayoutGrid, Lightbulb, Menu, MoreHorizontal, Plus, ReceiptText, RefreshCcw, Settings, ShieldCheck, Sparkles, Target, TrendingUp, Upload, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceState, FinanceTransaction, initialFinanceState, loadFinanceState, parseFinanceBackup, saveFinanceState, serializeFinanceState, TransactionType } from '@/lib/finance-store';

type AnalysisMode = 'daily' | 'monthly' | 'annual';
type ChartMode = 'area' | 'bar';

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

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><TrendingUp /></span><span>claro</span><b>fin</b></div>
        <nav aria-label="Navegação principal" className="nav-list">
          <p className="nav-label">Visão geral</p>
          <button className="nav-item active"><LayoutGrid /> Painel</button>
          <button className="nav-item"><ReceiptText /> Lançamentos</button>
          <button className="nav-item"><WalletCards /> Contas e cartões</button>
          <button className="nav-item"><Target /> Metas</button>
          <p className="nav-label spaced">Planejamento</p>
          <button className="nav-item"><CircleDollarSign /> Orçamento</button>
          <button className="nav-item"><FileText /> Relatórios</button>
        </nav>
        <div className="sidebar-foot">
          <button className="data-protection-card" onClick={() => setBackupOpen(true)}><span><Database /></span><div><strong>Dados protegidos</strong><small>2 cópias locais + backup</small></div><ArrowRight /></button>
          <button className="nav-item"><Settings /> Configurações</button>
          <div className="user-row"><span className="user-avatar">JM</span><div><strong>João Martins</strong><small>Conta local</small></div><MoreHorizontal /></div>
        </div>
      </aside>
      {mobileMenu && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand-row"><button className="icon-button menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu /></button><div className="brand compact"><span className="brand-mark"><TrendingUp /></span><span>claro</span><b>fin</b></div></div>
          <div className="month-controller"><button className="month-arrow" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} aria-label="Mês anterior"><ChevronLeft /></button><label><span>Mês de referência</span><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label><button className="month-arrow" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} aria-label="Próximo mês"><ChevronRight /></button></div>
          <div className="top-actions"><button className="icon-button notification" aria-label={`${pendingAlerts.length} alertas`}><Bell /><span>{pendingAlerts.length}</span></button><Button variant="outline" className="backup-button" onClick={() => setBackupOpen(true)}><ShieldCheck /> Backup</Button><Button className="add-button" onClick={openTransaction}><Plus /> Novo lançamento</Button></div>
        </header>

        <div className="dashboard">
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
        </div>
      </main>

      {assistantOpen && <aside className="coach-card" aria-label="Orientação da Lia"><button className="coach-close" onClick={() => setAssistantOpen(false)} aria-label="Fechar orientação"><X /></button><div className="coach-image"><img src={`${basePath}/lia-avatar.png`} alt="Lia, orientadora financeira virtual" /></div><div className="coach-body"><span className="coach-label"><Sparkles /> ORIENTAÇÃO DA LIA</span><strong>{tips[assistantTip]}</strong><button onClick={() => setAssistantTip((assistantTip + 1) % tips.length)}>Ver outra orientação <ArrowRight /></button></div></aside>}
      <nav className="mobile-bottom-nav" aria-label="Navegação móvel"><button className="active"><LayoutGrid /><span>Início</span></button><button><ReceiptText /><span>Extrato</span></button><button className="mobile-add" onClick={openTransaction} aria-label="Novo lançamento"><Plus /></button><button><Target /><span>Metas</span></button><button onClick={() => setBackupOpen(true)}><ShieldCheck /><span>Backup</span></button></nav>

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
