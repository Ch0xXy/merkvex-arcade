-- Global arcade leaderboards (per game).
-- SECURITY (2026-08-01 incident):
-- This table lives on Merkvex/AV prod Postgres. It must NEVER be created via
-- Supabase MCP / PostgREST-facing apply paths without RLS + REVOKE. Arcade
-- writes as table owner over DATABASE_URL only. REST roles must hold zero
-- grants (see website migration 20260801120000_arcade_scores_lockdown.sql).
-- Owner-role writes bypass RLS — CHECK constraints are the server-side bounds.
create table if not exists arcade_scores (
  id text primary key,
  game_id text not null,
  player_name text not null
    check (char_length(player_name) between 1 and 32),
  score integer not null
    check (score >= 0 and score <= 100000000),
  created_at timestamptz default CURRENT_TIMESTAMP not null
);

create index if not exists arcade_scores_game_score_idx
  on arcade_scores (game_id, score desc, created_at asc);

-- Harden grants if this file is ever applied on a role that has CREATEROLE defaults.
-- Owner retains full rights; PostgREST roles get nothing.
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'arcade_scores'
  ) then
    execute 'alter table public.arcade_scores enable row level security';
    execute 'revoke all on table public.arcade_scores from public, anon, authenticated, service_role';
  end if;
end $$;
