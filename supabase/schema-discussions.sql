-- =============================================
-- Phase 8.5 AI 커뮤니티 SEO 스키마
-- =============================================
-- Supabase SQL Editor에서 실행
-- 기존 schema.sql (posts 테이블)이 먼저 적용되어 있어야 함

-- 1. discussion_personas (페르소나 정의)
create table if not exists discussion_personas (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null unique,
  persona_type  text not null,          -- worker | student | parent | business | techie
  age_group     text not null,          -- 20s | 30s | 40s | 50s
  occupation    text,
  interests     text[] default '{}',
  tone_keywords text[] default '{}',
  sample_phrases text[] default '{}',
  emoji_level   text default 'low',     -- none | low | medium | high
  typo_rate     text default 'low',     -- none | low | medium
  sentiment_bias text default 'neutral', -- positive | neutral | critical
  active        boolean default true,
  post_count    integer default 0,
  created_at    timestamptz default now()
);

create index if not exists idx_personas_active on discussion_personas(active);
create index if not exists idx_personas_type on discussion_personas(persona_type);

alter table discussion_personas enable row level security;

drop policy if exists "personas_public_read" on discussion_personas;
create policy "personas_public_read" on discussion_personas
  for select using (active = true);

drop policy if exists "personas_admin_all" on discussion_personas;
create policy "personas_admin_all" on discussion_personas
  for all using (auth.role() = 'service_role');

-- 2. post_discussions (메인 댓글)
create table if not exists post_discussions (
  id            uuid primary key default gen_random_uuid(),
  post_slug     text not null references posts(slug) on delete cascade,
  persona_id    uuid not null references discussion_personas(id),
  content       text not null,
  sentiment     text default 'neutral',
  upvotes       integer default 0,
  is_question   boolean default false,
  target_keyword text,
  generation_batch text,
  scheduled_at  timestamptz,
  published     boolean default true,
  created_at    timestamptz default now()
);

create index if not exists idx_discussions_post_slug on post_discussions(post_slug);
create index if not exists idx_discussions_persona on post_discussions(persona_id);
create index if not exists idx_discussions_created on post_discussions(created_at desc);
create index if not exists idx_discussions_published on post_discussions(published);

alter table post_discussions enable row level security;

drop policy if exists "discussions_public_read" on post_discussions;
create policy "discussions_public_read" on post_discussions
  for select using (published = true);

drop policy if exists "discussions_admin_all" on post_discussions;
create policy "discussions_admin_all" on post_discussions
  for all using (auth.role() = 'service_role');

-- 3. discussion_replies (대댓글)
create table if not exists discussion_replies (
  id              uuid primary key default gen_random_uuid(),
  discussion_id   uuid not null references post_discussions(id) on delete cascade,
  persona_id      uuid not null references discussion_personas(id),
  content         text not null,
  sentiment       text default 'neutral',
  upvotes         integer default 0,
  target_keyword  text,
  generation_batch text,
  published       boolean default true,
  created_at      timestamptz default now()
);

create index if not exists idx_replies_discussion on discussion_replies(discussion_id);
create index if not exists idx_replies_persona on discussion_replies(persona_id);
create index if not exists idx_replies_created on discussion_replies(created_at desc);

alter table discussion_replies enable row level security;

drop policy if exists "replies_public_read" on discussion_replies;
create policy "replies_public_read" on discussion_replies
  for select using (published = true);

drop policy if exists "replies_admin_all" on discussion_replies;
create policy "replies_admin_all" on discussion_replies
  for all using (auth.role() = 'service_role');

-- 4. discussion_generation_log (생성 이력)
create table if not exists discussion_generation_log (
  id              uuid primary key default gen_random_uuid(),
  batch_id        text not null unique,
  post_slug       text not null,
  persona_ids     uuid[] default '{}',
  comments_count  integer default 0,
  replies_count   integer default 0,
  keywords_used   text[] default '{}',
  model_used      text default 'gemini-2.0-flash',
  prompt_version  text,
  status          text default 'pending',  -- pending | completed | failed
  error_message   text,
  created_at      timestamptz default now(),
  completed_at    timestamptz
);

create index if not exists idx_gen_log_post on discussion_generation_log(post_slug);
create index if not exists idx_gen_log_status on discussion_generation_log(status);
create index if not exists idx_gen_log_created on discussion_generation_log(created_at desc);

alter table discussion_generation_log enable row level security;

drop policy if exists "gen_log_admin_all" on discussion_generation_log;
create policy "gen_log_admin_all" on discussion_generation_log
  for all using (auth.role() = 'service_role');
