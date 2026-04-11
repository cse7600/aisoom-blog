# Claude Code 프로젝트 규정 — factnote.co.kr (blog-affiliate)

## 전역 규정 상속
→ `~/.claude/CLAUDE.md` (이모지 금지, anti-slop, GSD 워크플로우 등)

---

## 썸네일 디자인 시스템 (변경 금지 규정)

**기준 커밋**: `1d13937` (feat(ui): upgrade fallback thumbnail)

### 핵심 원칙
`image_url`이 없는 포스트에는 반드시 `PostThumbnailFallback` 컴포넌트를 사용한다.
빈 div, 회색 박스, 텍스트 단독 렌더는 절대 금지.

### 컴포넌트 위치
`src/components/content/PostThumbnailFallback.tsx`

### 폴백 썸네일 구조 (변경 시 전체 재설계 필요)
```
┌─────────────────────────────────────┐
│  [카테고리 그라데이션 배경]            │
│  ├ 도트 그리드 오버레이 (opacity 70%) │
│  ├ 우상단 블러 원 장식                │
│  └ 좌하단 블러 원 장식                │
│                                     │
│  [상단 행]                           │
│  ├ 좌: 카테고리 뱃지 (Sparkles + 명) │
│  └ 우: Lucide 아이콘 (52/72px)       │
│                                     │
│  [하단 행]                           │
│  ├ 제목 (2줄/3줄 clamp)              │
│  └ 읽기시간 · #첫키워드              │
└─────────────────────────────────────┘
```

### CSS 토큰 규칙
파일: `src/app/globals.css`

카테고리별 5개 토큰 세트 (light + dark 모두 필수):
```css
--thumb-{slug}-bg-from   /* 그라데이션 시작 */
--thumb-{slug}-bg-to     /* 그라데이션 끝 */
--thumb-{slug}-accent    /* 아이콘/강조 색 */
--thumb-{slug}-ink       /* 텍스트 색 */
--thumb-{slug}-pattern   /* 도트 색 (rgba, 낮은 opacity) */
```

**절대 금지**: 컴포넌트 내 색상 하드코딩 (`#...`, `rgb(...)` 직접 사용)

### 현재 등록된 카테고리 토큰
| slug | 테마 | 아이콘(기본) |
|------|------|------------|
| tech | 인디고 | Cpu |
| finance | 에메랄드 | Wallet |
| beauty | 로즈 | Heart |
| home-living | 앰버 | Home |
| travel | 스카이 | Plane |
| (default) | 슬레이트 | FileText |

### 콘텐츠 기반 아이콘 오버라이드 (KEYWORD_ICON_OVERRIDES)
제목/태그/키워드 텍스트를 스캔해서 카테고리 기본 아이콘보다 우선 적용:
| 패턴 | 아이콘 |
|------|--------|
| cctv/보안/카메라/감시/매장보안 | Camera |
| 법인/등기/설립/정관/법인세 | Building2 |
| 밀리의서재/전자책/독서/책/도서 | BookOpen |
| 식자재/외식업/식당/레스토랑/음식점/메뉴 | UtensilsCrossed |

### 신규 카테고리 추가 절차
1. `globals.css` — `:root`와 `.dark` 양쪽에 5개 토큰 추가
2. `PostThumbnailFallback.tsx` — `CATEGORY_STYLES` 객체에 항목 추가
3. 필요 시 `KEYWORD_ICON_OVERRIDES` 에 도메인 키워드 추가
4. `CategoryNavBar` — 별도 수정 불필요 (DB 카테고리 동적 렌더)

---

## 카테고리 네비게이션 규정

**기준 커밋**: `1cc3520` (feat(nav): add /posts all-posts page)

### CategoryNavBar 컴포넌트
`src/components/content/CategoryNavBar.tsx`

적용 범위 (세 곳 모두 동일 컴포넌트):
- `/` 홈페이지
- `/posts` 전체보기
- `/[category]` 카테고리 페이지

### 규칙
- "전체보기"는 항상 첫 번째 항목. href="/posts", LayoutGrid 아이콘.
- 각 항목 옆에 포스트 수 표시 (DB 실시간 쿼리).
- 현재 페이지 항목: `bg-primary text-white` 활성 스타일 + `aria-current="page"`.
- 새 최상위 라우트 추가 시 reserved slug 필터에 추가 (category/page.tsx `generateStaticParams`).

### DB 헬퍼
- `getPublishedPostCount()` — 전체 포스트 수
- `getPostCountsByCategory()` — 카테고리별 집계 (Record<string, number>)
위치: `src/lib/db.ts`

---

## 완전 자동화 콘텐츠 파이프라인

**기준 커밋**: Phase 9.5 (2026-04-12)

### 1-커맨드 실행
```bash
node scripts/content-loop.mjs
```
주제 발굴 → 본문 생성 → 발행까지 사람 개입 없이 end-to-end.

### 체인 구조
```
content-loop.mjs
  1. discover-topics.mjs      — Claude Sonnet 4-6로 주제 추출 + 키워드 검증 → topic-queue.json
  2. research-and-queue.mjs   — 미발행 편수 확인 → generate-content.mjs --from-queue --auto-release 호출
       └ generate-content.mjs — 어필리에이트 프롬프트 + few-shot 로드 → 마크다운 전체 생성
            └ release-post.mjs — Supabase posts INSERT + 이미지 업로드
  3. auto-publish.mjs         — DB 미발행 초안 백업 발행 루프
```

### LLM 모델
- **기본**: Claude Sonnet 4-6 (`claude-sonnet-4-6`)
- **폴백 체인**: gemini-flash-latest → 3-flash-preview → 2.5-flash-lite → 2.5-flash → 2.5-pro

### 어필리에이트 프롬프트 파일
위치: `content-input/prompts/{name}.md`
- 키퍼메이트, 법인설립지원센터, 밀리의서재, 차별화상회 (4개 전부 존재)
- 신규 어필리에이트 추가 시 `affiliates.json` 등록 + 프롬프트 파일 1개만 추가하면 코드 수정 불필요

### 체크포인트 파일
- `content-input/topic-queue.json` — 주제 큐 (pending/generated/published)
- `content-input/loop-log.json` — 루프 실행 이력 (최근 100회)
- `.content-loop.lock` — 중복 실행 방지 (1시간 TTL)

### 주요 CLI 옵션
```bash
# 전체 1회 실행
node scripts/content-loop.mjs

# 특정 어필리에이트만
node scripts/content-loop.mjs --affiliate 밀리의서재

# 상태만 확인
node scripts/content-loop.mjs --dry

# 발행 건너뛰기 (초안만)
node scripts/content-loop.mjs --skip-publish

# 강제 실행 (큐 잔여 무시)
node scripts/content-loop.mjs --force
```

### 변경 금지 사항
- `generate-content.mjs`와 `discover-topics.mjs`의 `CLAUDE_MODEL`은 항상 동일 버전 유지
- content-loop가 `stepRefill`에서 `--auto-release`를 자동 전달하는 로직(skip-publish 케이스 제외)
- 프롬프트 파일 frontmatter `---` 시작 규정 (없으면 생성 스크립트가 에러)

---

## 기술 스택 참조
- Next.js 14 App Router + TypeScript strict
- Tailwind CSS + CSS Variables (하드코딩 금지)
- lucide-react (아이콘 라이브러리)
- Supabase (DB + Storage)
- 폰트: Pretendard (CDN Variable)
