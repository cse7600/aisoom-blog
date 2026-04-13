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

## SEO · AEO · GEO 콘텐츠 표준 (Phase 9.5)

**기준 문서**: `content-input/SEO-AEO-GEO-RULES.md`
**설계 문서**: `.planning/phase-9.5-seo-aeo-geo/DESIGN.md`
**기준일**: 2026-04-12

### 3종 엔진 통합 최적화
모든 콘텐츠 프롬프트(`content-input/prompts/*.md`)는 아래 3종 엔진 인용을 동시에 목표로 한다.

- **SEO** — Google, Naver 전통 검색 인덱스
- **AEO** — Perplexity, ChatGPT Search, Google AI Overview, Copilot 답변 엔진
- **GEO** — Claude, Gemini, GPT, Grok 생성형 AI 학습·인용

### 필수 구조 스켈레톤
```
[frontmatter + 공시]
## 목차
## H2 (글 제목과 동일 — 페이지 <h1>은 템플릿이 별도 렌더, 본문 H1 금지)
> 한 줄 답변: {수치 포함 핵심 답변 80자 이내}
[직접 답변 도입부 80~150자]
## H2 섹션 (4~6개, 40%+ 의문문, 1개는 Top N 리스트)
## 자주 묻는 질문 (H3 Q. 패턴, 5~7개, 답변 80~150자)
## 정리 — TL;DR + CTA
## 관련 글
## 출처 (공식 기관 3개+)
```

### 핵심 수치 규칙 (왜)
- **본문 2,500~4,000자** — GEO topical depth 기준 1,500단어 이상
- **첫 45단어(≈90자) 내 수치 답변** — AI Overview 인용 55%가 본문 상위 30%
- **의문문 H2 비율 40%+** — heading-query 매칭으로 passage extraction 대상
- **Top N 리스트 섹션 1개+** — AI 인용 74.2%가 Top N 구조
- **통계 밀도 300자당 3개+** — citation 2.1배
- **FAQ 5~7개, 답변 80~150자** — FAQPage JSON-LD citation +30%
- **`2026년 기준` 명시** — 90일 이내 미업데이트 시 citation 3배 손실
- **일인칭 경험 1회+** — Google 2026 March Core Update E-E-A-T 가중치

### FAQ 섹션 포맷 (FAQPage JSON-LD 자동 추출 조건)
현재 `src/lib/seo.ts::extractFaqFromHtml`가 다음 패턴을 파싱해 FAQPage 스키마를 자동 주입한다. 프롬프트는 반드시 이 포맷을 준수해야 한다.

```markdown
## 자주 묻는 질문    ← H2 제목에 "자주 묻는 질문" / "FAQ" / "Q&A" 중 하나 필수

### Q. 질문 텍스트    ← H3, Q. 접두
답변 본문 80~150자.   ← 바로 다음 단락

### Q. 다음 질문
...
```

벗어나면 `extractFaqFromHtml`이 2개 미만을 반환해 FAQPage JSON-LD가 주입되지 않고 citation 부스트를 놓친다.

### 인프라 매핑 (`src/lib/seo.ts`)
- `buildArticleJsonLd` — BlogPosting, 모든 포스트 자동 주입 (O)
- `buildFaqJsonLd` + `extractFaqFromHtml` — 2개 이상 FAQ 자동 주입 (O)
- `buildBreadcrumbJsonLd` — 카테고리 경로 (O)
- `buildOrganizationJsonLd` / `buildWebSiteJsonLd` — 전역 (O)
- `buildHowToJsonLd` — **정의만 존재, 포스트 페이지 연결 Phase 9.6 작업**

### 금지어 Tier 1 (절대 금지)
delve, tapestry, landscape, leverage, robust, seamless, streamline, empower, unlock, foster, testament, vibrant, pivotal, underscore, garner, intricate, showcase, enhance, crucial, cutting-edge

**한국어 슬롭**: "살펴보겠습니다", "알아보겠습니다", "마무리하겠습니다", "~라고 할 수 있습니다" 남발

### 변경 금지
- FAQ H2 제목에서 "자주 묻는 질문" / "FAQ" / "Q&A" 키워드 제거 금지 (JSON-LD 자동 추출 실패)
- FAQ H3에서 `### Q. ` 접두사 제거 금지
- 프롬프트 내 SEO/AEO/GEO 수치 규칙은 `SEO-AEO-GEO-RULES.md`와 동기화 유지

---

## 콘텐츠 발행 일정 규칙 (Batch → Distributed)

**기준 커밋**: Phase 9.6 완료 시점

### 핵심 원칙
배치로 다수 콘텐츠를 생성해도 Supabase `published_at`은 반드시 날짜 분산한다. 한 번에 여러 편을 같은 타임스탬프로 삽입하면 SEO 관점에서 부자연스럽고 `backdate-posts.mjs` 재실행 비용이 발생한다.

### 기본 패턴
- 주 2회 발행: **화요일, 금요일** (한국 블로그 표준 리듬)
- 시간대: 10:00~13:59 KST 사이 (시드 기반 랜덤)
- 생성과 발행 분리: 생성은 한 번에, 발행은 반드시 분산

### 배치 생성 + 분산 발행 워크플로우
```bash
# 1) 콘텐츠 N편 한 번에 생성 (auto-release 금지)
node scripts/research-and-queue.mjs --force --count 10 --affiliate 키퍼메이트

# 2) 각 파일을 지정 날짜로 개별 발행
node scripts/publish-post.mjs --publish-date 2026-04-15 키퍼메이트/content/slug-a.md
node scripts/publish-post.mjs --publish-date 2026-04-18 키퍼메이트/content/slug-b.md
...
```

### publish-post.mjs 플래그
| 플래그 | 효과 |
|---|---|
| `--publish-date YYYY-MM-DD` | `published_at` + `created_at` 강제 지정 (최우선) |
| frontmatter `date:` 필드 | fallback (CLI 미지정 시) |
| (둘 다 없음) | `new Date().toISOString()` — 단일 포스트 발행 시에만 허용 |
| `--seed N` | 시간 랜덤 시드 (기본 20260412) |

### 예약 발행(scheduled) 워크플로우
- 미래 날짜 포스트: `publish-post.mjs`가 자동으로 `status='scheduled'`로 저장
- 매일 1회 실행: `node scripts/auto-schedule.mjs`
- `published_at <= now()` 조건 충족 시 자동으로 `status='published'` 전환
- 수동 즉시 확인: `node scripts/auto-schedule.mjs --dry`
- 실행 이력: `content-input/schedule-log.json`

### 금지
- `research-and-queue.mjs --force --count N --auto-release` 배치 사용 (N개가 같은 시각에 몰림)
- `content-loop.mjs`로 하루 10편 이상 연속 생성 (주 2회 슬롯 초과)
- `backdate-posts.mjs` 의존 — 사후 재배치는 임시방편이며, 원칙은 발행 시점 제어

### 슬롯 계산
기존 마지막 published_at에서 시작해서 화(TUE)→금(FRI)→화→금 간격 3일/4일 교대로 미래 슬롯 배정. `backdate-posts.mjs:buildBackdateSlots`를 역방향 참조.

---

## 기술 스택 참조
- Next.js 14 App Router + TypeScript strict
- Tailwind CSS + CSS Variables (하드코딩 금지)
- lucide-react (아이콘 라이브러리)
- Supabase (DB + Storage)
- 폰트: Pretendard (CDN Variable)
