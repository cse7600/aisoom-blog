-- ============================================================
-- STEP 0: 사전 충돌 검사 (실행 후 결과가 0행이어야 안전)
-- ============================================================
-- 아래 쿼리 먼저 실행해서 0행 확인 후 STEP 1로 진행할 것:
/*
SELECT 'posts' AS tbl, slug, site_id FROM posts
 WHERE site_id = 'factnote'
   AND slug IN (
     'air-purifier-baby-room-top5',
     'carepod-air-cube-vs-lg-puricare',
     'carepod-vs-coway-humidifier',
     'carepod-x50v-review',
     'hospital-nursery-carepod-selection',
     'humidifier-bacteria-comparison',
     'humidifier-cleaning-guide',
     'humidifier-optimal-humidity',
     'humidifier-placement-guide',
     'ultrasonic-humidifier-bacteria-warning'
   )
UNION ALL
SELECT 'categories', slug, site_id FROM categories
 WHERE site_id = 'factnote'
   AND slug IN ('humidifier','air-purifier','baby-care','lifestyle');
*/

-- ============================================================
-- STEP 1: posts — (slug) 단독 unique → (site_id, slug) 복합 unique
-- ============================================================
-- 기존 제약 이름 확인 후 제거 (이름이 다를 경우 \d posts 로 확인)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_slug_key;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_slug_unique;

-- 복합 unique 추가
ALTER TABLE posts ADD CONSTRAINT posts_site_slug_unique UNIQUE (site_id, slug);

-- ============================================================
-- STEP 2: categories — (slug) 단독 unique → (site_id, slug) 복합 unique
-- ============================================================
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_unique;

ALTER TABLE categories ADD CONSTRAINT categories_site_slug_unique UNIQUE (site_id, slug);

-- ============================================================
-- STEP 3: post_relations — site_id 컬럼 추가
-- ============================================================
ALTER TABLE post_relations ADD COLUMN IF NOT EXISTS site_id TEXT NOT NULL DEFAULT 'factnote';

CREATE INDEX IF NOT EXISTS idx_post_relations_site_id ON post_relations(site_id, post_slug);
