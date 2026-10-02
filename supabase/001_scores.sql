-- 第一版：成绩表（已在 Supabase 执行过，留档）
create table public.scores (
  id          bigint generated always as identity primary key,
  name        text     not null check (char_length(name) between 1 and 12),
  score       integer  not null check (score between 0 and 200000),
  top_level   smallint not null check (top_level between 0 and 13),
  merges      integer  not null default 0 check (merges between 0 and 100000),
  duration_s  integer  not null default 0 check (duration_s between 0 and 86400),
  created_at  timestamptz not null default now()
);

create index scores_rank_idx on public.scores (score desc);

alter table public.scores enable row level security;

create policy "所有人可查看排行榜"
  on public.scores for select to anon using (true);

create policy "所有人可提交成绩"
  on public.scores for insert to anon with check (true);

grant select, insert on public.scores to anon;
