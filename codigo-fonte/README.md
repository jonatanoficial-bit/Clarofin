# Clarofin — Parte 1

Primeira versão funcional de uma plataforma de organização financeira pessoal. Foi desenhada para ser clara para iniciantes e útil para adolescentes, adultos e idosos que já controlam o próprio dinheiro.

## O que já funciona

- painel mensal responsivo com visual de aplicativo;
- gráficos de linha, barras e categorias;
- alertas de contas pendentes com ação “Paguei”;
- lançamento manual com organização assistida;
- captura de foto pelo celular (fluxo demonstrativo nesta etapa);
- transações salvas localmente no navegador;
- orientadora virtual Lia com explicações financeiras;
- navegação adaptada para computador e celular.

## Rodar localmente

Requer Node.js 22 ou superior e pnpm.

```bash
pnpm install
pnpm dev
```

## Gerar os arquivos para publicação

```bash
pnpm build
```

Os arquivos estáticos prontos para hospedagem ficam em `dist/client`. No GitHub Pages, publique essa pasta com uma ação de deploy estático.

O projeto já inclui uma ação automática. Crie um repositório no GitHub, envie estes arquivos para a branch `main` e, nas configurações do repositório, selecione **Pages → Source → GitHub Actions**. A publicação será iniciada automaticamente.

## Próximas etapas sugeridas

1. contas de usuário e sincronização segura;
2. banco de dados para lançamentos e contas recorrentes;
3. leitura real de notas e comprovantes por OCR/IA;
4. metas, orçamentos e relatórios anuais;
5. notificações e plano premium.

> A leitura inteligente de fotos é uma demonstração visual na Parte 1; nenhum dado financeiro real é enviado a servidores.
