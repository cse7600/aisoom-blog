# Changelog

All notable changes to the blog-affiliate project are documented here.

## [8.6] - 2026-04-10

### Phase 8.6: AI 커뮤니티 SEO 고도화 (완료)

**Match Rate**: 97.1% (iterate 2회)

### Added

- **Core Engines**:
  - `src/lib/discussion-templates.ts` — 5종 쓰레드 템플릿 (questioner, answerer, critic, synthesizer, outlier)
  - `src/lib/discussion-quality.ts` — 품질 5티어 + 글자수 검증
  - `src/lib/temporal-engine.ts` — Poisson 기반 응답 간격 + KST 시간대 가중치
  - `src/lib/bootstrap-protocol.ts` — post_age별 동적 상한선 + 200/day 하드캡
  - `src/lib/seo-health.ts` — 4개 지표 모니터링 (URL속도/표준편차/페르소나집중도/템플릿분포)

- **B2B 페르소나**:
  - `supabase/seed-personas-v2.sql` — 30명 B2B 페르소나 (CCTV보안 8 + 법인설립 7 + 기존 10 + 신규 5)
  - personas 테이블 7컬럼 확장 (authority_style, signature_patterns 등)

- **SEO 레이어**:
  - `src/components/discussion/DiscussionJsonLd.tsx` — DiscussionForumPosting JSON-LD (Fragment ID 전략)
  - `src/app/(main)/community/users/[nickname]/page.tsx` — 페르소나 프로필 페이지
  - `src/app/(main)/community/users/[nickname]/profile-jsonld.tsx` — Person + ProfilePage JSON-LD
  - `src/app/sitemap-community.xml/` — 커뮤니티 게시글 sitemap
  - `src/app/sitemap-profiles.xml/` — 페르소나 프로필 sitemap

- **운영 자동화**:
  - `src/app/admin/seo-health/page.tsx` — 관리자 SEO 헬스 대시보드 (noindex)
  - `src/app/api/cron/seo-health/route.ts` — 일일 크론 모니터링 (CRON_SECRET 인증)
  - `scripts/monitor-seo-health.mjs` — CLI 모니터링 스크립트
  - `vercel.json` — Cron 스케줄 등록 (KST 0시 = 9시)

- **데이터베이스**:
  - `supabase/schema-8.6-migration.sql` — persona_history, persona_relationships, post_longtail_targets 테이블 생성
  - 모든 테이블 인덱스 + RLS 정책 적용

### Changed

- `src/lib/discussion-generator.ts` — persona_history 프롬프트 주입 추가
- `src/lib/discussion-db.ts` — getTodayUrlCount() 함수 추가 (하드캡 체크)
- `src/app/robots.ts` — 3개 sitemap 등록

### Fixed

- `src/lib/temporal-engine.ts` — earliestCommentTime 변수명 정확화 (delayHours → delayMs)
- `src/lib/discussion-generator.ts` — runTopLevelSlot, runReplySlot 함수 길이 초과 수정 (39줄 → 22/28줄)
- `src/lib/discussion-generator.ts` — post_longtail_targets 소비 로직 구현
- `src/lib/discussion-generator.ts` — burst 사이클 적용 (resolveBurstPlan)
- Removed all `console.log` from production code

### Deferred to Phase 8.7+

- 실유저 인센티브 (업보트/2시간 지연/이벤트) — UX 추가 필요
- Search Console API 색인률 지표 — 3개월 데이터 축적 필요
- 단위 테스트 (Poisson/품질/bootstrap) — 운영 데이터 검증 후
- persona_relationships 활용 (deep_debate) — 구조 완성, 로직 Phase 9

### Phase 8.7: 어필리에이트별 페르소나 확장

**동 세션 완료** (2026-04-10):
- 밀리의서재 7명 추가 (총 45명)
- 차별화상회 8명 추가
- apply-persona-seeds.mjs 자동화 스크립트

---

## [8.5] - 2026-04-05

### Phase 8.5: Layout Optimization & FloatingShareBar

### Added

- `src/components/content/FloatingShareBar.tsx` — 포스트 우측 부동 공유 바
- `src/app/(main)/[category]/[slug]/page.tsx` — 개선된 레이아웃 (2단계 메타)

### Changed

- Header component SEO metadata 강화

---

## [8.0] - 2026-03-20

### Phase 8.0: Community Foundation

### Added

- `src/app/(main)/community/` — 커뮤니티 영역 기초 구축
- `src/lib/discussion-db.ts` — Discussion CRUD 함수
- `src/lib/discussion-generator.ts` — AI 토론 생성 엔진

---

## Naming Convention

- `[X.Y]` — Phase 번호 (8.6 = Phase 8, Cycle 6)
- **Added** — 신규 파일/기능
- **Changed** — 기존 파일 수정
- **Fixed** — 버그 수정 및 리팩토링
- **Deferred** — 다음 Phase로 연기
