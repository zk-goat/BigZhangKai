-- 第四版：配合“后期掉更大的张楷”和计分倍率 1.75，放宽成绩合理性检查（可重复执行）
-- 1. 后期最大会掉第 9 级（从 0 数是 8），合到第 L 级至少要 2^(L-8)-1 次合成（原来按只掉前 5 级算是 2^(L-4)-1）
-- 2. 每次合成得分乘了 1.75，模拟中平均约 39、最高约 45，上限从 60 放宽到 100
-- 只替换 submit_score，不动数据。新规则比旧规则宽松，旧版本玩家不受影响。

create or replace function public.submit_score(p_token text, p_score integer, p_top_level smallint, p_merges integer, p_duration integer)
returns integer
language plpgsql security definer set search_path = public, extensions
as $fn$
declare
  v_id   bigint := public._player_id(p_token);
  v_best integer;
begin
  if v_id is null then return null; end if;

  -- 每 0.45 秒最多投一个；每次合成净减少一个张楷；最大掉第 9 级；每次合成平均得分上限 100
  if p_merges > p_duration * 2.5 + 5
     or p_score > p_merges * 100 + 300
     or (p_top_level > 8 and p_merges < power(2, p_top_level - 8) - 1) then
    raise exception 'rejected: implausible score';
  end if;

  if exists (select 1 from scores where player_id = v_id and created_at > now() - interval '10 seconds') then
    raise exception 'rejected: too frequent';
  end if;

  insert into scores (name, score, top_level, merges, duration_s, player_id)
  select name, p_score, p_top_level, p_merges, p_duration, v_id from players where id = v_id;
  select max(score) into v_best from scores where player_id = v_id;
  return 1 + (
    select count(*) from (
      select max(score) as best from scores where player_id is not null and player_id <> v_id group by player_id
    ) t where t.best > v_best
  );
end;
$fn$;

grant execute on function public.submit_score(text, integer, smallint, integer, integer) to anon;
