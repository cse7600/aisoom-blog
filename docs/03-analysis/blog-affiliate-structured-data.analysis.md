# JSON-LD 구조화 데이터 갭 분석

**분석일**: 2026-04-13
**Match Rate**: 85.3%
**기준**: Google Rich Results / schema.org 2026

## 스키마별 상태

| 스키마 | Match Rate | 상태 |
|---|:---:|:---:|
| BlogPosting | 95% | OK |
| DiscussionForumPosting (포스트) | 92% | OK |
| DiscussionForumPosting (커뮤니티) | 72% | WARN |
| FAQPage | 90% | OK |
| BreadcrumbList | 78% | WARN |
| Organization / WebSite | 85% | OK |

## 즉시 조치 항목 (우선순위 순)

### P1 — headline 110자 truncate (`src/lib/seo.ts:96`)
`buildArticleJsonLd`에서 `headline: input.title`을 그대로 사용.
Google은 110자 초과 시 절단 경고. `generatePostMetadata`는 자르지만 JSON-LD는 미적용.

```ts
// before
headline: input.title,
// after
headline: input.title.slice(0, 110),
```

### P2 — 커뮤니티 Comment `@id` 누락 (`src/components/community/DiscussionJsonLd.tsx:58-75`)
`buildCommentSchema`에 `@id`, `identifier`, `parentItem` 없음.
대댓글 트리에서 부모 참조 끊김. 포스트 버전 DiscussionJsonLd와 불일치.

### P3 — Breadcrumb "홈" 항목 부재 (`src/components/seo/Breadcrumb.tsx`)
UI는 홈 > 카테고리 > 포스트 3단이지만, JSON-LD는 카테고리 > 포스트 2단.
`buildBreadcrumbJsonLd` 호출 시 홈 항목이 prepend 안 됨.

## 개선 권장 항목

| 항목 | 파일 | 영향 |
|---|---|---|
| `image`를 `ImageObject`(1200×630)로 승격 | `seo.ts` | 리치 결과 자격률 향상 |
| DiscussionForumPosting에 `text` 필드 추가 | `discussion/DiscussionJsonLd.tsx` | 주제 맥락 파악 |
| `SITE_ORIGIN` 하드코딩 제거 → `SITE_CONFIG.url` | `community/DiscussionJsonLd.tsx` | 도메인 변경 리스크 |
| Organization `sameAs` SNS URL 추가 | `seo.ts` | Knowledge Panel 매칭 |
| 커뮤니티 상세 페이지 BreadcrumbList 추가 | `community/[id]/page.tsx` | 브레드크럼 리치 결과 |

## 완료 현황

- [x] DiscussionForumPosting author Organization → Person (커밋 78bb0a8)
- [x] CCTV 콘텐츠 3편 본문 H1 제거 (커밋 45f3f93)
- [ ] P1: headline 110자 truncate
- [ ] P2: 커뮤니티 Comment @id 추가
- [ ] P3: Breadcrumb 홈 항목 prepend
