-- 第三版：防伪造与边界修正（可重复执行）
-- 1. 昵称归一化：全角半角统一（NFKC），去掉控制字符和零宽/方向控制等不可见字符，防止“张三”和“张三+零宽空格”并存
-- 2. 同一设备并发占名时不再误报“已被别人用了”
-- 3. 成绩合理性检查：分数、合成次数、等级、用时要能对得上，挡住最直白的伪造
-- 4. 同一玩家 10 秒内只能交一次成绩

create or replace function public._clean_name(p_name text)
returns text
language sql immutable set search_path = public
as $fn$
  select btrim(regexp_replace(normalize(coalesce(p_name, ''), NFKC),
         '[\u0000-\u001F\u007F­​-‏‪-‮⁠-⁤﻿]', '', 'g'));
$fn$;
revoke execute on function public._clean_name(text) from public, anon;

create or replace function public.claim_name(p_token text, p_name text)
returns text
language plpgsql security definer set search_path = public, extensions
as $fn$
declare
  v_name text := public._clean_name(p_name);
  v_hash text;
  v_id   bigint;
begin
  if p_token is null or char_length(p_token) < 32 then raise exception 'invalid token'; end if;
  if char_length(v_name) not between 1 and 12 then raise exception 'invalid name'; end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select id into v_id from players where token_hash = v_hash;
  begin
    if v_id is null then
      insert into players (name, token_hash) values (v_name, v_hash);
    else
      update players set name = v_name where id = v_id;
    end if;
  exception when unique_violation then
    -- 同一设备的两次请求撞车：名字已经是自己的，算成功
    if exists (select 1 from players where token_hash = v_hash and lower(name) = lower(v_name)) then
      return 'ok';
    end if;
    return 'taken';
  end;
  return 'ok';
end;
$fn$;

create or replace function public.submit_score(p_token text, p_score integer, p_top_level smallint, p_merges integer, p_duration integer)
returns integer
language plpgsql security definer set search_path = public, extensions
as $fn$
declare
  v_id   bigint := public._player_id(p_token);
  v_best integer;
begin
  if v_id is null then return null; end if;

  -- 合理性检查（与游戏规则对应：每 0.45 秒最多投一个；每次合成净减少一个张楷；
  -- 只会掉前 5 级，合到第 L 级（从 0 数）至少要 2^(L-4)-1 次合成；单次合成得分不会超过约 80）
  if p_merges > p_duration * 2.5 + 5
     or p_score > p_merges * 80 + 300
     or (p_top_level > 4 and p_merges < power(2, p_top_level - 4) - 1) then
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

grant execute on function public.claim_name(text, text) to anon;
grant execute on function public.submit_score(text, integer, smallint, integer, integer) to anon;
