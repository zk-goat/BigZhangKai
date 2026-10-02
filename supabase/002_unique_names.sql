-- 第二版：昵称唯一 + 成绩绑定玩家身份
-- 每台设备生成一个随机身份码（token），数据库只存它的 sha256。
-- 网页不再直接读写表，只能调用下面三个函数：占昵称、交成绩、看榜单。

create extension if not exists pgcrypto with schema extensions;

-- 玩家：昵称唯一（不区分大小写），身份码哈希唯一
create table if not exists public.players (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 1 and 12),
  token_hash  text not null unique,
  created_at  timestamptz not null default now()
);
create unique index if not exists players_name_unique on public.players (lower(name));
alter table public.players enable row level security;   -- 不建任何策略 = 网页无法直接读写

-- 成绩挂到玩家上（旧成绩没有玩家，不再显示在新榜单里）
alter table public.scores add column if not exists player_id bigint references public.players(id) on delete cascade;
create index if not exists scores_player_idx on public.scores (player_id, score desc);

-- 收回网页对成绩表的直接权限，统一走函数
drop policy if exists "所有人可查看排行榜" on public.scores;
drop policy if exists "所有人可提交成绩" on public.scores;
revoke select, insert on public.scores from anon;

-- 身份码 → 玩家 id（找不到返回 null）
create or replace function public._player_id(p_token text)
returns bigint
language sql stable security definer set search_path = public, extensions
as $$
  select id from players where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke execute on function public._player_id(text) from public, anon;

-- 占用/修改昵称：返回 'ok' 或 'taken'
create or replace function public.claim_name(p_token text, p_name text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_name text := btrim(p_name);
  v_id   bigint;
begin
  if p_token is null or char_length(p_token) < 32 then raise exception 'invalid token'; end if;
  if char_length(v_name) not between 1 and 12 then raise exception 'invalid name'; end if;
  v_id := public._player_id(p_token);
  begin
    if v_id is null then
      insert into players (name, token_hash) values (v_name, encode(extensions.digest(p_token, 'sha256'), 'hex'));
    else
      update players set name = v_name where id = v_id;
    end if;
  exception when unique_violation then
    return 'taken';
  end;
  return 'ok';
end;
$$;

-- 提交一局成绩：返回这位玩家最高分的名次；身份码没占过昵称返回 null
create or replace function public.submit_score(p_token text, p_score integer, p_top_level smallint, p_merges integer, p_duration integer)
returns integer
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_id   bigint := public._player_id(p_token);
  v_best integer;
begin
  if v_id is null then return null; end if;
  insert into scores (name, score, top_level, merges, duration_s, player_id)
  select name, p_score, p_top_level, p_merges, p_duration, v_id from players where id = v_id;
  select max(score) into v_best from scores where player_id = v_id;
  return 1 + (
    select count(*) from (
      select max(score) as best from scores where player_id is not null and player_id <> v_id group by player_id
    ) t where t.best > v_best
  );
end;
$$;

-- 榜单：每位玩家只取最高分；is_me 标出调用者自己
create or replace function public.top_scores(p_token text, p_limit integer default 20)
returns table (name text, score integer, top_level smallint, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public, extensions
as $$
  select p.name, b.score, b.top_level, b.created_at, p.id = public._player_id(p_token)
  from (
    select distinct on (player_id) player_id, score, top_level, created_at
    from scores where player_id is not null
    order by player_id, score desc, created_at asc
  ) b
  join players p on p.id = b.player_id
  order by b.score desc, b.created_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

grant execute on function public.claim_name(text, text) to anon;
grant execute on function public.submit_score(text, integer, smallint, integer, integer) to anon;
grant execute on function public.top_scores(text, integer) to anon;
