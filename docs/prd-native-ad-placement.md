# PRD — 네이티브 광고 포스트 페이지 배치

기준일: 2026-04-15
작성자: Product Owner (오케스트레이터)
상태: 승인 (사용자 확정 규칙 반영)
관련 파일:
- `src/components/content/NativeAdCard.tsx` (기존)
- `src/components/content/ContentWithAds.tsx` (신규)
- `src/app/(main)/[category]/[slug]/page.tsx` (수정)
- `src/app/(main)/preview/native-ads/page.tsx` (프리뷰, 변경 없음)

---

## 1. 배경 및 문제 정의

factnote.co.kr은 현재 포스트 페이지 본문에 네이티브 광고가 삽입되지 않은 상태다. `/preview/native-ads`에 디자인/카피 프리뷰만 존재하며 실제 포스트 페이지(`/[category]/[slug]`)는 `dangerouslySetInnerHTML`로 본문을 단일 청크 렌더링한다.

### 문제
- 어필리에이트 수익 기회 누락 (트래픽 유입 대비 전환 채널 없음)
- 본문과 광고를 분리 구성하려 하면 SEO 리스크 (스니펫 오염, 링크 주스 유출) 발생 가능
- 모바일에서 사이드바를 강제로 표시하면 스크롤 경험 파괴

### 비즈니스 가치
- 월 방문자 N명 기준 인콘텐츠 네이티브 광고 CTR 0.8~1.5% 기대 (업계 평균)
- 독자 거부감 0을 유지하면서 수익화 채널 확보
- SEO 신호 손상 없이 도입 가능 (검증된 표준 마크업 활용)

---

## 2. 사용자 스토리

### US-1. 모바일 독자
> 나는 스마트폰으로 factnote 글을 읽는 독자로서, 본문 흐름을 끊지 않는 광고만 보고 싶다. 사이드바 광고나 팝업은 보고 싶지 않다.

수용 기준:
- 모바일(뷰포트 < 1024px)에서 사이드바 광고는 렌더되지 않는다 (`hidden lg:block`)
- 인콘텐츠 광고는 H2 섹션 경계에 자연스럽게 삽입되어 본문 흐름을 끊지 않는다
- 광고 카드 터치 타겟 최소 48px (기존 NativeAdCard 규정 유지)

### US-2. 데스크탑 독자
> 나는 PC로 읽는 독자로서, 본문을 방해하지 않는 선에서 관련 상품/서비스 제안을 사이드바에서 확인할 수 있다.

수용 기준:
- 데스크탑(`lg` 이상)에서 ArticleTableOfContents 아래에 광고 카드 1~2개가 sticky로 따라온다
- 광고는 본문 article 영역 밖(`<aside>`)에 배치되어 시맨틱상 보조 콘텐츠로 구분된다

### US-3. SEO 매니저
> 나는 SEO 관리자로서, 광고 텍스트가 구글 스니펫·AI Overview에 인용되지 않아야 하고 어필리에이트 링크가 본문 권위를 훔치지 않아야 한다.

수용 기준:
- 모든 광고 블록에 `data-nosnippet` 속성 적용
- 모든 어필리에이트 링크에 `rel="nofollow sponsored"` 적용
- 광고는 `<aside>` 태그로 감싸 article 본문과 의미론적으로 분리
- FAQPage JSON-LD 자동 추출이 광고 삽입으로 깨지지 않음 (extractFaqFromHtml 정상 동작)

### US-4. 광고주 (어필리에이트 파트너)
> 나는 어필리에이트 파트너로서, 콘텐츠 주제와 무관한 광고가 노출되지 않도록 자동 매칭을 원한다.

수용 기준:
- category 또는 태그에 법인/세금/창업 키워드 → corp 계열 variant
- 태그/제목에 cctv/보안/매장 키워드 → cctv 계열 variant
- 매칭 실패 시 category 기반 기본값 사용 (finance → corp, 그 외 → 교차)

---

## 3. 기능 요구사항

### 3.1 인콘텐츠 광고 (모든 디바이스)

#### 배치 위치
H2 섹션 개수에 따라 동적으로 결정한다.

| H2 개수 | 광고 개수 | 삽입 위치 |
|---|---|---|
| 0~1개 | 0 | 본문이 너무 짧거나 구조가 없어 광고 생략 |
| 2~3개 | 2 | 본문 33%, 66% 지점 (바이트 길이 기준) |
| 4~5개 | 2 | 2번째 H2 종료 직후, 4번째 H2 종료 직후 |
| 6개 이상 | 3 | 2번째 H2 직후, 4번째 H2 직후, 마지막 H2(FAQ 추정) 직전 |

#### 시맨틱 마크업
```html
<aside data-nosnippet aria-label="추천" class="...">
  <!-- NativeAdCard inline -->
</aside>
```

- `<aside>`: 본문과 의미론적으로 분리된 보조 콘텐츠 (Google 권장)
- `data-nosnippet`: 검색 스니펫 및 AI Overview 인용 대상에서 제외
- `aria-label="추천"`: 스크린 리더 사용자에게 광고 맥락 안내

#### 링크 속성
`NativeAdCard` 내부 `<Link>` 에 다음을 추가:
- `rel="nofollow sponsored"`
- `target="_blank"` (어필리에이트 랜딩은 새 탭이 표준)
- `aria-label`: CTA + variant를 결합한 명확한 설명

#### FAQ 충돌 회피
`extractFaqFromHtml`은 "자주 묻는 질문" H2 다음에 오는 H3 `Q.` 패턴을 파싱한다. 광고는 **FAQ H2 섹션 진입 이전**에만 삽입한다. 마지막 H2가 FAQ인 경우 그 직전까지만 허용.

### 3.2 사이드바 광고 (PC 전용)

#### 배치
- 기존 `ArticleTableOfContents` 컴포넌트 아래
- `hidden lg:block` 래퍼 (데스크탑 1024px+ 만 노출)
- sticky 유지 (top: 24rem 기준, TOC sticky 이후)

#### 개수
- 최대 2개
- 첫 번째는 primary variant (category 매칭), 두 번째는 secondary variant (교차 노출)

#### 컴포넌트
기존 `NativeAdCard placement="sidebar"` 재사용. 별도 스타일 추가 없음.

### 3.3 variant 자동 선택 로직

```typescript
function selectAdVariants(args: {
  category: string;
  title: string;
  tags?: string[];
}): {
  inline: AdVariant[]; // 2~3개
  sidebar: AdVariant[]; // 2개
}
```

#### 매칭 규칙 (우선순위 순)
1. 제목/태그/카테고리 문자열 조합에서 키워드 스캔
2. CCTV 계열 키워드 (`cctv`, `보안`, `카메라`, `매장`, `무인`, `감시`) → `cctv-*` 3종
3. 법인/세금 계열 키워드 (`법인`, `사업자`, `세금`, `창업`, `등기`, `세무`, `종소세`, `법인세`) → `corp-*` 3종
4. `category === "finance"` → `corp-*` 3종
5. 기본값 → `corp-cost` + `cctv-cost` 교차

#### variant 순서
- 인라인: 각도 다양화 (비용 → 시간/법률 → 재창업/효율)
- 사이드바: 가장 강력한 heroNumber 우선 (절세액 또는 과태료 같은 큰 숫자)

---

## 4. 비기능 요구사항

### 4.1 성능
- 서버 컴포넌트에서 HTML 파싱 (런타임 비용 zero for client)
- DOMParser 미사용 (서버 환경 호환 X). 정규식 기반 H2 splitter 사용.
- 광고 컴포넌트는 기존 `"use client"` 유지, 별도 hydration 비용 증가 없음.

### 4.2 SEO 무영향 검증
- Google Search Console `data-nosnippet` 공식 지원 확인
- `rel="sponsored"` 는 2020년 Google 공식 도입, nofollow와 병기 권장
- `<aside>` HTML5 시맨틱 표준, Googlebot이 본문과 분리 인식
- Lighthouse Accessibility 스코어 -0 목표

### 4.3 A11y
- `<aside role="complementary">` 자동 (HTML5 implicit role)
- `aria-label="추천"` 명시
- 광고 링크 focus ring 기존 유지

### 4.4 구현 제약
- TypeScript strict, `any` 금지
- 서버 컴포넌트 우선 (ContentWithAds는 서버)
- NativeAdCard 내부 수정 최소화 (href/rel/target만 추가)
- 이모지 금지, 하드코딩 컬러 금지

---

## 5. 비범위 (Out of Scope)

- A/B 테스트 프레임워크 (차기 페이즈)
- 광고 클릭 추적/분석 이벤트 (GA4 이벤트는 별도 티켓)
- 실제 어필리에이트 랜딩 URL 연결 (현재 `href="#"` 유지, 별도 운영 작업)
- 광고 노출 빈도 캡 / 쿠키 기반 개인화
- 다크모드 전용 variant (기존 6종으로 충분)

---

## 6. 성공 지표 (KPI)

### 도입 직후 (1주)
- [ ] `/finance/[slug]` 포스트 페이지 인콘텐츠 광고 2~3개 정상 노출
- [ ] 모바일(390px)에서 사이드바 광고 비노출 확인
- [ ] PageSpeed Insights 점수 -5 이내 유지
- [ ] Google Rich Results Test 통과 (JSON-LD 정상)

### 4주 후
- 광고 CTR 측정 (목표 0.8~1.5%)
- 독자 이탈률 변화 (+3% 이내 허용)
- 평균 체류 시간 (-10% 이내 허용)

---

## 7. 리스크 및 완화

| 리스크 | 확률 | 영향 | 완화 |
|---|---|---|---|
| 광고가 본문 흐름을 깨 이탈률 증가 | 중 | 고 | H2 섹션 경계에만 삽입, 광고 사이 최소 1섹션 보장 |
| SEO 링크 주스 손실 | 저 | 중 | `rel="nofollow sponsored"` + `<aside>` + `data-nosnippet` 삼중 방어 |
| FAQ JSON-LD 추출 실패 | 저 | 중 | 광고는 FAQ H2 이전까지만 삽입 + 배포 후 Rich Results Test 재검증 |
| 모바일 사이드바 광고 오노출 | 저 | 고 | `hidden lg:block` 단일 Tailwind 유틸로 명시적 제어 |
| 광고 variant 잘못 매칭 | 중 | 저 | 키워드 스캔 실패 시 category 기본값 fallback |

---

## 8. 배포 계획

1. **Phase 1 (구현)**: ContentWithAds 컴포넌트 + 포스트 페이지 통합 — 이번 세션
2. **Phase 2 (검증)**: 로컬 테스트 + Rich Results Test + Lighthouse — 이번 세션
3. **Phase 3 (스테이지)**: 실제 포스트 1편으로 한정 배포 (A/B 없이 관찰)
4. **Phase 4 (전체)**: 전 포스트 롤아웃, KPI 대시보드 연결

---

## 9. 승인

- [x] 사용자 확정: 사이드바 PC 전용, 인콘텐츠 2~3개, SEO 영향 없음, 거부감 0
- [x] PO 검토: RICE 스코어 Reach=높음, Impact=2, Confidence=80%, Effort=1주
- [ ] Engineering 검토 (자체 구현으로 대체)
