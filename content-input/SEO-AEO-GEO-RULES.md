# SEO · AEO · GEO 통합 규정 — factnote.co.kr

**기준일**: 2026-04-12
**적용 범위**: `content-input/prompts/*.md` 4종 (키퍼메이트 / 법인설립지원센터 / 밀리의서재 / 차별화상회)
**상위 문서**: `CLAUDE.md` → "완전 자동화 콘텐츠 파이프라인" 하위 규정

이 문서는 검색엔진(Google / Naver), 답변엔진(Perplexity / ChatGPT Search / Copilot / AI Overview), 생성형 AI(Claude / Gemini / GPT) 3종 노출을 모두 잡기 위한 콘텐츠 표준이다. 프롬프트 개정 시 이 문서의 규정을 프롬프트 본문에 구체 수치로 반영한다. 규정은 리서치 근거 + 수치 + 왜(Why) 3요소를 모두 갖춰야 한다.

---

## 0. 용어 정의

| 약어 | 정의 | 타겟 엔진 |
|------|------|----------|
| SEO | Search Engine Optimization — 크롤 기반 인덱스 순위 | Google, Naver |
| AEO | Answer Engine Optimization — 답변 엔진 인용 | Perplexity, ChatGPT Search, Google AI Overview, Copilot |
| GEO | Generative Engine Optimization — 생성형 모델 학습·인용 | Claude, Gemini, GPT, Grok, DeepSeek |

2026년 기준 Google AI Overview는 검색의 60% 이상에서 표시되고 전통 CTR은 61% 감소하지만, **인용된 페이지의 organic click은 +35%**다. 인용 경쟁이 곧 트래픽 경쟁이다.

---

## 1. 핵심 지표 — 이 숫자들이 콘텐츠 규칙의 근거다

리서치로 확정한 2026년 인용 경제학:

- **FAQPage JSON-LD**: 평균 citation +30%, 최대 2.7배. (Why) 답변엔진은 Q→A 매핑을 JSON-LD에서 직접 추출한다.
- **Triple Schema Stack** (Article + FAQPage + ItemList/HowTo): citation 1.8배. (Why) 복합 시그널로 콘텐츠 타입과 구조를 동시에 전달한다.
- **상위 30% 본문에 답변 배치**: AI Overview 인용의 55%가 이 영역에서 발생. (Why) 답변엔진은 페이지 전체를 스캔하지 않고 상단부터 semantic chunk를 평가한다.
- **300 단어당 통계·수치 3개 이상**: citation 2.1배. (Why) 검증 가능한 정량 팩트가 AI 신뢰 스코어를 올린다.
- **Top N 리스트 포맷**: AI 인용의 74.2%를 차지. (Why) 리스트 구조는 LLM이 구조를 파악하기 가장 쉬운 형태다.
- **90일 이내 업데이트**: 미업데이트 콘텐츠는 citation 손실 3배. (Why) LLM은 최신성에 가중치를 둔다 (recency bias).
- **의문문 헤딩**: passage-level extraction에서 직접 인용률 증가. (Why) 사용자 query와 heading이 매칭되면 AI는 해당 passage를 추출한다.
- **40~60단어 직접 답변 단락** (한국어 80~150자): position zero와 AI Overview 인용 최적. (Why) 이 길이가 featured snippet display limit과 정확히 일치한다.
- **E-E-A-T 일인칭 경험**: Google 2026 March Core Update에서 가중치 상향. (Why) 생성형 AI는 first-hand experience 시그널을 scraped content와 구분한다.

---

## 2. 콘텐츠 구조 표준

### 2.1 고정 스켈레톤 (모든 포스트)

```
[frontmatter]
> 공시 문구

## 목차 (자동 번호, 앵커 링크)

## H2 (글 제목과 동일 — 페이지 <h1>은 템플릿이 별도 렌더, 본문 H1 금지)

[핵심 요약 박스 / TL;DR] — 80~150자
[도입부 직접 답변 단락] — 80~150자, 첫 단락이 핵심 질문에 답변

## H2 섹션 1 (의문문 또는 명사형)
### H3 서브섹션
[표 / 리스트 / 통계 단락]

## H2 섹션 2
...
(H2는 4~6개, 각 섹션 400~600자, 통계 3개 이상/300단어)

## 자주 묻는 질문 (FAQ)
### Q. 질문 1
답변 1 (80~150자, 직접 답변형)
...
(5~7개 권장)

## 정리 — TL;DR 재표기 + 체크리스트

[CTA 링크]

## 관련 글 (내부 링크 2~4개)

## 출처 (공식 기관 링크 3개 이상)
```

### 2.2 분량 기준 (상향)

| 영역 | 기존 | 신규 | Why |
|------|------|------|-----|
| 본문 총분량 | 2,000~3,000자 | **2,500~4,000자** | GEO 권장 1,500단어(≈한글 3,000자) 이상이 topical depth 판정 기준 |
| 핵심 요약 박스 | 없음 | **80~150자** | AI Overview 상위 30% 추출 영역 확보 |
| 도입부 직접 답변 | 3~5문장 | **1단락 80~150자** | featured snippet 45단어 평균과 일치 |
| FAQ 답변 1개 | 제한 없음 | **80~150자** | FAQPage schema 최적 길이 |
| FAQ 개수 | 5개 | **5~7개** | Q&A 범위 확장, long-tail 쿼리 매칭 |
| H2 섹션 수 | 3~5개 | **4~6개** | 의문문 헤딩 비율 40% 확보용 |

### 2.3 의문문 헤딩 비율

모든 H2 중 **40% 이상은 의문문**으로 작성한다. 나머지는 명사형(결과/방법/절차).

**좋은 예시**:
- "부가세 신고는 법인이 더 빠를까?" (의문문)
- "CCTV 지원금은 언제 신청해야 하나?" (의문문)
- "2026년 법인세율 비교표" (명사형, 결과 제시)

**나쁜 예시**:
- "알아두면 좋은 것들" (모호)
- "이것저것" (키워드 없음)

Why — 답변엔진은 사용자 query를 H2/H3 heading과 직접 매칭해 passage를 선택한다.

### 2.4 Top N 리스트 포맷 강제

모든 포스트에 최소 1개의 숫자 리스트 섹션을 포함한다. 권장 패턴:
- "소상공인 CCTV 지원금 5가지 — 서울·경기·부산"
- "법인설립 전 체크할 7가지"
- "밀리의서재 활용법 10선 — 직장인 편"

Why — AI 인용의 74.2%가 Top N 구조에서 발생. 리스트는 LLM이 가장 빠르게 파싱하는 포맷이다.

---

## 3. AEO 직접 답변 패턴

### 3.1 도입부 직접 답변 템플릿

```markdown
## {제목}  <!-- 본문 H1 금지: 페이지 <h1>은 템플릿이 별도 렌더 -->

> **한 줄 답변**: {핵심 질문에 대한 수치 포함 답변 — 80자 이내}

{도입부 단락 — 80~150자}
{핵심 질문을 그대로 반복하고, 첫 문장에 가장 중요한 수치를 배치한다.
"2026년 소상공인 CCTV 지원금은 최대 300만원까지 받을 수 있다.
중기부 스마트상점 기술보급사업이 사업비의 70%를 지원하고, 지자체 자체
사업을 합치면 실부담은 30% 수준으로 내려간다."}
```

Why — 첫 45단어(한글 ≈90자) 내에 수치 답변이 없으면 AEO 인용률이 급락한다.

### 3.2 단락 작성 규칙

- **BLUF** (Bottom Line Up Front): 결론 → 근거 → 세부 순서
- **1단락 1아이디어**: 80~150자 엄수. 장황한 복문 금지.
- **수치 우선**: "대부분" "많이" 같은 모호한 정도부사 대신 `60%`, `200만원`, `24개월` 같은 구체 수치.
- **출처 inline**: 수치 옆에 기관명 명기. 예: `중기부에 따르면 2026년 사업비의 70%`

### 3.3 질문-답변 페어링 헤딩 (H3)

섹션 내 H3는 **"질문 → 수치 답변" 쌍**으로 구성한다.

좋은 예:
```markdown
### 서울시 CCTV 지원금은 얼마까지?
서울시는 설치 비용의 70%, 최대 150만원을 지원한다. 전통시장 입점 점포는 우선 배정된다.
```

Why — AI Overview는 H3 단위로 passage extraction을 수행한다. H3가 질문 + 첫 문장이 수치 답변이면 그대로 snippet으로 발탁된다.

---

## 4. Schema.org 마크업 규정

### 4.1 자동 주입되는 스키마 (인프라 보유)

현재 `src/lib/seo.ts`가 제공하는 빌더:
- `buildArticleJsonLd` — BlogPosting 타입, 모든 포스트 자동 주입
- `buildFaqJsonLd` + `extractFaqFromHtml` — FAQ 2개 이상이면 자동 주입
- `buildBreadcrumbJsonLd` — 카테고리 페이지 자동
- `buildOrganizationJsonLd` — 사이트 전역
- `buildHowToJsonLd` — **정의만 있고 미사용. 절차형 포스트에 수동 연결 필요**

### 4.2 프롬프트가 보장해야 할 구조

**FAQ 섹션** (자동 FAQPage JSON-LD 조건):
```markdown
## 자주 묻는 질문

### Q. 질문 텍스트
답변 본문 80~150자...

### Q. 다음 질문
...
```

제약:
- H2가 "자주 묻는 질문", "FAQ", "Q&A" 중 하나를 포함해야 함 (`extractFaqFromHtml` 패턴)
- Q는 H3, 답변은 바로 다음 단락 (다른 H3가 오기 전까지)
- 최소 2개, 권장 5~7개

Why — 이 패턴으로 작성하면 `extractFaqFromHtml`이 자동으로 FAQPage JSON-LD를 주입해 FAQPage +30% citation 부스트가 적용된다.

### 4.3 HowTo Schema 활용 (신규)

절차형 콘텐츠(신청 가이드, 설치 가이드, 비교 가이드)는 HowTo-friendly 마크업을 본문에 포함한다. 프롬프트는 아래 구조를 강제한다:

```markdown
## 신청 절차 (단계별 가이드)

### 1단계: 자격 확인
{설명 80~150자}

### 2단계: 서류 준비
{설명 80~150자}

### 3단계: 온라인 신청
{설명 80~150자}
```

H2가 "절차", "단계별", "가이드", "방법" 중 하나를 포함하고, 하위 H3가 `N단계:` 패턴이면 추후 HowTo JSON-LD 자동 주입 훅이 추출할 수 있다 (Phase 9.5 후속 작업).

Why — HowTo schema 적용 시 절차형 쿼리(예: "법인설립 방법", "CCTV 지원금 신청")의 featured snippet과 Copilot narrative citation에 유리하다.

---

## 5. GEO 권위 신호 체크리스트

생성형 AI가 콘텐츠를 학습·인용할 때 가중치를 주는 신호들. 각 포스트는 **최소 8개 이상** 체크해야 한다.

- [ ] **저자 실명 + 에디터 역할 명시** (author field)
- [ ] **게재일 + 업데이트일 frontmatter 기재** (90일 이내 유지)
- [ ] **본문 상단에 "{YYYY-MM-DD} 기준" 명시**
- [ ] **공식 기관 출처 3개 이상** (정부, 공공기관, 제조사 공식)
- [ ] **출처 링크 옆에 기관명 + 연도 병기** 예: `중기부(2026)`
- [ ] **통계 3개 이상/300단어**
- [ ] **비교표 1개 이상** (3~4 컬럼 × 5~10 행)
- [ ] **일인칭 경험 표현 1회 이상**: "실제로 확인해보니", "현장에서 들어본", "사장님 상담 사례로는"
- [ ] **한계·불확실성 명시** 1회 이상: "단정할 수 없다", "케이스에 따라 다르다", "공고 시점에 따라 변동"
- [ ] **공시 문구 frontmatter + 본문 하단 2회 반복**

Why — Google 2026 March Core Update는 first-hand experience에 가중치를 부여하며, 생성형 AI는 한계 명시를 "과장 없는 신뢰 콘텐츠" 신호로 사용한다.

---

## 6. 한국 네이버 SEO 특화 규칙

네이버 C-Rank + D.I.A.+ 알고리즘은 **주제 전문성 40% + 활동 지속성 30% + 사용자 반응 20% + 콘텐츠 품질 10%** 가중치로 순위를 결정한다.

### 6.1 주제 전문성 (C-Rank 40%)

- 어필리에이트 1개당 1개 주제 영역 고정 (키퍼메이트 → CCTV/매장보안, 법인설립지원센터 → 법인/세무 등)
- 크로스 토픽 금지 — 키퍼메이트 콘텐츠에서 부동산 이야기 X
- 메인 키워드 출현 빈도: 본문 2,500자당 **5~8회** (지나치면 keyword stuffing 감점)

### 6.2 D.I.A.+ 문서 만족도

- 제목-본문 일치도: 제목의 수치·지역·연도가 본문 첫 500자 내에 모두 등장
- 문서 체류시간 신호: 표·리스트·이미지 구조로 스크롤 유도 (본문당 표 2개+ 권장)
- 네이버는 직접 답변형 단락을 선호 — AEO 규칙과 정합

### 6.3 금지 패턴 (네이버 저품질 트리거)

- 동일 키워드 3회 연속 반복
- 외부 링크만 있고 내부 링크 0개 → 관련 글 2~4개 내부 링크 필수
- 이미지 alt 누락 (DB insert 시 자동 검증)
- 광고·CTA 밀도 1,000자당 2회 초과 → 저품질 판정 리스크

---

## 7. 통합 금지 패턴

### 7.1 단어·구문 금지 (확장판)

기존 프롬프트의 `delve, tapestry, leverage, robust, seamless` 외 추가:

**Tier 1 절대 금지** (20개):
delve, tapestry, landscape, leverage, robust, seamless, streamline, empower, unlock, foster, testament, vibrant, pivotal, underscore, garner, intricate, showcase, enhance, crucial, cutting-edge

**Tier 2 맥락 회피** (주요):
comprehensive, innovative, harness, navigate, furthermore, moreover, plethora, myriad, nuanced, multifaceted, transformative, groundbreaking, state-of-the-art

**한국어 슬롭 금지**:
- "살펴보겠습니다", "알아보겠습니다", "마무리하겠습니다"
- "~라고 할 수 있습니다" 남발
- "~에 대해서 말씀드리자면"
- 불필요한 "~입니다/합니다" 반복 (간결체 사용)

### 7.2 콘텐츠 패턴 금지

- 첫 단락에 수치 없는 도입부
- 서술형 헤딩 100%
- FAQ 2개 미만
- 출처 3개 미만
- 통계 없는 섹션
- 이모지 사용
- 단정형 표현 ("무조건", "반드시 절세", "100%")
- 경쟁사 비방
- 독자에게 "안녕하세요 에디터입니다" 류 인사

Why — 이 패턴들은 네이버 저품질 필터와 AI 인용 감점 양쪽을 유발한다.

---

## 8. 프롬프트에 반영해야 할 필수 지시문

각 `content-input/prompts/*.md` 파일에 아래 블록을 `SEO & 콘텐츠 규칙` 하위에 추가 또는 치환한다.

```
### SEO · AEO · GEO 필수 규칙 (2026-04 기준)

- 분량: 본문 2,500~4,000자 (목차·출처 제외)
- 구조: 목차 → H2(글 제목, 본문 H1 금지) → TL;DR 박스(80~150자) → 직접 답변 도입부(80~150자) → H2 4~6개 → FAQ 5~7개 → 정리 → CTA → 관련글 → 출처
- 첫 단락 규칙: 첫 45단어(약 90자) 내에 핵심 질문에 대한 수치 답변 배치
- 의문문 헤딩: 전체 H2의 40% 이상을 의문문으로
- Top N 리스트: 최소 1개 섹션을 "N가지 / N선" 숫자 리스트 포맷으로
- 통계 밀도: 300자당 수치 3개 이상 (예: 금액, 비율, 기간, 개수)
- FAQ 답변 길이: 각 80~150자 (40~60단어 featured snippet 기준)
- FAQ H2 제목: "자주 묻는 질문" / "FAQ" / "Q&A" 중 하나 사용 (FAQPage JSON-LD 자동 추출 조건)
- 출처: 공식 기관 3개 이상, 기관명 + 연도 병기 (예: 중기부(2026))
- 업데이트 신호: 본문 첫 500자 내에 "{YYYY-MM-DD} 기준" 또는 "2026년 기준" 명시
- E-E-A-T: 일인칭 경험 표현 1회 이상 ("현장에서", "실제 사장님 상담에서", "직접 확인")
- 한계 명시: "케이스에 따라 다르다", "공고 시점에 따라 변동" 등 1회 이상
- 내부 링크: "관련 글" 섹션에 동일 카테고리 내 2~4개
- 절차형 콘텐츠: H3에 "N단계:" 패턴 사용 (HowTo 추출 대비)
- 비교표: 3~4 컬럼 × 5~10 행 비교표 1개 이상
- 금지어 Tier 1: delve, tapestry, landscape, leverage, robust, seamless, streamline, empower, unlock, foster, testament, vibrant, pivotal, underscore, garner, intricate, showcase, enhance, crucial, cutting-edge
- 한국어 금지: "살펴보겠습니다", "알아보겠습니다", "마무리하겠습니다", "~라고 할 수 있습니다" 남발
- 이모지 금지
```

---

## 9. 검증 방법 (Phase 9.6 후속 작업으로)

발행된 포스트를 아래 기준으로 검증하는 스크립트 추가 예정:

- FAQ 개수 ≥ 5
- 통계 수 ≥ 총 단어수/100 × 1
- 의문문 H2 비율 ≥ 40%
- 본문 길이 2,500~4,000자
- 출처 링크 ≥ 3
- 금지어 0회
- `extractFaqFromHtml` 결과 2개 이상 (FAQPage 자동 주입 조건)

검증 스크립트 위치 (예정): `scripts/verify-seo-aeo-geo.mjs`

---

## 10. 변경 이력

| 날짜 | 변경 | 근거 |
|------|------|------|
| 2026-04-12 | 초안 작성 (v1) | Phase 9.5 SEO-AEO-GEO 업그레이드 |
| 2026-04-13 | 본문 H1 금지 규정 반영 (v1.1) | 페이지 `<h1>`은 Next.js 템플릿이 별도 렌더 — 본문 최상위 헤딩을 H2로 통일 |

---

## 참고 소스 (리서치 기반)

- GenOptima — GEO Best Practices 2026
- Search Engine Land — Mastering GEO 2026
- Superlines — GEO Checklist 2026
- Schema.org — FAQPage, HowTo, BlogPosting Types
- StackMatix — Structured Data AI Search 2026
- Wellows — Google AI Overview Ranking Factors 2026
- 1702 Digital — SEO Trends 2026
- 트윈워드 — 네이버 D.I.A. 알고리즘 분석
- 어센트 코리아 — 네이버 SEO 알고리즘 총정리
- DataEnriche — Featured Snippet Length 2026
- Bluehost — llms.txt Guide 2026
