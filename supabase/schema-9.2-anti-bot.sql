-- =============================================
-- Phase 9.2 — 어뷰징 탐지 회피 스키마 보강
-- =============================================
-- 목적:
--   1) post_discussions / discussion_replies 에 ip_hash 컬럼 추가
--   2) community_posts 의 view_count 점진 증가 함수 추가
--   3) 조회 인덱스 보강

-- 1. ip_hash 컬럼 추가 (레이어1 토론)
alter table post_discussions
  add column if not exists ip_hash text;

create index if not exists idx_post_discussions_ip_hash
  on post_discussions(ip_hash)
  where ip_hash is not null;

alter table discussion_replies
  add column if not exists ip_hash text;

create index if not exists idx_discussion_replies_ip_hash
  on discussion_replies(ip_hash)
  where ip_hash is not null;

-- 2. community_posts view_count 점진 증가 함수
--    호출: select simulate_community_view_growth(post_id, delta);
create or replace function simulate_community_view_growth(
  p_id uuid,
  p_delta integer default 1
)
returns integer
language plpgsql
as $$
declare
  v_new integer;
begin
  update community_posts
     set view_count = greatest(0, view_count + p_delta),
         updated_at = now()
   where id = p_id
  returning view_count into v_new;
  return coalesce(v_new, 0);
end;
$$;

-- 3. 조회수 랜덤 성장 함수 (배치 호출용)
--    p_post_ids 배열 중 p_ratio 비율만큼 1~3 랜덤 증가
create or replace function simulate_community_view_batch(
  p_post_ids uuid[],
  p_ratio numeric default 0.3,
  p_max_delta integer default 3
)
returns integer
language plpgsql
as $$
declare
  v_id uuid;
  v_touched integer := 0;
  v_delta integer;
begin
  foreach v_id in array p_post_ids loop
    if random() < p_ratio then
      v_delta := 1 + floor(random() * p_max_delta)::integer;
      perform simulate_community_view_growth(v_id, v_delta);
      v_touched := v_touched + 1;
    end if;
  end loop;
  return v_touched;
end;
$$;
