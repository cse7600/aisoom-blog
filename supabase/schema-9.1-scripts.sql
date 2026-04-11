-- =============================================
-- Phase 9.1 자율 각본 스케줄링 스키마
-- =============================================
-- Supabase SQL Editor 또는 Management API로 실행
-- 의존: schema-discussions.sql (discussion_personas), schema-community.sql (community_posts/comments)

-- 1. community_scripts (각본 헤더)
create table if not exists community_scripts (
  id                  uuid primary key default gen_random_uuid(),
  script_code         text not null unique,
  category            text not null,
  title               text not null,
  body                text not null,
  author_persona_id   uuid not null references discussion_personas(id),
  target_keyword      text,
  thumb_variant       text default 'default',
  status              text default 'ready',
  planned_post_date   date,
  posted_post_id      uuid references community_posts(id) on delete set null,
  source              text default 'manual',
  tags                text[] default '{}',
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_scripts_status on community_scripts(status);
create index if not exists idx_scripts_planned_date on community_scripts(planned_post_date);
create index if not exists idx_scripts_persona on community_scripts(author_persona_id);
create index if not exists idx_scripts_code on community_scripts(script_code);

-- 2. community_script_comments (각본 댓글 세트)
create table if not exists community_script_comments (
  id                        uuid primary key default gen_random_uuid(),
  script_id                 uuid not null references community_scripts(id) on delete cascade,
  parent_script_comment_id  uuid references community_script_comments(id) on delete cascade,
  sequence                  integer not null,
  commenter_persona_id      uuid not null references discussion_personas(id),
  content                   text not null,
  delay_minutes             integer not null,
  sentiment                 text default 'neutral',
  status                    text default 'ready',
  posted_comment_id         uuid references community_comments(id) on delete set null,
  created_at                timestamptz default now()
);

create index if not exists idx_script_comments_script
  on community_script_comments(script_id, sequence);
create index if not exists idx_script_comments_parent
  on community_script_comments(parent_script_comment_id);
create index if not exists idx_script_comments_status
  on community_script_comments(status);

-- 3. community_script_cues (큐사인)
create table if not exists community_script_cues (
  id                  uuid primary key default gen_random_uuid(),
  script_id           uuid not null references community_scripts(id) on delete cascade,
  cue_type            text not null,
  script_comment_id   uuid references community_script_comments(id) on delete cascade,
  persona_id          uuid not null references discussion_personas(id),
  fire_at             timestamptz not null,
  status              text default 'queued',
  fired_at            timestamptz,
  error               text,
  attempt             integer default 0,
  created_at          timestamptz default now()
);

create index if not exists idx_cues_status_fire
  on community_script_cues(status, fire_at);
create index if not exists idx_cues_script on community_script_cues(script_id);
create index if not exists idx_cues_persona_fire
  on community_script_cues(persona_id, fire_at desc);

-- 4. RLS — service_role 만 접근 (public은 아예 읽기/쓰기 불가)
alter table community_scripts enable row level security;
alter table community_script_comments enable row level security;
alter table community_script_cues enable row level security;

drop policy if exists "scripts_service_only" on community_scripts;
create policy "scripts_service_only" on community_scripts
  for all using (auth.role() = 'service_role');

drop policy if exists "script_comments_service_only" on community_script_comments;
create policy "script_comments_service_only" on community_script_comments
  for all using (auth.role() = 'service_role');

drop policy if exists "script_cues_service_only" on community_script_cues;
create policy "script_cues_service_only" on community_script_cues
  for all using (auth.role() = 'service_role');

-- 5. updated_at 자동 갱신
create or replace function sync_script_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_script_updated_at on community_scripts;
create trigger trg_script_updated_at
before update on community_scripts
for each row execute function sync_script_updated_at();
