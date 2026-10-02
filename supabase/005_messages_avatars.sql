-- 第五版：给张楷的公开留言墙 + 个人头像（可重复执行）
-- 网页只能调用 post_message / list_messages / set_avatar / my_profile 这几个函数；署名和头像取玩家当前的，改了以后旧留言也跟着变。
-- 删留言（在 SQL Editor 里）：delete from public.messages where id = 留言编号;
-- 按昵称删光某人的留言：delete from public.messages where player_id = (select id from public.players where name = '昵称');

create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  player_id   bigint not null references public.players(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 200),
  created_at  timestamptz not null default now()
);
create index if not exists messages_time_idx on public.messages (created_at desc, id desc);
create index if not exists messages_player_idx on public.messages (player_id, created_at desc);
alter table public.messages enable row level security;   -- 不建策略 = 网页不能直接读写表

-- 发留言：返回 'ok'；本机身份码没占过昵称返回 null
create or replace function public.post_message(p_token text, p_content text)
returns text
language plpgsql security definer set search_path = public, extensions
as $fn$
declare
  v_id      bigint := public._player_id(p_token);
  v_content text;
begin
  if v_id is null then return null; end if;
  -- 去掉零宽/方向控制等不可见字符和除换行外的控制字符，连续空行最多保留一个
  v_content := regexp_replace(coalesce(p_content, ''),
                 '[\u0000-\u0009\u000B-\u001F\u007F­​-‏‪-‮⁠-⁤﻿]', '', 'g');
  v_content := regexp_replace(v_content, '\n{3,}', E'\n\n', 'g');
  v_content := btrim(v_content, E' \n\r\t');
  if char_length(v_content) not between 1 and 200 then raise exception 'invalid content'; end if;

  if exists (select 1 from messages where player_id = v_id and created_at > now() - interval '30 seconds') then
    raise exception 'rejected: too frequent';
  end if;
  if (select count(*) from messages where player_id = v_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rejected: daily limit';
  end if;

  insert into messages (player_id, content) values (v_id, v_content);
  return 'ok';
end;
$fn$;

-- 看留言：最新的在前；p_before 传上一页最后一条的 id 用来翻页（第一页传 null）；is_me 标出自己发的
create or replace function public.list_messages(p_token text, p_limit integer default 30, p_before bigint default null)
returns table (id bigint, name text, content text, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public, extensions
as $fn$
  select m.id, p.name, m.content, m.created_at, m.player_id = public._player_id(p_token)
  from messages m
  join players p on p.id = m.player_id
  where p_before is null or m.id < p_before
  order by m.id desc
  limit least(greatest(p_limit, 1), 50);
$fn$;

grant execute on function public.post_message(text, text) to anon;
grant execute on function public.list_messages(text, integer, bigint) to anon;

-- ================= 个人头像 =================
-- 头像是在手机上裁好、压成 96×96 的小图（几 KB），以 data URL 存在玩家表里；为空时网页显示昵称首字的彩色圆
-- 清掉某人的头像：update public.players set avatar = null where name = '昵称';

alter table public.players add column if not exists avatar text;
alter table public.players add column if not exists avatar_at timestamptz;

-- 设置头像：p_avatar 为空表示删掉头像；返回 'ok'，本机没占过昵称返回 null
create or replace function public.set_avatar(p_token text, p_avatar text)
returns text
language plpgsql security definer set search_path = public, extensions
as $fn$
declare
  v_id bigint := public._player_id(p_token);
begin
  if v_id is null then return null; end if;
  if p_avatar is not null and (
       char_length(p_avatar) > 30000
       or p_avatar !~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$') then
    raise exception 'invalid avatar';
  end if;
  if exists (select 1 from players where id = v_id and avatar_at > now() - interval '10 seconds') then
    raise exception 'rejected: too frequent';
  end if;
  update players set avatar = p_avatar, avatar_at = now() where id = v_id;
  return 'ok';
end;
$fn$;
grant execute on function public.set_avatar(text, text) to anon;

-- 排行榜和留言都带上头像（返回的列变了，要先删掉旧函数再建）
drop function if exists public.top_scores(text, integer);
create function public.top_scores(p_token text, p_limit integer default 20)
returns table (name text, avatar text, score integer, top_level smallint, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public, extensions
as $fn$
  select p.name, p.avatar, b.score, b.top_level, b.created_at, p.id = public._player_id(p_token)
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

drop function if exists public.list_messages(text, integer, bigint);
create function public.list_messages(p_token text, p_limit integer default 30, p_before bigint default null)
returns table (id bigint, name text, avatar text, content text, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = public, extensions
as $fn$
  select m.id, p.name, p.avatar, m.content, m.created_at, m.player_id = public._player_id(p_token)
  from messages m
  join players p on p.id = m.player_id
  where p_before is null or m.id < p_before
  order by m.id desc
  limit least(greatest(p_limit, 1), 50);
$fn$;
grant execute on function public.list_messages(text, integer, bigint) to anon;

-- 读自己的头像（换手机后同步不了，但同一台设备清了本地缓存还能拿回来）
create or replace function public.my_profile(p_token text)
returns table (name text, avatar text)
language sql stable security definer set search_path = public, extensions
as $fn$
  select name, avatar from players where id = public._player_id(p_token);
$fn$;
grant execute on function public.my_profile(text) to anon;
