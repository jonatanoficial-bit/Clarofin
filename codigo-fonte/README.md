# Clarofin — Parte 4

Plataforma de administração financeira pessoal com visual de aplicativo, linguagem clara e foco em adolescentes, adultos e idosos.

## O que já funciona

- controle mês a mês com navegação pelo calendário;
- análises diárias, mensais e anuais;
- gráficos de linha, barras e distribuição detalhada por categorias;
- separação visual entre despesas pagas, despesas a vencer e saldo projetado;
- identificação automática da área com maior gasto;
- 15 categorias de despesas, incluindo consumo, alimentação, transporte, lazer, assinaturas e telefonia;
- 12 origens de entrada, incluindo salário CLT, freelancer, doação e presente;
- alertas automáticos: toda despesa com data futura entra em **Contas a vencer**;
- ação **Paguei** que atualiza o lançamento e todos os cálculos;
- despesas recorrentes mensais configuráveis de 2 a 60 meses;
- lançamento de receita ou despesa, com categoria e data;
- foto do comprovante pela câmera do celular, reduzida e salva junto ao lançamento;
- orientadora virtual Lia com explicações sérias e objetivas;
- salvamento principal em IndexedDB e segunda cópia automática no navegador;
- exportação e restauração de backup em arquivo JSON;
- navegação responsiva para computador e celular.
- navegação lateral funcional em todas as áreas;
- histórico completo de lançamentos com busca, filtro e exclusão;
- cadastro de contas e cartões;
- metas financeiras com progresso e novos aportes;
- orçamento mensal por categoria;
- relatório anual mês a mês e exportação CSV;
- início limpo, sem valores financeiros demonstrativos.

## Segurança dos dados nesta etapa

Os dados ficam somente no aparelho do usuário. O IndexedDB mantém a cópia principal e o armazenamento local mantém uma segunda cópia de recuperação quando há espaço disponível. O usuário também pode baixar um arquivo de backup.

Limpar os dados do navegador ou perder o aparelho ainda pode apagar as cópias locais. Por isso, o painel recomenda backups periódicos. A próxima evolução planejada é login com sincronização segura, podendo usar Firebase Authentication e Firestore.

Ao abrir a Parte 4 pela primeira vez, os dados reais das versões anteriores são migrados e preservados. Despesas futuras antigas também passam a ser reconhecidas automaticamente como contas a vencer.

## Rodar localmente

Requer Node.js 22 ou superior e pnpm.

```bash
pnpm install
pnpm dev
```

## Gerar o site

Build local:

```bash
pnpm build
```

Build preparado para o endereço `https://USUARIO.github.io/Clarofin/`:

```bash
NEXT_PUBLIC_BASE_PATH=/Clarofin pnpm build:github
```

No PowerShell:

```powershell
$env:NEXT_PUBLIC_BASE_PATH='/Clarofin'
pnpm build:github
```

Os arquivos prontos ficam em `dist/client`.

## Publicação automática

O projeto inclui `.github/workflows/deploy-pages.yml`. Nas configurações do repositório, escolha **Settings → Pages → Source → GitHub Actions**. Cada envio para a branch `main` fará uma nova publicação.

## Próximas etapas

1. login e sincronização em nuvem com Firebase;
2. OCR/IA para extrair valor, data e estabelecimento da foto;
3. notificações no celular e recursos premium;
4. edição em lote de séries recorrentes.
