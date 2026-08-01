-- Global arcade leaderboards (per game).
create table if not exists arcade_scores (
  id text primary key,
  game_id text not null,
  player_name text not null,
  score integer not null check (score >= 0),
  created_at timestamptz default CURRENT_TIMESTAMP not null
);

create index if not exists arcade_scores_game_score_idx
  on arcade_scores (game_id, score desc, created_at asc);
