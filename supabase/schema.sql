-- =============================================
-- 꿀정보 블로그 Supabase 스키마
-- =============================================
-- Supabase SQL Editor에서 실행

-- 1. 이메일 구독자
create table if not exists email_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  source      text default 'website',      -- 유입 경로 (website, footer, article 등)
  status      text default 'active',       -- active | unsubscribed
  resubscribed_at timestamptz,
  created_at  timestamptz default now()
);

create index if not exists idx_email_subscribers_email on email_subscribers(email);
create index if not exists idx_email_subscribers_status on email_subscribers(status);

-- RLS
alter table email_subscribers enable row level security;

-- 구독은 누구나 가능 (API route에서 service_role 사용)
create policy "subscribe_insert" on email_subscribers
  for insert with check (true);

-- 조회/수정은 service_role만
create policy "admin_all" on email_subscribers
  for all using (auth.role() = 'service_role');

-- 2. 포스트 (콘텐츠)
create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text,
  content      text,                       -- Markdown 본문
  category     text not null,
  tags         text[] default '{}',
  keywords     text[] default '{}',        -- SEO 타겟 키워드
  image_url    text,                       -- Gemini 생성 이미지
  author       text default '꿀정보 편집팀',
  status       text default 'draft',       -- draft | published | archived
  featured     boolean default false,
  view_count   integer default 0,
  read_time    integer,                    -- 분 단위
  published_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_posts_slug on posts(slug);
create index if not exists idx_posts_category on posts(category);
create index if not exists idx_posts_status on posts(status);
create index if not exists idx_posts_featured on posts(featured);
create index if not exists idx_posts_published_at on posts(published_at desc);

alter table posts enable row level security;

create policy "posts_public_read" on posts
  for select using (status = 'published');

create policy "posts_admin_all" on posts
  for all using (auth.role() = 'service_role');

-- 3. 카테고리 (동적 관리)
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  icon        text,
  sort_order  integer default 0,
  active      boolean default true,
  created_at  timestamptz default now()
);

alter table categories enable row level security;

create policy "categories_public_read" on categories
  for select using (active = true);

create policy "categories_admin_all" on categories
  for all using (auth.role() = 'service_role');

-- 초기 카테고리 데이터 (사용자 확정 전 placeholder)
insert into categories (slug, name, description, sort_order) values
  ('tech',       '테크/가전',   '스마트폰, 노트북, 가전제품 비교 리뷰',    1),
  ('finance',    '금융',        '신용카드, 적금, 보험 비교 분석',           2),
  ('beauty',     '뷰티/건강',   '화장품, 건강기능식품 솔직 리뷰',           3),
  ('home-living','생활/홈',     '생활용품, 인테리어, 주방용품 추천',        4),
  ('travel',     '여행',        '국내/해외 여행 가이드, 숙소 비교',         5)
on conflict (slug) do nothing;

-- 4. 어필리에이트 링크 트래킹
create table if not exists affiliate_clicks (
  id            uuid primary key default gen_random_uuid(),
  post_slug     text,
  affiliate_id  text not null,             -- 어필리에이트 프로그램 ID
  link_url      text,
  referrer      text,
  user_agent    text,
  created_at    timestamptz default now()
);

create index if not exists idx_affiliate_clicks_affiliate_id on affiliate_clicks(affiliate_id);
create index if not exists idx_affiliate_clicks_post_slug on affiliate_clicks(post_slug);
create index if not exists idx_affiliate_clicks_created_at on affiliate_clicks(created_at desc);

alter table affiliate_clicks enable row level security;

create policy "affiliate_clicks_insert" on affiliate_clicks
  for insert with check (true);

create policy "affiliate_clicks_admin_read" on affiliate_clicks
  for select using (auth.role() = 'service_role');

-- 5. 키워드 (검색량 캐시)
create table if not exists keyword_volumes (
  id            uuid primary key default gen_random_uuid(),
  keyword       text not null unique,
  pc_volume     integer default 0,
  mobile_volume integer default 0,
  total_volume  integer default 0,
  competition   text,                      -- low | medium | high
  opportunity   integer,                   -- 0~100 점수
  last_fetched  timestamptz default now(),
  created_at    timestamptz default now()
);

create index if not exists idx_keyword_volumes_keyword on keyword_volumes(keyword);
create index if not exists idx_keyword_volumes_total on keyword_volumes(total_volume desc);

alter table keyword_volumes enable row level security;

create policy "keyword_volumes_admin_all" on keyword_volumes
  for all using (auth.role() = 'service_role');

-- 6. 콘텐츠 인터링킹
create table if not exists post_relations (
  post_slug     text not null,
  related_slug  text not null,
  relation_type text default 'related',    -- related | series | category
  sort_order    integer default 0,
  primary key (post_slug, related_slug)
);

alter table post_relations enable row level security;

create policy "post_relations_public_read" on post_relations
  for select using (true);

create policy "post_relations_admin_all" on post_relations
  for all using (auth.role() = 'service_role');
