-- =============================================
-- Phase 9.0 소통 커뮤니티 게시판 스키마
-- =============================================
-- Supabase SQL Editor에서 실행
-- 클리앙 스타일 비로그인 게시판 (닉네임 + 비밀번호 해시)

-- 1. community_posts (게시글)
create table if not exists community_posts (
  id              uuid primary key default gen_random_uuid(),
  category        text not null,                -- free | qna | review | info | humor
  title           text not null,
  content         text not null,
  nickname        text not null,
  password_hash   text not null,                -- bcryptjs 해시
  view_count      integer default 0,
  comment_count   integer default 0,            -- 비정규화 캐시
  is_hot          boolean default false,        -- 핫 게시물 (조회수/댓글수 임계값 초과)
  is_ai_generated boolean default false,        -- AI 페르소나 시딩 여부
  persona_id      uuid references discussion_personas(id) on delete set null,
  ip_hash         text,                         -- SHA-256 + salt 해시 (개인정보 보호)
  image_url       text,                         -- Supabase Storage URL
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_community_posts_category
  on community_posts(category);
create index if not exists idx_community_posts_created
  on community_posts(created_at desc);
create index if not exists idx_community_posts_hot
  on community_posts(is_hot) where is_hot = true;
create index if not exists idx_community_posts_comment_count
  on community_posts(comment_count desc);

-- 2. community_comments (댓글 + 1단계 대댓글)
create table if not exists community_comments (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references community_posts(id) on delete cascade,
  parent_id       uuid references community_comments(id) on delete cascade,
  nickname        text not null,
  password_hash   text not null,
  content         text not null,
  is_ai_generated boolean default false,
  persona_id      uuid references discussion_personas(id) on delete set null,
  ip_hash         text,
  created_at      timestamptz default now()
);

create index if not exists idx_community_comments_post
  on community_comments(post_id, created_at);
create index if not exists idx_community_comments_parent
  on community_comments(parent_id) where parent_id is not null;

-- 3. RLS 정책 — 공개 읽기, 쓰기는 API Route에서 service_role로 처리
alter table community_posts enable row level security;
alter table community_comments enable row level security;

drop policy if exists "community_posts_public_read" on community_posts;
create policy "community_posts_public_read" on community_posts
  for select using (true);

drop policy if exists "community_posts_admin_all" on community_posts;
create policy "community_posts_admin_all" on community_posts
  for all using (auth.role() = 'service_role');

drop policy if exists "community_comments_public_read" on community_comments;
create policy "community_comments_public_read" on community_comments
  for select using (true);

drop policy if exists "community_comments_admin_all" on community_comments;
create policy "community_comments_admin_all" on community_comments
  for all using (auth.role() = 'service_role');

-- 4. comment_count 자동 증감 트리거
create or replace function sync_community_comment_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update community_posts
       set comment_count = comment_count + 1
     where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update community_posts
       set comment_count = greatest(comment_count - 1, 0)
     where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_community_comment_count on community_comments;
create trigger trg_community_comment_count
after insert or delete on community_comments
for each row execute function sync_community_comment_count();

-- 5. is_hot 자동 갱신 (조회수 300+ 또는 댓글 10+)
create or replace function refresh_community_hot_flag()
returns trigger
language plpgsql
as $$
begin
  new.is_hot := (new.view_count >= 300 or new.comment_count >= 10);
  return new;
end;
$$;

drop trigger if exists trg_community_hot_flag on community_posts;
create trigger trg_community_hot_flag
before update on community_posts
for each row execute function refresh_community_hot_flag();
