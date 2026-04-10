-- =============================================
-- Phase 8.6 AI 커뮤니티 SEO 고도화 마이그레이션
-- =============================================
-- 전제: schema-discussions.sql (Phase 8.5) 적용 완료
-- 실행: Supabase SQL Editor에서 한 번만 실행 (idempotent)

-- 1. discussion_personas 확장 -----------------------------------------------
alter table discussion_personas
  add column if not exists authority_level text not null default 'mid'
    check (authority_level in ('low', 'mid', 'high', 'expert'));

alter table discussion_personas
  add column if not exists signature_patterns jsonb not null default '{}'::jsonb;

alter table discussion_personas
  add column if not exists bio text;

alter table discussion_personas
  add column if not exists expertise_domains text[] not null default array[]::text[];

alter table discussion_personas
  add column if not exists quality_weights jsonb not null default
    '{"quick": 0.25, "casual": 0.35, "normal": 0.20, "detailed": 0.15, "expert": 0.05}'::jsonb;

alter table discussion_personas
  add column if not exists active_hours int[] not null default
    array[9, 10, 11, 12, 13, 18, 19, 20, 21]::int[];

alter table discussion_personas
  add column if not exists active_weekdays int[] not null default
    array[1, 2, 3, 4, 5]::int[];

create index if not exists idx_personas_expertise
  on discussion_personas using gin (expertise_domains);

create index if not exists idx_personas_authority
  on discussion_personas (authority_level);

-- 2. persona_history --------------------------------------------------------
create table if not exists persona_history (
  id               uuid primary key default gen_random_uuid(),
  persona_id       uuid not null references discussion_personas(id) on delete cascade,
  discussion_id    uuid not null,
  post_slug        text not null,
  content_summary  text not null,
  stance           text,
  topics           text[] not null default array[]::text[],
  created_at       timestamptz not null default now()
);

create index if not exists idx_persona_history_persona
  on persona_history (persona_id, created_at desc);

create index if not exists idx_persona_history_topics
  on persona_history using gin (topics);

create index if not exists idx_persona_history_post
  on persona_history (post_slug);

alter table persona_history enable row level security;

drop policy if exists "persona_history_public_read" on persona_history;
create policy "persona_history_public_read" on persona_history
  for select using (true);

drop policy if exists "persona_history_admin_all" on persona_history;
create policy "persona_history_admin_all" on persona_history
  for all using (auth.role() = 'service_role');

-- 3. persona_relationships --------------------------------------------------
create table if not exists persona_relationships (
  id             uuid primary key default gen_random_uuid(),
  persona_a_id   uuid not null references discussion_personas(id) on delete cascade,
  persona_b_id   uuid not null references discussion_personas(id) on delete cascade,
  relation_type  text not null check (relation_type in ('agree_often', 'disagree_often', 'neutral', 'mentor')),
  strength       numeric(3, 2) not null default 0.50,
  created_at     timestamptz not null default now(),
  unique (persona_a_id, persona_b_id)
);

create index if not exists idx_persona_relationships_a
  on persona_relationships (persona_a_id);

create index if not exists idx_persona_relationships_b
  on persona_relationships (persona_b_id);

alter table persona_relationships enable row level security;

drop policy if exists "persona_relationships_admin_all" on persona_relationships;
create policy "persona_relationships_admin_all" on persona_relationships
  for all using (auth.role() = 'service_role');

-- 4. post_longtail_targets --------------------------------------------------
create table if not exists post_longtail_targets (
  id                   uuid primary key default gen_random_uuid(),
  post_slug            text not null references posts(slug) on delete cascade,
  longtail_keyword     text not null,
  target_question      text not null,
  assigned_persona_id  uuid references discussion_personas(id) on delete set null,
  consumed             boolean not null default false,
  created_at           timestamptz not null default now()
);

create index if not exists idx_longtail_post
  on post_longtail_targets (post_slug);

create index if not exists idx_longtail_consumed
  on post_longtail_targets (consumed);

alter table post_longtail_targets enable row level security;

drop policy if exists "longtail_admin_all" on post_longtail_targets;
create policy "longtail_admin_all" on post_longtail_targets
  for all using (auth.role() = 'service_role');

-- 5. post_discussions 확장 ---------------------------------------------------
alter table post_discussions
  add column if not exists thread_template text not null default 'expert_qa'
    check (thread_template in ('expert_qa', 'experience_share', 'quick_opinion', 'deep_debate', 'bootstrap_silent'));

alter table post_discussions
  add column if not exists scheduled_generation_at timestamptz;

alter table post_discussions
  add column if not exists generation_phase text not null default 'pending'
    check (generation_phase in ('pending', 'bootstrap', 'growing', 'mature'));

alter table post_discussions
  add column if not exists longtail_target text;

create index if not exists idx_discussions_template
  on post_discussions (thread_template);

create index if not exists idx_discussions_phase
  on post_discussions (generation_phase);

create index if not exists idx_discussions_scheduled
  on post_discussions (scheduled_generation_at);

-- 6. discussion_replies 확장 ------------------------------------------------
alter table discussion_replies
  add column if not exists quality_tier text not null default 'casual'
    check (quality_tier in ('quick', 'casual', 'normal', 'detailed', 'expert'));

alter table discussion_replies
  add column if not exists char_count int not null default 0;

alter table discussion_replies
  add column if not exists response_model text
    check (response_model in ('immediate', 'contemplated', 'revisit'));

create index if not exists idx_replies_quality
  on discussion_replies (quality_tier);

-- 7. post_discussions 에도 quality_tier/char_count (댓글 품질 분포 추적용) ---
alter table post_discussions
  add column if not exists quality_tier text not null default 'casual'
    check (quality_tier in ('quick', 'casual', 'normal', 'detailed', 'expert'));

alter table post_discussions
  add column if not exists char_count int not null default 0;

create index if not exists idx_discussions_quality
  on post_discussions (quality_tier);
