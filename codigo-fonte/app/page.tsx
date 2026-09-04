'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, Camera, Check, ChevronDown, CircleDollarSign, CreditCard, Eye, EyeOff, FileText, Home, LayoutGrid, Lightbulb, Menu, MoreHorizontal, Plus, ReceiptText, Settings, ShieldCheck, Sparkles, Target, TrendingUp, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Transaction = { id: number; name: string; category: string; date: string; amount: number; icon: 'market' | 'income' | 'home' | 'transport' };
type AlertItem = { id: number; title: string; due: string; amount: number; tone: 'danger' | 'warning'; paid: boolean };

const cashFlow = [
  { day: '01', income: 2450, expense: 620 }, { day: '05', income: 3200, expense: 1380 },
  { day: '10', income: 3650, expense: 2060 }, { day: '15', income: 5100, expense: 2840 },
  { day: '20', income: 5740, expense: 3480 }, { day: '25', income: 6850, expense: 4150 },
  { day: '30', income: 6850, expense: 4730 },
];
const categoryData = [
  { name: 'Moradia', value: 1840, color: '#7756f4' }, { name: 'Alimentação', value: 1180, color: '#25d6b5' },
  { name: 'Transporte', value: 760, color: '#ffb84d' }, { name: 'Outros', value: 950, color: '#ff6f91' },
];
const initialTransactions: Transaction[] = [
  { id: 1, name: 'Supermercado Aurora', category: 'Alimentação', date: 'Hoje, 09:42', amount: -186.4, icon: 'market' },
  { id: 2, name: 'Salário', category: 'Receita', date: 'Ontem, 08:10', amount: 4850, icon: 'income' },
  { id: 3, name: 'Aluguel', category: 'Moradia', date: '02 set, 10:00', amount: -1540, icon: 'home' },
  { id: 4, name: 'Mobilidade', category: 'Transporte', date: '01 set, 19:18', amount: -42.8, icon: 'transport' },
];
const initialAlerts: AlertItem[] = [
  { id: 1, title: 'Energia elétrica', due: 'Venceu ontem', amount: 214.9, tone: 'danger', paid: false },
  { id: 2, title: 'Internet residencial', due: 'Vence em 3 dias', amount: 119.9, tone: 'warning', paid: false },
];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type WebMcpContext = {
  registerTool: (tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (input: unknown) => unknown;
  }, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

function TransactionIcon({ type }: { type: Transaction['icon'] }) {
  const icons = { market: <ReceiptText />, income: <ArrowDownLeft />, home: <Home />, transport: <CreditCard /> };
  return <span className={`transaction-icon ${type}`}>{icons[type]}</span>;
}

export default function HomePage() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assistantTip, setAssistantTip] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [formStatus, setFormStatus] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('clarofin-transactions');
    if (saved) try { setTransactions(JSON.parse(saved)); } catch { window.localStorage.removeItem('clarofin-transactions'); }
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context) return;
    const controller = new AbortController();
    context.registerTool({
      name: 'adicionar_lancamento',
      title: 'Adicionar lançamento financeiro',
      description: 'Registra uma despesa informada pelo usuário no painel Clarofin.',
      inputSchema: {
        type: 'object',
        properties: {
          descricao: { type: 'string', description: 'Descrição clara da despesa.' },
          valor: { type: 'number', description: 'Valor positivo da despesa em reais.' },
        },
        required: ['descricao', 'valor'],
        additionalProperties: false,
      },
      execute: (input) => {
        if (!input || typeof input !== 'object') return { ok: false, erro: 'Dados inválidos.' };
        const data = input as Record<string, unknown>;
        if (typeof data.descricao !== 'string' || typeof data.valor !== 'number' || data.valor <= 0) return { ok: false, erro: 'Informe descrição e valor positivo.' };
        const item: Transaction = { id: Date.now(), name: data.descricao, category: 'Organizado pela Lia', date: 'Agora', amount: -Math.abs(data.valor), icon: 'market' };
        setTransactions((current) => {
          const next = [item, ...current];
          window.localStorage.setItem('clarofin-transactions', JSON.stringify(next));
          return next;
        });
        return { ok: true, mensagem: 'Lançamento adicionado e exibido no painel.' };
      },
    }, { signal: controller.signal });
    return () => controller.abort();
  }, []);

  const pendingAlerts = useMemo(() => alerts.filter((item) => !item.paid), [alerts]);
  const currentExpenses = useMemo(() => Math.abs(transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0)), [transactions]);
  const saveTransactions = (next: Transaction[]) => { setTransactions(next); window.localStorage.setItem('clarofin-transactions', JSON.stringify(next)); };
  const addTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!description.trim() || !parsedAmount) { setFormStatus('Preencha a descrição e o valor para continuar.'); return; }
    saveTransactions([{ id: Date.now(), name: description.trim(), category: 'Organizado pela Lia', date: 'Agora', amount: -Math.abs(parsedAmount), icon: 'market' }, ...transactions]);
    setDescription(''); setAmount(''); setFormStatus('Lançamento salvo e organizado com sucesso.');
    window.setTimeout(() => setAddOpen(false), 650);
  };
  const handlePhoto = (file?: File) => {
    if (!file) return;
    setPhotoName(file.name); setDescription('Compra identificada pela foto'); setAmount('89,90');
    setFormStatus('Foto recebida. A Lia encontrou uma compra e deixou os campos prontos para você conferir.');
  };
  const tips = [
    'Seu ritmo está bom: você gastou 8% menos que no mesmo período do mês passado.',
    'Se mantiver a média diária, você termina setembro com cerca de R$ 1.480 livres.',
    'A conta de energia está atrasada. Marque como paga assim que resolver para manter o painel correto.',
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
          <div className="premium-card"><span className="premium-icon"><Sparkles /></span><strong>Seu mês em ordem</strong><p>4 de 5 etapas concluídas</p><Progress value={80} className="goal-progress" /></div>
          <button className="nav-item"><Settings /> Configurações</button>
          <div className="user-row"><span className="user-avatar">JM</span><div><strong>João Martins</strong><small>Conta gratuita</small></div><MoreHorizontal /></div>
        </div>
      </aside>
      {mobileMenu && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand-row"><button className="icon-button menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu /></button><div className="brand compact"><span className="brand-mark"><TrendingUp /></span><span>claro</span><b>fin</b></div></div>
          <div className="date-switcher"><button>Setembro de 2026 <ChevronDown /></button><span className="today-dot" /> Hoje, 4 set</div>
          <div className="top-actions"><button className="icon-button notification" aria-label={`${pendingAlerts.length} alertas`}><Bell /><span>{pendingAlerts.length}</span></button><Button className="add-button" onClick={() => { setFormStatus(''); setAddOpen(true); }}><Plus /> Novo lançamento</Button></div>
        </header>

        <div className="dashboard">
          <section className="welcome-row"><div><p className="eyebrow">QUINTA-FEIRA, 4 DE SETEMBRO</p><h1>Olá, João <span>👋</span></h1><p>Aqui está o que importa para suas finanças hoje.</p></div><div className="secure-badge"><ShieldCheck /> Dados salvos neste aparelho</div></section>

          <section className="summary-grid" aria-label="Resumo financeiro">
            <article className="summary-card balance-card"><div className="card-heading"><span>Saldo disponível</span><button onClick={() => setBalanceVisible(!balanceVisible)} aria-label="Mostrar ou esconder saldo">{balanceVisible ? <Eye /> : <EyeOff />}</button></div><strong>{balanceVisible ? money.format(2120) : '••••••'}</strong><p><span className="positive-pill"><ArrowUpRight /> 12,4%</span> comparado a agosto</p><div className="balance-glow" /></article>
            <article className="summary-card"><div className="card-heading"><span>Receitas</span><span className="metric-icon income"><ArrowDownLeft /></span></div><strong>{money.format(6850)}</strong><p>100% recebido neste mês</p></article>
            <article className="summary-card"><div className="card-heading"><span>Despesas</span><span className="metric-icon expense"><ArrowUpRight /></span></div><strong>{money.format(Math.max(4730, currentExpenses))}</strong><p>69% da sua receita mensal</p></article>
            <article className="summary-card safe-card"><div className="card-heading"><span>Livre para gastar</span><span className="metric-icon safe"><ShieldCheck /></span></div><strong>{money.format(1480)}</strong><p><span className="status-dot" /> Seu limite diário é R$ 56,92</p></article>
          </section>

          <section className="main-grid">
            <article className="panel cashflow-panel">
              <div className="panel-header chart-header"><div><h2>Movimento do mês</h2><p>Entradas e saídas acumuladas</p></div><span className="insight-chip"><Sparkles /> -8% em gastos</span></div>
              <Tabs defaultValue="line" className="chart-tabs">
                <TabsList aria-label="Tipo de gráfico"><TabsTrigger value="line">Linha</TabsTrigger><TabsTrigger value="bar">Barras</TabsTrigger><TabsTrigger value="categories">Categorias</TabsTrigger></TabsList>
                <TabsContent value="line" className="chart-content"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cashFlow} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#25d6b5" stopOpacity={0.28} /><stop offset="95%" stopColor="#25d6b5" stopOpacity={0} /></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7756f4" stopOpacity={0.18} /><stop offset="95%" stopColor="#7756f4" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#e8e9ef" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b90a0', fontSize: 12 }} tickFormatter={(value) => `${value} set`} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90a0', fontSize: 12 }} tickFormatter={(value) => `${value / 1000}k`} /><Tooltip formatter={(value) => money.format(Number(value))} labelFormatter={(label) => `${label} de setembro`} /><Area type="monotone" dataKey="income" name="Receitas" stroke="#12af91" strokeWidth={3} fill="url(#incomeFill)" /><Area type="monotone" dataKey="expense" name="Despesas" stroke="#7756f4" strokeWidth={3} fill="url(#expenseFill)" /></AreaChart></ResponsiveContainer></TabsContent>
                <TabsContent value="bar" className="chart-content"><ResponsiveContainer width="100%" height="100%"><BarChart data={cashFlow} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#e8e9ef" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b90a0', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b90a0', fontSize: 12 }} tickFormatter={(value) => `${value / 1000}k`} /><Tooltip formatter={(value) => money.format(Number(value))} /><Bar dataKey="income" name="Receitas" fill="#25d6b5" radius={[6, 6, 0, 0]} /><Bar dataKey="expense" name="Despesas" fill="#7756f4" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></TabsContent>
                <TabsContent value="categories" className="chart-content category-chart-wrap"><ResponsiveContainer width="52%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={3}>{categoryData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => money.format(Number(value))} /></PieChart></ResponsiveContainer><div className="chart-legend">{categoryData.map((item) => <div key={item.name}><span style={{ background: item.color }} /><p>{item.name}<strong>{money.format(item.value)}</strong></p></div>)}</div></TabsContent>
              </Tabs>
              <div className="chart-foot"><span><i className="legend-dot income" /> Receitas <strong>R$ 6.850</strong></span><span><i className="legend-dot expense" /> Despesas <strong>R$ 4.730</strong></span></div>
            </article>

            <article className="panel alerts-panel">
              <div className="panel-header"><div><h2>Contas importantes</h2><p>{pendingAlerts.length ? `${pendingAlerts.length} precisam da sua atenção` : 'Tudo em dia por aqui'}</p></div><button className="text-button">Ver todas</button></div>
              <div className="alerts-list">{pendingAlerts.map((item) => <div className={`alert-row ${item.tone}`} key={item.id}><span className="alert-icon">{item.tone === 'danger' ? <AlertCircle /> : <Bell />}</span><div className="alert-copy"><strong>{item.title}</strong><span>{item.due} · {money.format(item.amount)}</span></div><button onClick={() => setAlerts((all) => all.map((a) => a.id === item.id ? { ...a, paid: true } : a))}><Check /> Paguei</button></div>)}{!pendingAlerts.length && <div className="all-good"><span><Check /></span><strong>Contas em dia!</strong><p>Continue assim. Você não tem pagamentos pendentes.</p></div>}</div>
              <div className="alert-summary"><Lightbulb /><span>Separando <strong>R$ 334,80</strong>, você cobre todas as próximas contas.</span></div>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel transactions-panel"><div className="panel-header"><div><h2>Últimos lançamentos</h2><p>Atualizados automaticamente</p></div><button className="text-button">Ver extrato <ArrowRight /></button></div><div className="transaction-list">{transactions.slice(0, 4).map((item) => <div className="transaction-row" key={item.id}><TransactionIcon type={item.icon} /><div><strong>{item.name}</strong><span>{item.category} · {item.date}</span></div><b className={item.amount > 0 ? 'amount-positive' : ''}>{item.amount > 0 ? '+' : ''}{money.format(item.amount)}</b></div>)}</div></article>
            <article className="panel health-panel"><div className="panel-header"><div><h2>Saúde financeira</h2><p>Seu retrato deste mês</p></div><span className="score-tag">Muito boa</span></div><div className="health-content"><div className="score-ring"><svg viewBox="0 0 120 120" aria-label="Pontuação 82 de 100"><circle cx="60" cy="60" r="49" /><circle className="score-progress" cx="60" cy="60" r="49" pathLength="100" /></svg><div><strong>82</strong><span>/100</span></div></div><div className="health-copy"><strong>Você está no caminho certo</strong><p>Seu saldo e sua economia melhoraram neste mês.</p><button>Ver como melhorar <ArrowRight /></button></div></div></article>
          </section>
        </div>
      </main>

      {assistantOpen && <aside className="coach-card" aria-label="Orientação da Lia"><button className="coach-close" onClick={() => setAssistantOpen(false)} aria-label="Fechar orientação"><X /></button><div className="coach-image"><img src="/lia-avatar.png" alt="Lia, orientadora financeira virtual" /></div><div className="coach-body"><span className="coach-label"><Sparkles /> ORIENTAÇÃO DA LIA</span><strong>{tips[assistantTip]}</strong><button onClick={() => setAssistantTip((assistantTip + 1) % tips.length)}>Ver outra orientação <ArrowRight /></button></div></aside>}
      <nav className="mobile-bottom-nav" aria-label="Navegação móvel"><button className="active"><LayoutGrid /><span>Início</span></button><button><ReceiptText /><span>Extrato</span></button><button className="mobile-add" onClick={() => setAddOpen(true)} aria-label="Novo lançamento"><Plus /></button><button><Target /><span>Metas</span></button><button><Settings /><span>Ajustes</span></button></nav>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="launch-dialog"><DialogHeader><span className="dialog-kicker"><Sparkles /> Lançamento inteligente</span><DialogTitle>O que você quer registrar?</DialogTitle><DialogDescription>Digite do seu jeito ou fotografe um comprovante. A Lia organiza as informações e você confirma antes de salvar.</DialogDescription></DialogHeader>
          <Tabs defaultValue="manual" className="launch-tabs"><TabsList><TabsTrigger value="manual"><FileText /> Digitar</TabsTrigger><TabsTrigger value="photo"><Camera /> Usar foto</TabsTrigger></TabsList>
            <TabsContent value="manual"><form className="launch-form" onSubmit={addTransaction}><label>Descrição da movimentação<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: almoço 35 reais" /></label><label>Valor<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="R$ 0,00" /></label><div className="ai-note"><Sparkles /><span><strong>Organização assistida.</strong> A categoria e a data serão sugeridas automaticamente; você mantém o controle.</span></div>{formStatus && <p className="form-status" role="status">{formStatus}</p>}<Button type="submit" className="save-button">Revisar e salvar <ArrowRight /></Button></form></TabsContent>
            <TabsContent value="photo"><div className="photo-upload"><input id="receipt-photo" type="file" accept="image/*" capture="environment" onChange={(event) => handlePhoto(event.target.files?.[0])} /><label htmlFor="receipt-photo"><span><Camera /></span><strong>{photoName || 'Fotografar comprovante'}</strong><small>Nota fiscal, boleto ou recibo</small></label>{formStatus && <p className="form-status" role="status">{formStatus}</p>}</div></TabsContent>
          </Tabs><DialogFooter className="dialog-footnote"><ShieldCheck /> Nesta versão, a foto permanece somente neste aparelho.</DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
