-- posts 테이블에 site_id 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS site_id TEXT NOT NULL DEFAULT 'factnote';

-- 기존 factnote 포스트는 이미 'factnote'로 설정됨 (DEFAULT 값)
-- 케어팟 포스트 INSERT 시 site_id = 'carepod' 명시 필요

-- categories 테이블에도 site_id 추가
ALTER TABLE categories ADD COLUMN IF NOT EXISTS site_id TEXT NOT NULL DEFAULT 'factnote';

-- 인덱스 추가 (성능)
CREATE INDEX IF NOT EXISTS idx_posts_site_id ON posts(site_id);
CREATE INDEX IF NOT EXISTS idx_posts_site_status ON posts(site_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_site_id ON categories(site_id);

-- 케어팟 카테고리 INSERT 시 참고용 예시 (실제 실행 전 확인 필요)
-- INSERT INTO categories (slug, name, description, icon, sort_order, active, site_id) VALUES
-- ('humidifier', '가습기', '저온가열·초음파·가열식 방식 비교, 위생 가이드', 'Droplets', 1, true, 'carepod'),
-- ('air-purifier', '공기청정기', 'HEPA 필터, CADR, 소음 수치 기반 비교 리뷰', 'Wind', 2, true, 'carepod'),
-- ('baby-care', '육아공간', '신생아·영유아 방 공기 환경 세팅 가이드', 'Baby', 3, true, 'carepod'),
-- ('lifestyle', '라이프스타일', '실내 공기질, 위생 관리 생활 정보', 'Home', 4, true, 'carepod');
