-- 第六版：周榜（可重复执行）。只新增函数，不动任何数据。
-- 一周按北京时间从周一 0 点开始；总榜不变，周榜只看这一周内交的成绩，每人取本周最高分。

-- 往前数第 p_weeks_ago 周的周一 0 点（北京时间）；0 = 本周，1 = 上周，-1 = 下周
create or replace function public._week_start(p_weeks_ago integer default 0)
returns timestamptz
language sql stable set search_path = public
as $fn$
  select (date_trunc('week', now() at time zone 'Asia/Shanghai') - make_interval(weeks => p_weeks_ago))
         at time zone 'Asia/Shanghai';
$fn$;
revoke execute on function public._week_start(integer) from public, anon;

-- 周榜：p_weeks_ago = 0 本周、1 上周（用来显示上周冠军）
create or replace function public.top_scores_week(p_token text, p_limit integer default 20, p_weeks_ago integer default 0)
returns table (name text, avatar text, score integer, top_level smallint, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public, extensions
as $fn$
  select p.name, p.avatar, b.score, b.top_level, b.created_at, p.id = public._player_id(p_token)
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

-- 自己在本周榜的名次；本周还没成绩返回 null
create or replace function public.my_week_rank(p_token text)
returns integer
language sql stable security definer set search_path = public, extensions
as $fn$
  with wk as (
    select player_id, max(score) as best
    from scores
    where player_id is not null and created_at >= public._week_start(0)
    group by player_id
  ), me as (
    select best from wk where player_id = public._player_id(p_token)
  )
  select case when (select best from me) is null then null
              else 1 + (select count(*) from wk where best > (select best from me))::integer end;
$fn$;

grant execute on function public.top_scores_week(text, integer, integer) to anon;
grant execute on function public.my_week_rank(text) to anon;
