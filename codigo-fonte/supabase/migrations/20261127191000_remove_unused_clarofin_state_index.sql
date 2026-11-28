-- Cada usuário possui somente um snapshot; a chave primária já atende as consultas do aplicativo.
drop index if exists public.clarofin_states_updated_at_idx;

