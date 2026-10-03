-- 第七版：排行榜显示成就数（可重复执行）。只新增字段和函数，不改动已有成绩。
-- 成就本身存在玩家手机里，这里只存一个“解锁了几个”的数字给排行榜显示。

alter table public.players add column if not exists badges smallint not null default 0;

-- 上报成就数：返回 'ok'；本机没占过昵称返回 null
create or replace function public.set_badges(p_token text, p_count integer)
returns text
language plpgsql security definer set search_path = public, extensions
as $fn$
declare
  v_id bigint := public._player_id(p_token);
begin
  if v_id is null then return null; end if;
  if p_count is null or p_count < 0 or p_count > 50 then raise exception 'invalid badges'; end if;
  update players set badges = p_count where id = v_id;
  return 'ok';
end;
$fn$;
grant execute on function public.set_badges(text, integer) to anon;

-- 总榜、周榜都带上成就数（返回的列变了，先删旧函数再建）
drop function if exists public.top_scores(text, integer);
create function public.top_scores(p_token text, p_limit integer default 20)
returns table (name text, avatar text, badges smallint, score integer, top_level smallint, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public, extensions
as $fn$
  select p.name, p.avatar, p.badges, b.score, b.top_level, b.created_at, p.id = public._player_id(p_token)
  from (
    select distinct on (player_id) player_id, score, top_level, created_at
    from scores where player_id is not null
    order by player_id, score desc, created_at asc
  ) b
  join players p on p.id = b.player_id
  order by b.score desc, b.created_at asc
  limit least(greatest(p_limit, 1), 100);
$fn$;
grant execute on function public.top_scores(text, integer) to anon;

drop function if exists public.top_scores_week(text, integer, integer);
create function public.top_scores_week(p_token text, p_limit integer default 20, p_weeks_ago integer default 0)
returns table (name text, avatar text, badges smallint, score integer, top_level smallint, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public, extensions
as $fn$
  select p.name, p.avatar, p.badges, b.score, b.top_level, b.created_at, p.id = public._player_id(p_token)
  from (
    select distinct on (player_id) player_id, score, top_level, created_at
    from scores
    where player_id is not null
      and created_at >= public._week_start(p_weeks_ago)
      and created_at <  public._week_start(p_weeks_ago - 1)
    order by player_id, score desc, created_at asc
  ) b
  join players p on p.id = b.player_id
  order by b.score desc, b.created_at asc
  limit least(greatest(p_limit, 1), 100);
$fn$;
grant execute on function public.top_scores_week(text, integer, integer) to anon;
