# Relatório de testes — Clarofin Cloud Edition

Data: 27/11/2026

## Executados com sucesso

- `pnpm verify:finance`: totais, despesas previstas, recorrências e saldo residual entre meses.
- `pnpm exec tsc --noEmit`: checagem de tipos da aplicação web.
- `NEXT_PUBLIC_BASE_PATH=/Clarofin pnpm build:github`: exportação estática concluída para GitHub Pages.
- Migrações aplicadas no projeto Supabase exclusivo.
- Edge Function `clarofin-delete-account` publicada com verificação JWT.
- Advisors do Supabase: sem alertas de segurança, desempenho ou saúde.
- Inspeção de RLS: as políticas de cada tabela privada usam o identificador do usuário autenticado e bloqueiam alteração de propriedade.

## Dependentes de configuração manual externa

- Login Google, pois requer Client ID e Client Secret criados pelo proprietário no Google Cloud.
- Fluxo de confirmação/recuperação por e-mail no domínio publicado, pois requer configurar a Site URL e Redirect URL no painel Auth do Supabase.
- Testes com duas contas reais após a configuração acima. Eles não foram marcados como aprovados nesta entrega.

