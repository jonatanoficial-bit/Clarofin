# Clarofin 2.0 — Cloud Edition

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

## Nuvem, privacidade e continuidade

Cada pessoa usa uma conta própria do Supabase. O aplicativo oferece cadastro com e-mail e senha, confirmação de e-mail, recuperação de senha, sessão persistente, saída e exclusão definitiva de conta. A exclusão só é executada por uma Edge Function autenticada; a credencial administrativa nunca chega ao navegador.

Os dados financeiros são sincronizados para o projeto exclusivo `Clarofin Cloud Edition`, com RLS em todas as tabelas. A política de cada tabela exige `(select auth.uid()) = user_id`, inclusive em `UPDATE` e `WITH CHECK`. Dados de outra conta não são carregados do cache local.

No primeiro acesso, o Clarofin detecta os dados locais existentes, mostra a quantidade encontrada e pede confirmação antes de vinculá-los à conta. O original permanece no navegador. Os valores são normalizados em centavos antes do salvamento e o saldo acumulado considera o resultado realizado dos meses anteriores, sem descontar despesas apenas planejadas.

O IndexedDB continua como cache/offline da conta atual e o backup JSON continua disponível. Limpar dados do navegador pode remover esse cache; mantenha um backup externo.

## Configuração única do Google OAuth

O projeto Supabase já criado para o Clarofin é `nnjoqwvowdokzofsztxy`. Esta única configuração manual é necessária porque o Google Client Secret não pode ser exposto a um agente, ao navegador ou ao GitHub:

1. No [Google Cloud Console](https://console.cloud.google.com/), crie ou selecione um projeto e crie um cliente OAuth 2.0 do tipo **Aplicativo da Web**.
2. Em **Authorized JavaScript origins**, inclua `https://jonatanoficial-bit.github.io`.
3. Em **Authorized redirect URIs**, inclua `https://nnjoqwvowdokzofsztxy.supabase.co/auth/v1/callback`.
4. No painel do novo projeto Supabase, abra **Authentication → URL Configuration** e defina a Site URL como `https://jonatanoficial-bit.github.io/Clarofin/`. Adicione a mesma URL à lista de Redirect URLs.
5. Em **Authentication → Providers → Google**, habilite o provedor e informe o Client ID e o Client Secret criados no Google Cloud. Mantenha os escopos em `openid`, `email` e `profile`.

Não use nem publique uma `service_role`, senha de banco ou Client Secret. A chave publicável no cliente é própria para aplicações estáticas e não concede acesso fora das políticas RLS.

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

## Banco e rollback

- Migração: `supabase/migrations/20261127190000_clarofin_cloud_initial.sql`.
- Edge Function de exclusão: `supabase/functions/clarofin-delete-account/index.ts`.
- Para rollback de código, reverta o commit ou retorne à branch anterior. A migração cria apenas objetos com prefixo `clarofin_` no projeto exclusivo; não altera qualquer outro projeto Supabase.

