# Auditoria de segurança — Clarofin Cloud Edition

Data: 27/11/2026

## Escopo verificado

- Projeto Supabase exclusivo: `Clarofin Cloud Edition` (`nnjoqwvowdokzofsztxy`).
- Três tabelas privadas: `clarofin_profiles`, `clarofin_states` e `clarofin_sync_metadata`.
- RLS habilitado em todas as tabelas expostas.
- Políticas `SELECT`, `INSERT`, `UPDATE` e `DELETE` limitadas ao proprietário com `(select auth.uid()) = user_id`.
- Políticas de atualização incluem `USING` e `WITH CHECK`.
- A chave usada no navegador é somente a publicável; não há `service_role`, senha de banco ou segredo OAuth no repositório.
- A Edge Function `clarofin-delete-account` exige JWT válido e mantém a chave administrativa somente no ambiente do Supabase.

## Resultado

Os advisors de segurança, desempenho e saúde do projeto não retornaram alertas após a migração. A inspeção de políticas confirmou as doze políticas de propriedade esperadas.

## Limitação conhecida

O teste de duas contas reais e do Google OAuth depende de criar/configurar o cliente OAuth do proprietário no Google Cloud. Nenhuma conta fictícia foi criada para evitar envio de e-mails ou dados desnecessários.

