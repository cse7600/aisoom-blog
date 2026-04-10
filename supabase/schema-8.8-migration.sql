-- =============================================
-- Phase 8.8 커뮤니티 오케스트레이션 고도화
-- =============================================
-- 전제: schema-8.6-migration.sql 적용 완료
-- 실행: Supabase SQL Editor에서 한 번만 실행 (idempotent)

-- 1. discussion_personas.behavior_type 컬럼 추가 -----------------------------
alter table discussion_personas
  add column if not exists behavior_type text not null default 'normal'
    check (behavior_type in ('normal', 'chatty', 'lurker', 'lol_reactor'));

create index if not exists idx_personas_behavior_type
  on discussion_personas (behavior_type);

-- 2. post_discussions.thread_template CHECK 제약 확장 ------------------------
-- 기존 CHECK에 'casual_chatter' 추가
alter table post_discussions
  drop constraint if exists post_discussions_thread_template_check;

alter table post_discussions
  add constraint post_discussions_thread_template_check
  check (thread_template in (
    'expert_qa',
    'experience_share',
    'quick_opinion',
    'deep_debate',
    'bootstrap_silent',
    'casual_chatter'
  ));

-- 3. post_discussions.slot_role (선택적, 각본 내 역할 추적용) ----------------
alter table post_discussions
  add column if not exists slot_role text;

alter table discussion_replies
  add column if not exists slot_role text;

-- 4. 오케스트레이터 각본 로그 (디버깅/분석용) -------------------------------
create table if not exists discussion_scripts (
  id               uuid primary key default gen_random_uuid(),
  batch_id         text not null unique,
  post_slug        text not null,
  template_id      text not null,
  script_json      jsonb not null,
  persona_ids      uuid[] not null default array[]::uuid[],
  total_items      int not null default 0,
  persisted_items  int not null default 0,
  model_used       text not null default 'gemini-2.0-flash',
  prompt_version   text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_discussion_scripts_post
  on discussion_scripts (post_slug, created_at desc);

create index if not exists idx_discussion_scripts_template
  on discussion_scripts (template_id);

alter table discussion_scripts enable row level security;

drop policy if exists "discussion_scripts_admin_all" on discussion_scripts;
create policy "discussion_scripts_admin_all" on discussion_scripts
  for all using (auth.role() = 'service_role');

-- 5. reply_type CHECK 확장 (lol / digress 추가) ------------------------------
-- discussion_replies 에 reply_type 컬럼이 있을 수도/없을 수도 있으므로 조건부
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'discussion_replies'
      and column_name = 'reply_type'
  ) then
    alter table discussion_replies
      drop constraint if exists discussion_replies_reply_type_check;
    alter table discussion_replies
      add constraint discussion_replies_reply_type_check
      check (reply_type in ('agree', 'disagree', 'question', 'supplement', 'lol', 'digress'));
  end if;
end $$;
