# Changelog

## 2.0.0 — Cloud Edition

- adicionada autenticação por e-mail/senha, recuperação de senha, sessão persistente e entrada com Google;
- criado projeto Supabase exclusivo do Clarofin, sem reutilizar tabelas ou configurações de outros aplicativos;
- adicionadas tabelas privadas, RLS por `auth.uid()`, sincronização com revisão e atualização em tempo real;
- separado o cache local por usuário e protegida a importação de dados locais legados;
- adicionada confirmação explícita antes de importar dados do navegador para a nuvem;
- adicionada exclusão definitiva de conta por Edge Function autenticada;
- incluído saldo residual realizado dos meses anteriores no saldo acumulado atual;
- atualizadas telas de dados, sincronização, backup e conta.

