-- Phase 9.5 커뮤니티 like_count, bookmark_count 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS like_count integer default 0 not null,
  ADD COLUMN IF NOT EXISTS bookmark_count integer default 0 not null;

CREATE INDEX IF NOT EXISTS idx_community_posts_like_count
  ON community_posts(like_count desc);
