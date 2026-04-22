-- ============================================================
-- STEP 1: site_id 컬럼 추가 (이미 실행했으면 IF NOT EXISTS가 무시함)
-- ============================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS site_id TEXT NOT NULL DEFAULT 'factnote';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS site_id TEXT NOT NULL DEFAULT 'factnote';

CREATE INDEX IF NOT EXISTS idx_posts_site_id ON posts(site_id);
CREATE INDEX IF NOT EXISTS idx_posts_site_status ON posts(site_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_site_id ON categories(site_id);

-- ============================================================
-- STEP 2: 케어팟 categories INSERT (4종)
-- ============================================================
INSERT INTO categories (slug, name, description, icon, sort_order, active, site_id) VALUES
('humidifier', '가습기', '저온가열·초음파·가열식 방식 비교, 위생 가이드', 'Droplets', 1, true, 'carepod'),
('air-purifier', '공기청정기', 'HEPA 필터, CADR, 소음 수치 기반 비교 리뷰', 'Wind', 2, true, 'carepod'),
('baby-care', '육아공간', '신생아·영유아 방 공기 환경 세팅 가이드', 'Baby', 3, true, 'carepod'),
('lifestyle', '라이프스타일', '실내 공기질, 위생 관리 생활 정보', 'Home', 4, true, 'carepod')
ON CONFLICT (site_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

-- ============================================================
-- STEP 3: 케어팟 posts INSERT (10편)
-- ============================================================
INSERT INTO posts (slug, title, description, content, category, tags, keywords, image_url, author, status, featured, view_count, read_time, published_at, site_id) VALUES
('air-purifier-baby-room-top5', '【2026년】공기청정기 추천 — 아이방 10평 이하 소형 컴팩트 TOP 5', '아이방 공기청정기, CADR·소음·필터 기준으로 2026년 소형 컴팩트 TOP 5 비교. 케어팟 Air Cube One(CADR 270m³/h, 24dB) 포함 실사용 중심 정리.', NULL, 'air-purifier', ARRAY['공기청정기 추천','아이방 공기청정기','소형 공기청정기','HEPA13','케어팟 Air Cube One','10평 공기청정기','공기청정기 소음'], ARRAY['아이방 공기청정기 추천'], NULL, '케어팟 라이프', 'published', true, 0, 5, '2026-04-21T14:20:00+09:00', 'carepod'),
('carepod-air-cube-vs-lg-puricare', '【비교】케어팟 Air Cube One vs LG 퓨리케어 미니 — 아이방용 공기청정기 비교', '케어팟 Air Cube One(CADR 270m³/h, 24dB, HEPA13)과 LG 퓨리케어 미니를 스펙·필터·소음·3년 TCO 기준으로 비교. 아이방에 맞는 제품 선택 가이드.', NULL, 'air-purifier', ARRAY['케어팟 Air Cube One','LG 퓨리케어 미니','공기청정기 비교','아이방 공기청정기','HEPA13','공기청정기 소음','공기청정기 추천'], ARRAY['케어팟 공기청정기 비교'], NULL, '케어팟 라이프', 'published', false, 0, 5, '2026-04-22T10:00:00+09:00', 'carepod'),
('carepod-vs-coway-humidifier', '【비교】케어팟 vs 코웨이 가습기 — 2026년 스펙·가격·3년 TCO 비교', '케어팟 X50V와 코웨이 HCW-H1500L/WH-H1500D 대표 모델을 가격·살균·3년 총비용 기준으로 비교. 렌탈 3년 vs 일시불 3년 TCO 표와 케이스별 선택 가이드를 수치로 정리. 2026년 기준.', NULL, 'humidifier', ARRAY['케어팟 vs 코웨이','가습기 비교 추천','코웨이 가습기','케어팟 X50V','가습기 브랜드 비교 2026'], ARRAY['케어팟 코웨이 가습기 비교'], NULL, '케어팟 라이프', 'published', false, 0, 5, '2026-04-19T11:30:00+09:00', 'carepod'),
('carepod-x50v-review', '【후기】케어팟 X50V 1년 사용 후기 — 아이 둘 키우는 엄마의 실사용 리뷰', '케어팟 X50V를 1년 실사용한 후기. 습도 40→50% 도달 1시간, 월 전기료 4~6천 원, 세척 주기 주 1회. 초음파 3대 대비 6개월 TCO 비교표까지 수치로 정리. 2026년 기준.', NULL, 'humidifier', ARRAY['케어팟 X50V','케어팟 후기','가습기 추천 아이 있는 집','저온가열 가습기 후기','케어팟 실사용 리뷰'], ARRAY['케어팟 X50V 후기'], NULL, '케어팟 라이프', 'published', false, 0, 5, '2026-04-17T11:15:00+09:00', 'carepod'),
('hospital-nursery-carepod-selection', '【후기】산후조리원에서 케어팟 쓰는 이유 — 병원·의료기관 선택 기준 분석', '산후조리원·병원이 케어팟 X50V를 선택하는 이유를 질병관리청 의료관련감염 관리지침 기준으로 분석. 누적 100만 대, 해외 매체 선정, 국제 디자인 어워드 수상 배경까지.', NULL, 'baby-care', ARRAY['산후조리원 가습기','케어팟 X50V','병원 가습기','신생아 가습기','저온가열 가습기','가습기 살균','영유아 가습기 추천'], ARRAY['산후조리원 가습기 추천'], NULL, '케어팟 라이프', 'published', false, 0, 5, '2026-04-22T15:30:00+09:00', 'carepod'),
('humidifier-bacteria-comparison', '【비교】가습기 방식별 세균 실험 — 초음파 vs 가열식 vs 저온가열 수치 비교', '초음파·고온 가열·저온가열 가습기 3가지 방식을 살균력·전기료·세척 편의로 수치 비교. 국립환경과학원 부유세균 기준 800 CFU/m³, WHO 레지오넬라 60°C 2분 사멸 근거까지 정리. 2026년 기준.', NULL, 'humidifier', ARRAY['가습기 세균','초음파 가습기 위험','가습기 방식 비교','저온가열 가습기','케어팟 X50V','아이 가습기 추천'], ARRAY['가습기 세균 비교'], NULL, '케어팟 라이프', 'published', false, 0, 5, '2026-04-15T10:42:00+09:00', 'carepod'),
('humidifier-cleaning-guide', '【Q&A】가습기 청소 얼마나 자주 해야 할까? 방식별 권장 주기와 방법', '초음파·가열·저온가열·복합식 가습기 방식별 청소 주기와 구연산 사용법까지. 2026년 기준 식약처 권고와 실사용 기준으로 정리했습니다.', NULL, 'humidifier', ARRAY['가습기 청소','가습기 청소 주기','초음파 가습기 청소','구연산 청소','케어팟 X50V','저온가열 가습기','가습기 위생'], ARRAY['가습기 청소 주기'], NULL, '케어팟 라이프', 'published', false, 0, 5, '2026-04-22T13:00:00+09:00', 'carepod'),
('humidifier-optimal-humidity', '【계산법】가습기 적정 습도는 몇 %? 아이 있는 집 권장 수치와 설정법', 'WHO 권장 실내 습도 40~60% RH 근거와 아이 있는 집 50~60% 기준 설명. 계절·공간·연령별 목표 수치, 저습도·고습도 건강 영향과 설정법을 수치로 정리. 2026년 기준.', NULL, 'humidifier', ARRAY['가습기 적정 습도','실내 습도 기준','아이 방 습도','겨울 습도 관리','습도계 추천'], ARRAY['가습기 적정 습도'], NULL, '케어팟 라이프', 'published', false, 0, 5, '2026-04-20T10:55:00+09:00', 'carepod'),
('humidifier-placement-guide', '【Q&A】아이방 가습기 어디 두면 효과적일까? 위치별 습도 실측 데이터', '가습기를 방 중앙·창문·침대 옆·문 근처에 배치한 2시간 후 습도 차이 실측. 바닥·60cm·100cm 높이별, 에어컨·히터 간섭까지 방식별 최적 배치를 수치로 정리. 2026년 기준.', NULL, 'humidifier', ARRAY['가습기 위치','아이방 가습기 위치','가습기 어디 두나','가습기 높이','가습기 효과 위치'], ARRAY['아이방 가습기 위치'], NULL, '케어팟 라이프', 'published', false, 0, 5, '2026-04-18T10:08:00+09:00', 'carepod'),
('ultrasonic-humidifier-bacteria-warning', '【주의】초음파 가습기 세균 번식 — 소아과 전문의 권고 기준 3가지', '초음파 가습기, 정말 괜찮을까요? 24~48시간 내 세균 폭발적 증가, 레지오넬라균 위험, 소아과 전문의 권고 기준까지 2026년 실증 자료로 정리했습니다.', NULL, 'humidifier', ARRAY['초음파 가습기','세균','가습기 안전','아이방 가습기','레지오넬라균','저온가열 가습기','케어팟'], ARRAY['초음파 가습기 세균'], NULL, '케어팟 라이프', 'published', false, 0, 5, '2026-04-21T09:15:00+09:00', 'carepod')
ON CONFLICT (site_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  keywords = EXCLUDED.keywords,
  status = EXCLUDED.status,
  featured = EXCLUDED.featured,
  read_time = EXCLUDED.read_time,
  published_at = EXCLUDED.published_at,
  updated_at = NOW();
